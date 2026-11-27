from __future__ import annotations

import math
import unittest

import numpy as np

from src.ai.audio.detector import (
    AudioEventDetectionError,
    DetectorConfig,
    detect_audio_events,
)


def feature_document(
    duration: float,
    bursts: list[tuple[float, float]] | None = None,
    *,
    spike_at: float | None = None,
    hop: float = 0.25,
) -> dict:
    bursts = bursts or []
    starts = np.arange(0.0, duration, hop)
    features = []
    for start in starts:
        end = min(float(start + 0.5), duration)
        center = (float(start) + end) / 2.0
        active = any(left <= center <= right for left, right in bursts)
        spike = (
            spike_at is not None
            and abs(center - spike_at) < hop / 2
        )
        features.append(
            {
                "start": round(float(start), 6),
                "end": round(end, 6),
                "rms": 1.0 if spike else (0.25 if active else 0.05),
                "peak": 1.0 if spike else (0.9 if active else 0.1),
                "spectralFlux": (
                    1.0 if spike else (0.6 if active else 0.1)
                ),
                "relativeEnergy": (
                    0.99 if spike else (0.8 if active else 0.5)
                ),
            }
        )
    return {
        "version": 1,
        "sampleRate": 16_000,
        "channels": 1,
        "duration": duration,
        "windowSeconds": 0.5,
        "hopSeconds": hop,
        "baselineSeconds": 10.0,
        "featureDefinitions": {},
        "features": features,
    }


def test_config(**overrides: float) -> DetectorConfig:
    values = {
        "smoothing_seconds": 0.75,
        "minimum_activity_seconds": 0.5,
        "minimum_candidate_seconds": 1.0,
        "maximum_candidate_seconds": 20.0,
        "maximum_gap_seconds": 1.0,
        "context_padding_seconds": 0.0,
        "minimum_evidence_score": 0.1,
        "target_duration_seconds": 4.0,
    }
    values.update(overrides)
    return DetectorConfig(**values)


class AudioEventDetectorTests(unittest.TestCase):
    def detect(
        self,
        duration: float,
        bursts: list[tuple[float, float]] | None = None,
        *,
        spike_at: float | None = None,
        config: DetectorConfig | None = None,
    ) -> list[dict]:
        result = detect_audio_events(
            feature_document(
                duration,
                bursts,
                spike_at=spike_at,
            ),
            config or test_config(),
        )
        return result["candidates"]

    def test_silent_recording_has_no_candidates(self) -> None:
        document = feature_document(20.0)
        for feature in document["features"]:
            for name in (
                "rms",
                "peak",
                "spectralFlux",
                "relativeEnergy",
            ):
                feature[name] = 0.0
        self.assertEqual(
            detect_audio_events(document, test_config())["candidates"],
            [],
        )

    def test_constant_background_has_no_candidates(self) -> None:
        self.assertEqual(self.detect(20.0), [])

    def test_single_short_spike_is_suppressed(self) -> None:
        self.assertEqual(self.detect(20.0, spike_at=5.125), [])

    def test_sustained_burst_creates_one_candidate(self) -> None:
        candidates = self.detect(20.0, [(5.0, 9.0)])
        self.assertEqual(len(candidates), 1)
        self.assertLessEqual(candidates[0]["start"], 5.0)
        self.assertGreaterEqual(candidates[0]["end"], 9.0)
        self.assertTrue(candidates[0]["reasons"])
        self.assertTrue(0 <= candidates[0]["score"] <= 1)

    def test_nearby_bursts_merge_into_one_candidate(self) -> None:
        candidates = self.detect(
            20.0,
            [(4.0, 6.0), (6.5, 8.5)],
        )
        self.assertEqual(len(candidates), 1)
        self.assertLessEqual(candidates[0]["start"], 4.0)
        self.assertGreaterEqual(candidates[0]["end"], 8.5)

    def test_separated_events_remain_distinct(self) -> None:
        candidates = self.detect(
            30.0,
            [(4.0, 7.0), (18.0, 21.0)],
        )
        self.assertEqual(len(candidates), 2)
        self.assertLess(candidates[0]["end"], candidates[1]["start"])

    def test_event_crossing_hypothetical_block_boundary_is_whole(self) -> None:
        candidates = self.detect(15.0, [(4.0, 7.0)])
        self.assertEqual(len(candidates), 1)
        self.assertLess(candidates[0]["start"], 5.0)
        self.assertGreater(candidates[0]["end"], 5.0)

    def test_event_at_recording_start_is_clamped(self) -> None:
        candidates = self.detect(
            20.0,
            [(0.0, 4.0)],
            config=test_config(context_padding_seconds=2.0),
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["start"], 0.0)

    def test_event_at_recording_end_is_clamped(self) -> None:
        candidates = self.detect(
            20.0,
            [(16.0, 20.0)],
            config=test_config(context_padding_seconds=2.0),
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["end"], 20.0)

    def test_very_short_recording_is_handled(self) -> None:
        candidates = self.detect(
            2.0,
            [(1.25, 2.0)],
            config=test_config(
                smoothing_seconds=0.25,
                minimum_activity_seconds=0.25,
                minimum_candidate_seconds=0.25,
                target_duration_seconds=1.0,
            ),
        )
        self.assertLessEqual(len(candidates), 1)

    def test_excessively_long_activity_is_segmented(self) -> None:
        candidates = self.detect(
            100.0,
            [(10.0, 50.0)],
            config=test_config(maximum_candidate_seconds=10.0),
        )
        self.assertGreater(len(candidates), 1)
        self.assertTrue(
            all(
                candidate["end"] - candidate["start"] <= 10.000001
                for candidate in candidates
            )
        )

    def test_invalid_or_missing_feature_values_are_rejected(self) -> None:
        document = feature_document(5.0)
        del document["features"][0]["rms"]
        with self.assertRaises(AudioEventDetectionError):
            detect_audio_events(document, test_config())

        document = feature_document(5.0)
        document["features"][0]["peak"] = math.inf
        with self.assertRaises(AudioEventDetectionError):
            detect_audio_events(document, test_config())

    def test_normalization_is_stable_with_an_extreme_spike(self) -> None:
        document = feature_document(
            30.0,
            [(10.0, 14.0)],
            spike_at=2.125,
        )
        candidates = detect_audio_events(
            document,
            test_config(),
        )["candidates"]
        self.assertEqual(len(candidates), 1)
        self.assertGreater(candidates[0]["start"], 5.0)

    def test_candidate_ordering_and_scores_are_deterministic(self) -> None:
        document = feature_document(
            30.0,
            [(4.0, 7.0), (18.0, 21.0)],
        )
        first = detect_audio_events(document, test_config())
        second = detect_audio_events(document, test_config())
        self.assertEqual(first, second)
        candidates = first["candidates"]
        self.assertEqual(
            [candidate["start"] for candidate in candidates],
            sorted(candidate["start"] for candidate in candidates),
        )
        for candidate in candidates:
            self.assertTrue(
                all(
                    math.isfinite(value) and 0 <= value <= 1
                    for value in candidate["evidence"].values()
                )
            )


if __name__ == "__main__":
    unittest.main()
