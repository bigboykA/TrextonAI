from __future__ import annotations

import json
import math
from pathlib import Path
import tempfile
import unittest
import wave

import numpy as np

from src.ai.audio.analyzer import (
    AnalysisConfig,
    AudioAnalysisError,
    analyze_wav,
    write_feature_json,
)


def write_pcm16(
    path: Path,
    samples: np.ndarray,
    sample_rate: int,
) -> None:
    values = np.asarray(samples, dtype=np.float64)
    if values.ndim == 1:
        channels = 1
    elif values.ndim == 2:
        channels = values.shape[1]
    else:
        raise ValueError("Samples must be mono or frame-by-channel")

    encoded = np.round(
        np.clip(values, -1.0, 1.0) * 32767.0
    ).astype("<i2")
    with wave.open(str(path), "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(encoded.tobytes())


class AudioAnalyzerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def analyze(
        self,
        samples: np.ndarray,
        sample_rate: int = 8_000,
        config: AnalysisConfig | None = None,
        name: str = "audio.wav",
    ) -> dict:
        path = self.root / name
        write_pcm16(path, samples, sample_rate)
        return analyze_wav(path, config)

    def test_silent_audio_is_finite_and_zero(self) -> None:
        result = self.analyze(np.zeros(8_000))

        self.assertEqual(result["sampleRate"], 8_000)
        self.assertTrue(result["features"])
        for feature in result["features"]:
            self.assertEqual(feature["rms"], 0.0)
            self.assertEqual(feature["peak"], 0.0)
            self.assertEqual(feature["spectralFlux"], 0.0)
            self.assertEqual(feature["relativeEnergy"], 0.0)

    def test_constant_amplitude_has_stable_energy(self) -> None:
        result = self.analyze(np.full(16_000, 0.25))
        full_windows = [
            item
            for item in result["features"]
            if item["end"] - item["start"] >= 0.5
        ]

        for feature in full_windows:
            self.assertAlmostEqual(feature["rms"], 0.25, places=3)
            self.assertAlmostEqual(feature["peak"], 0.25, places=3)
            self.assertAlmostEqual(
                feature["relativeEnergy"],
                0.5,
                places=3,
            )
        self.assertLess(
            max(item["spectralFlux"] for item in full_windows[1:]),
            1e-6,
        )

    def test_synthetic_spike_is_locally_elevated(self) -> None:
        samples = np.zeros(16_000)
        samples[8_000:8_800] = 1.0
        result = self.analyze(samples)
        strongest = max(
            result["features"],
            key=lambda item: item["rms"],
        )

        self.assertEqual(strongest["peak"], 0.9999694824)
        self.assertGreater(strongest["rms"], 0.4)
        self.assertGreater(strongest["relativeEnergy"], 0.9)

    def test_sudden_frequency_change_creates_flux(self) -> None:
        sample_rate = 8_000
        time = np.arange(sample_rate * 4) / sample_rate
        samples = np.where(
            time < 2.0,
            np.sin(2 * np.pi * 220 * time),
            np.sin(2 * np.pi * 1_760 * time),
        ) * 0.5
        result = self.analyze(samples, sample_rate)
        near_change = [
            item["spectralFlux"]
            for item in result["features"]
            if 1.5 <= item["start"] <= 2.25
        ]
        away_from_change = [
            item["spectralFlux"]
            for item in result["features"]
            if 0.5 <= item["start"] <= 1.25
        ]

        self.assertGreater(max(near_change), 0.5)
        self.assertLess(max(away_from_change), 0.01)

    def test_very_short_file_produces_one_partial_window(self) -> None:
        result = self.analyze(np.full(800, 0.1))

        self.assertEqual(len(result["features"]), 1)
        self.assertEqual(result["features"][0]["start"], 0.0)
        self.assertEqual(result["features"][0]["end"], 0.1)

    def test_stereo_matches_equivalent_mono(self) -> None:
        sample_rate = 8_000
        time = np.arange(sample_rate * 2) / sample_rate
        mono = np.sin(2 * np.pi * 440 * time) * 0.4
        stereo = np.column_stack((mono, mono))

        mono_result = self.analyze(mono, name="mono.wav")
        stereo_result = self.analyze(stereo, name="stereo.wav")

        self.assertEqual(stereo_result["channels"], 2)
        for mono_feature, stereo_feature in zip(
            mono_result["features"],
            stereo_result["features"],
            strict=True,
        ):
            for name in (
                "rms",
                "peak",
                "spectralFlux",
                "relativeEnergy",
            ):
                self.assertAlmostEqual(
                    mono_feature[name],
                    stereo_feature[name],
                    places=9,
                )

    def test_corrupt_wav_is_rejected(self) -> None:
        path = self.root / "corrupt.wav"
        path.write_bytes(b"not a wav file")

        with self.assertRaises(AudioAnalysisError):
            analyze_wav(path)

    def test_long_file_processes_across_many_blocks(self) -> None:
        sample_rate = 1_000
        time = np.arange(sample_rate * 125) / sample_rate
        samples = np.sin(2 * np.pi * 80 * time) * 0.1
        result = self.analyze(
            samples,
            sample_rate,
            AnalysisConfig(block_seconds=7.0),
        )

        self.assertEqual(result["duration"], 125.0)
        self.assertEqual(len(result["features"]), 500)
        self.assertLessEqual(
            max(item["peak"] for item in result["features"]),
            0.101,
        )

    def test_features_are_consistent_across_block_boundaries(self) -> None:
        sample_rate = 4_000
        rng = np.random.default_rng(42)
        samples = rng.normal(0, 0.1, sample_rate * 5)
        small_blocks = self.analyze(
            samples,
            sample_rate,
            AnalysisConfig(block_seconds=0.6),
            "small-blocks.wav",
        )
        large_blocks = analyze_wav(
            self.root / "small-blocks.wav",
            AnalysisConfig(block_seconds=10.0),
        )

        self.assertEqual(
            small_blocks["features"],
            large_blocks["features"],
        )

    def test_timestamps_include_final_partial_windows(self) -> None:
        result = self.analyze(np.zeros(8_800))
        starts = [item["start"] for item in result["features"]]
        ends = [item["end"] for item in result["features"]]

        self.assertEqual(starts, [0.0, 0.25, 0.5, 0.75, 1.0])
        self.assertEqual(ends, [0.5, 0.75, 1.0, 1.1, 1.1])

    def test_json_serialization_contains_only_finite_values(self) -> None:
        result = self.analyze(np.zeros(8_000))
        output = self.root / "features.json"
        write_feature_json(result, output, pretty=True)

        raw = output.read_text(encoding="utf-8")
        parsed = json.loads(
            raw,
            parse_constant=lambda value: self.fail(
                f"Unexpected JSON constant: {value}"
            ),
        )
        numeric_values = [
            value
            for feature in parsed["features"]
            for value in feature.values()
        ]
        self.assertTrue(
            all(math.isfinite(value) for value in numeric_values)
        )


if __name__ == "__main__":
    unittest.main()
