"""Convert Trexton audio features into interpretable activity candidates.

Scores are bounded evidence scores, not calibrated highlight probabilities.
The detector uses recording-level robust normalization, temporal smoothing,
hysteresis, nearby-event grouping, and low-activity segmentation.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
import math
from pathlib import Path
import sys
from typing import Any, Iterable

import numpy as np


DETECTOR_NAME = "audio_event_v1"
FEATURE_NAMES = ("rms", "peak", "spectralFlux", "relativeEnergy")


class AudioEventDetectionError(RuntimeError):
    """Raised when feature input or detector configuration is invalid."""


@dataclass(frozen=True)
class DetectorConfig:
    smoothing_seconds: float = 1.0
    start_threshold: float = 0.38
    continue_threshold: float = 0.18
    minimum_activity_seconds: float = 0.5
    minimum_candidate_seconds: float = 2.0
    maximum_candidate_seconds: float = 45.0
    maximum_gap_seconds: float = 2.0
    context_padding_seconds: float = 1.0
    minimum_evidence_score: float = 0.25
    normalization_clip: float = 3.0
    target_duration_seconds: float = 8.0
    rms_weight: float = 0.35
    relative_energy_weight: float = 0.25
    spectral_flux_weight: float = 0.25
    peak_weight: float = 0.15

    def validate(self) -> None:
        positive = {
            "smoothing_seconds": self.smoothing_seconds,
            "minimum_activity_seconds": self.minimum_activity_seconds,
            "minimum_candidate_seconds": self.minimum_candidate_seconds,
            "maximum_candidate_seconds": self.maximum_candidate_seconds,
            "normalization_clip": self.normalization_clip,
            "target_duration_seconds": self.target_duration_seconds,
        }
        non_negative = {
            "maximum_gap_seconds": self.maximum_gap_seconds,
            "context_padding_seconds": self.context_padding_seconds,
        }
        bounded = {
            "start_threshold": self.start_threshold,
            "continue_threshold": self.continue_threshold,
            "minimum_evidence_score": self.minimum_evidence_score,
        }
        for name, value in positive.items():
            if not math.isfinite(value) or value <= 0:
                raise AudioEventDetectionError(
                    f"{name} must be positive and finite"
                )
        for name, value in non_negative.items():
            if not math.isfinite(value) or value < 0:
                raise AudioEventDetectionError(
                    f"{name} must be non-negative and finite"
                )
        for name, value in bounded.items():
            if not math.isfinite(value) or not 0 <= value <= 1:
                raise AudioEventDetectionError(
                    f"{name} must be between 0 and 1"
                )
        if self.continue_threshold >= self.start_threshold:
            raise AudioEventDetectionError(
                "continue_threshold must be lower than start_threshold"
            )
        if self.maximum_candidate_seconds < self.minimum_candidate_seconds:
            raise AudioEventDetectionError(
                "maximum_candidate_seconds must be at least the minimum"
            )

        weights = (
            self.rms_weight,
            self.relative_energy_weight,
            self.spectral_flux_weight,
            self.peak_weight,
        )
        if any(not math.isfinite(value) or value < 0 for value in weights):
            raise AudioEventDetectionError(
                "Feature weights must be non-negative and finite"
            )
        if not math.isclose(sum(weights), 1.0, abs_tol=1e-9):
            raise AudioEventDetectionError(
                "Feature weights must sum to 1"
            )


def _finite_number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AudioEventDetectionError(f"{name} must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise AudioEventDetectionError(f"{name} must be finite")
    return result


def validate_feature_document(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict) or document.get("version") != 1:
        raise AudioEventDetectionError(
            "Expected a version 1 audio feature document"
        )
    duration = _finite_number(document.get("duration"), "duration")
    hop_seconds = _finite_number(
        document.get("hopSeconds"),
        "hopSeconds",
    )
    if duration < 0 or hop_seconds <= 0:
        raise AudioEventDetectionError(
            "duration must be non-negative and hopSeconds must be positive"
        )

    features = document.get("features")
    if not isinstance(features, list):
        raise AudioEventDetectionError("features must be an array")

    previous_start = -math.inf
    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            raise AudioEventDetectionError(
                f"features[{index}] must be an object"
            )
        start = _finite_number(
            feature.get("start"),
            f"features[{index}].start",
        )
        end = _finite_number(
            feature.get("end"),
            f"features[{index}].end",
        )
        if start < 0 or end <= start or start < previous_start:
            raise AudioEventDetectionError(
                "Feature windows must be ordered and have valid boundaries"
            )
        if end > duration + max(hop_seconds, 1e-6):
            raise AudioEventDetectionError(
                f"features[{index}] exceeds recording duration"
            )
        for feature_name in FEATURE_NAMES:
            _finite_number(
                feature.get(feature_name),
                f"features[{index}].{feature_name}",
            )
        previous_start = start
    return document


def load_feature_document(path: str | Path) -> dict[str, Any]:
    try:
        parsed = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AudioEventDetectionError(
            f"Unable to read audio features: {error}"
        ) from error
    return validate_feature_document(parsed)


def robust_feature_activity(
    values: np.ndarray,
    clip: float,
) -> tuple[np.ndarray, dict[str, float | str]]:
    """Return positive robust z-score activity scaled into [0, 1].

    Median/MAD is preferred. IQR is a secondary safeguard. For a recording
    with an exactly constant baseline and sparse activity, the median positive
    deviation supplies a bounded fallback scale. A single spike can therefore
    be represented but is still rejected by smoothing and duration rules.
    """

    if values.size == 0:
        return values.astype(np.float64), {
            "median": 0.0,
            "scale": 0.0,
            "method": "empty",
        }

    values = values.astype(np.float64, copy=False)
    median = float(np.median(values))
    deviations = np.abs(values - median)
    mad_scale = 1.4826 * float(np.median(deviations))
    q25, q75 = np.percentile(values, [25.0, 75.0])
    iqr_scale = float(q75 - q25) / 1.349
    floor = max(1e-6, abs(median) * 0.01)
    scale = max(mad_scale, iqr_scale)
    method = "mad_iqr"

    if scale < floor:
        positive = values - median
        positive = positive[positive > floor]
        if positive.size == 0:
            return np.zeros_like(values), {
                "median": median,
                "scale": 0.0,
                "method": "constant",
            }
        scale = max(float(np.median(positive)) / clip, floor)
        method = "positive_deviation_fallback"

    robust_z = np.clip((values - median) / scale, 0.0, clip)
    activity = robust_z / clip
    return activity, {
        "median": round(median, 10),
        "scale": round(scale, 10),
        "method": method,
    }


def smooth_activity(values: np.ndarray, window_count: int) -> np.ndarray:
    if values.size == 0 or window_count <= 1:
        return values.copy()
    window_count = min(window_count, values.size)
    left = (window_count - 1) // 2
    right = window_count - 1 - left
    padded = np.pad(values, (left, right), mode="edge")
    kernel = np.full(window_count, 1.0 / window_count)
    return np.convolve(padded, kernel, mode="valid")


def hysteresis_intervals(
    activity: Iterable[float],
    starts: np.ndarray,
    ends: np.ndarray,
    start_threshold: float,
    continue_threshold: float,
) -> list[tuple[float, float]]:
    """Detect intervals while carrying state across any iterable boundaries."""

    intervals: list[tuple[float, float]] = []
    active_start: float | None = None
    active_end = 0.0

    for index, value in enumerate(activity):
        numeric = float(value)
        if active_start is None:
            if numeric >= start_threshold:
                active_start = float(starts[index])
                active_end = float(ends[index])
        elif numeric >= continue_threshold:
            active_end = float(ends[index])
        else:
            intervals.append((active_start, active_end))
            active_start = None

    if active_start is not None:
        intervals.append((active_start, active_end))
    return intervals


def group_activity_intervals(
    intervals: list[tuple[float, float]],
    *,
    minimum_activity_seconds: float,
    maximum_gap_seconds: float,
) -> list[tuple[float, float]]:
    retained = [
        interval
        for interval in intervals
        if interval[1] - interval[0] >= minimum_activity_seconds
    ]
    if not retained:
        return []

    grouped = [retained[0]]
    for start, end in retained[1:]:
        previous_start, previous_end = grouped[-1]
        if start - previous_end <= maximum_gap_seconds:
            grouped[-1] = (previous_start, max(previous_end, end))
        else:
            grouped.append((start, end))
    return grouped


def _split_long_interval(
    start: float,
    end: float,
    *,
    starts: np.ndarray,
    activity: np.ndarray,
    config: DetectorConfig,
) -> list[tuple[float, float]]:
    segments: list[tuple[float, float]] = []
    cursor = start

    while end - cursor > config.maximum_candidate_seconds:
        latest = cursor + config.maximum_candidate_seconds
        earliest = min(
            latest,
            cursor
            + max(
                config.minimum_candidate_seconds,
                config.maximum_candidate_seconds * 0.6,
            ),
        )
        if end - latest < config.minimum_candidate_seconds:
            latest = end - config.minimum_candidate_seconds
        eligible = np.flatnonzero(
            (starts >= earliest) & (starts <= latest)
        )
        if eligible.size:
            cut_index = int(eligible[np.argmin(activity[eligible])])
            cut = float(starts[cut_index])
        else:
            cut = latest
        if cut <= cursor:
            cut = min(
                cursor + config.maximum_candidate_seconds,
                end,
            )
        segments.append((cursor, cut))
        cursor = cut

    if end > cursor:
        segments.append((cursor, end))
    return segments


def prepare_candidate_intervals(
    intervals: list[tuple[float, float]],
    *,
    duration: float,
    starts: np.ndarray,
    activity: np.ndarray,
    config: DetectorConfig,
) -> list[tuple[float, float]]:
    prepared: list[tuple[float, float]] = []
    for start, end in intervals:
        padded_start = max(0.0, start - config.context_padding_seconds)
        padded_end = min(duration, end + config.context_padding_seconds)
        for segment in _split_long_interval(
            padded_start,
            padded_end,
            starts=starts,
            activity=activity,
            config=config,
        ):
            if segment[1] - segment[0] >= config.minimum_candidate_seconds:
                prepared.append(segment)
    return prepared


def _reason_list(evidence: dict[str, float]) -> list[str]:
    reasons: list[str] = []
    if max(
        evidence["rmsActivity"],
        evidence["relativeEnergyActivity"],
    ) >= 0.35:
        reasons.append("sustained_energy_increase")
    if evidence["spectralActivity"] >= 0.35:
        reasons.append("frequent_spectral_change")
    if evidence["peakDensity"] >= 0.2:
        reasons.append("high_peak_density")
    if evidence["temporalConsistency"] >= 0.65:
        reasons.append("temporally_consistent_activity")
    return reasons or ["adaptive_audio_activity"]


def score_candidate(
    start: float,
    end: float,
    *,
    centers: np.ndarray,
    activities: dict[str, np.ndarray],
    combined_activity: np.ndarray,
    config: DetectorConfig,
) -> tuple[float, dict[str, float], list[str]]:
    mask = (centers >= start) & (centers <= end)
    if not np.any(mask):
        raise AudioEventDetectionError(
            "Candidate interval does not overlap feature windows"
        )

    duration = end - start
    peak_values = activities["peak"][mask]
    evidence = {
        "rmsActivity": float(np.mean(activities["rms"][mask])),
        "relativeEnergyActivity": float(
            np.mean(activities["relativeEnergy"][mask])
        ),
        "spectralActivity": float(
            np.mean(activities["spectralFlux"][mask])
        ),
        "peakDensity": float(np.mean(peak_values >= 0.66)),
        "temporalConsistency": float(
            np.mean(
                combined_activity[mask] >= config.continue_threshold
            )
        ),
        "durationSupport": min(
            duration / config.target_duration_seconds,
            1.0,
        ),
    }
    score = (
        0.25 * evidence["rmsActivity"]
        + 0.15 * evidence["relativeEnergyActivity"]
        + 0.20 * evidence["spectralActivity"]
        + 0.15 * evidence["peakDensity"]
        + 0.15 * evidence["temporalConsistency"]
        + 0.10 * evidence["durationSupport"]
    )
    rounded_evidence = {
        name: round(min(max(value, 0.0), 1.0), 6)
        for name, value in evidence.items()
    }
    bounded_score = round(min(max(score, 0.0), 1.0), 6)
    return bounded_score, rounded_evidence, _reason_list(rounded_evidence)


def detect_audio_events(
    feature_document: dict[str, Any],
    config: DetectorConfig | None = None,
) -> dict[str, Any]:
    resolved = config or DetectorConfig()
    resolved.validate()
    document = validate_feature_document(feature_document)
    features = document["features"]
    duration = float(document["duration"])

    if not features:
        return _build_output(
            duration,
            resolved,
            {},
            [],
        )

    starts = np.asarray(
        [float(feature["start"]) for feature in features],
        dtype=np.float64,
    )
    ends = np.asarray(
        [float(feature["end"]) for feature in features],
        dtype=np.float64,
    )
    centers = (starts + ends) / 2.0
    smoothing_windows = max(
        1,
        round(
            resolved.smoothing_seconds
            / float(document["hopSeconds"])
        ),
    )

    activities: dict[str, np.ndarray] = {}
    normalization: dict[str, dict[str, float | str]] = {}
    for name in FEATURE_NAMES:
        values = np.asarray(
            [float(feature[name]) for feature in features],
            dtype=np.float64,
        )
        normalized, statistics = robust_feature_activity(
            values,
            resolved.normalization_clip,
        )
        activities[name] = smooth_activity(
            normalized,
            smoothing_windows,
        )
        normalization[name] = statistics

    combined = (
        resolved.rms_weight * activities["rms"]
        + resolved.relative_energy_weight
        * activities["relativeEnergy"]
        + resolved.spectral_flux_weight
        * activities["spectralFlux"]
        + resolved.peak_weight * activities["peak"]
    )
    raw_intervals = hysteresis_intervals(
        combined,
        starts,
        ends,
        resolved.start_threshold,
        resolved.continue_threshold,
    )
    grouped = group_activity_intervals(
        raw_intervals,
        minimum_activity_seconds=resolved.minimum_activity_seconds,
        maximum_gap_seconds=resolved.maximum_gap_seconds,
    )
    prepared = prepare_candidate_intervals(
        grouped,
        duration=duration,
        starts=starts,
        activity=combined,
        config=resolved,
    )

    candidates: list[dict[str, Any]] = []
    for start, end in prepared:
        score, evidence, reasons = score_candidate(
            start,
            end,
            centers=centers,
            activities=activities,
            combined_activity=combined,
            config=resolved,
        )
        if score < resolved.minimum_evidence_score:
            continue
        candidates.append(
            {
                "start": round(start, 6),
                "end": round(end, 6),
                "score": score,
                "reasons": reasons,
                "evidence": evidence,
            }
        )

    candidates.sort(
        key=lambda item: (
            float(item["start"]),
            float(item["end"]),
            -float(item["score"]),
        )
    )
    for index, candidate in enumerate(candidates, start=1):
        candidate["id"] = f"audio-{index:04d}"

    return _build_output(
        duration,
        resolved,
        normalization,
        candidates,
    )


def _build_output(
    duration: float,
    config: DetectorConfig,
    normalization: dict[str, dict[str, float | str]],
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "version": 1,
        "duration": round(duration, 6),
        "detector": DETECTOR_NAME,
        "scoreMeaning": (
            "Bounded audio-evidence strength in [0, 1]; "
            "not a calibrated highlight probability"
        ),
        "timeUnit": "seconds",
        "config": asdict(config),
        "normalization": normalization,
        "candidates": candidates,
    }


def write_candidate_json(
    result: dict[str, Any],
    output_path: str | Path,
    *,
    pretty: bool = False,
) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            result,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    return path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Detect audio activity candidates from feature JSON."
    )
    parser.add_argument("features", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--smoothing-seconds", type=float, default=1.0)
    parser.add_argument("--start-threshold", type=float, default=0.38)
    parser.add_argument("--continue-threshold", type=float, default=0.18)
    parser.add_argument(
        "--minimum-activity-seconds",
        type=float,
        default=0.5,
    )
    parser.add_argument(
        "--minimum-candidate-seconds",
        type=float,
        default=2.0,
    )
    parser.add_argument(
        "--maximum-candidate-seconds",
        type=float,
        default=45.0,
    )
    parser.add_argument(
        "--maximum-gap-seconds",
        type=float,
        default=2.0,
    )
    parser.add_argument(
        "--context-padding-seconds",
        type=float,
        default=1.0,
    )
    parser.add_argument(
        "--minimum-evidence-score",
        type=float,
        default=0.25,
    )
    parser.add_argument("--pretty", action="store_true")
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    config = DetectorConfig(
        smoothing_seconds=args.smoothing_seconds,
        start_threshold=args.start_threshold,
        continue_threshold=args.continue_threshold,
        minimum_activity_seconds=args.minimum_activity_seconds,
        minimum_candidate_seconds=args.minimum_candidate_seconds,
        maximum_candidate_seconds=args.maximum_candidate_seconds,
        maximum_gap_seconds=args.maximum_gap_seconds,
        context_padding_seconds=args.context_padding_seconds,
        minimum_evidence_score=args.minimum_evidence_score,
    )
    try:
        result = detect_audio_events(
            load_feature_document(args.features),
            config,
        )
        output = write_candidate_json(
            result,
            args.output,
            pretty=args.pretty,
        )
    except AudioEventDetectionError as error:
        print(f"Audio event detection failed: {error}", file=sys.stderr)
        return 2

    print(
        json.dumps(
            {
                "event": "audio.events.detected",
                "input": str(args.features),
                "output": str(output),
                "duration": result["duration"],
                "candidates": len(result["candidates"]),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
