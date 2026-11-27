"""Evaluate audio event intervals against independently reviewed annotations."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
from scipy.optimize import linear_sum_assignment


class AudioEventEvaluationError(RuntimeError):
    """Raised when candidate or annotation input is invalid."""


@dataclass(frozen=True)
class Interval:
    start: float
    end: float
    score: float = 1.0


def interval_iou(left: Interval, right: Interval) -> float:
    intersection = max(
        0.0,
        min(left.end, right.end) - max(left.start, right.start),
    )
    union = max(left.end, right.end) - min(left.start, right.start)
    return intersection / union if union > 0 else 0.0


def match_intervals(
    predictions: list[Interval],
    references: list[Interval],
    iou_threshold: float,
) -> list[tuple[int, int, float]]:
    """Return maximum-total-IoU one-to-one matches above the threshold."""

    if not 0 <= iou_threshold <= 1:
        raise AudioEventEvaluationError(
            "IoU threshold must be between 0 and 1"
        )
    if not predictions or not references:
        return []

    ious = np.asarray(
        [
            [interval_iou(prediction, reference) for reference in references]
            for prediction in predictions
        ],
        dtype=np.float64,
    )
    eligible = np.where(ious >= iou_threshold, ious, 0.0)
    rows, columns = linear_sum_assignment(eligible, maximize=True)
    matches = [
        (int(row), int(column), float(ious[row, column]))
        for row, column in zip(rows, columns, strict=True)
        if ious[row, column] >= iou_threshold
    ]
    return sorted(matches)


def _finite(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AudioEventEvaluationError(f"{name} must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise AudioEventEvaluationError(f"{name} must be finite")
    return result


def _validated_interval(
    value: Any,
    name: str,
    *,
    duration: float,
    score: float = 1.0,
) -> Interval:
    if not isinstance(value, dict):
        raise AudioEventEvaluationError(f"{name} must be an object")
    start = _finite(value.get("start"), f"{name}.start")
    end = _finite(value.get("end"), f"{name}.end")
    if start < 0 or end <= start or end > duration + 1e-6:
        raise AudioEventEvaluationError(
            f"{name} has invalid recording boundaries"
        )
    return Interval(start=start, end=end, score=score)


def load_candidate_document(
    path: str | Path,
) -> tuple[float, list[Interval]]:
    try:
        document = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AudioEventEvaluationError(
            f"Unable to read candidates: {error}"
        ) from error

    if (
        not isinstance(document, dict)
        or document.get("version") != 1
        or document.get("detector") != "audio_event_v1"
    ):
        raise AudioEventEvaluationError(
            "Expected an audio_event_v1 candidate document"
        )
    duration = _finite(document.get("duration"), "duration")
    values = document.get("candidates")
    if duration < 0 or not isinstance(values, list):
        raise AudioEventEvaluationError(
            "Candidate duration and candidates are invalid"
        )

    candidates: list[Interval] = []
    for index, value in enumerate(values):
        score = (
            _finite(value.get("score"), f"candidates[{index}].score")
            if isinstance(value, dict)
            else math.nan
        )
        if not 0 <= score <= 1:
            raise AudioEventEvaluationError(
                f"candidates[{index}].score must be between 0 and 1"
            )
        candidates.append(
            _validated_interval(
                value,
                f"candidates[{index}]",
                duration=duration,
                score=score,
            )
        )
    return duration, candidates


def load_reviewed_references(
    path: str | Path,
    recording_id: str,
    candidate_duration: float,
) -> tuple[list[Interval], dict[str, int]]:
    try:
        document = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AudioEventEvaluationError(
            f"Unable to read annotations: {error}"
        ) from error
    if not isinstance(document, dict) or document.get("version") != 1:
        raise AudioEventEvaluationError(
            "Expected a version 1 annotation document"
        )
    recordings = document.get("recordings")
    if not isinstance(recordings, list):
        raise AudioEventEvaluationError("recordings must be an array")

    recording = next(
        (
            item
            for item in recordings
            if isinstance(item, dict)
            and item.get("recordingId") == recording_id
        ),
        None,
    )
    if recording is None:
        raise AudioEventEvaluationError(
            f"Recording {recording_id!r} is not present in annotations"
        )
    duration_value = recording.get("duration", candidate_duration)
    duration = _finite(duration_value, "recording.duration")
    if abs(duration - candidate_duration) > 1.0:
        raise AudioEventEvaluationError(
            "Annotation and candidate durations differ by more than one second"
        )
    annotations = recording.get("annotations")
    if not isinstance(annotations, list):
        raise AudioEventEvaluationError(
            "recording.annotations must be an array"
        )

    references: list[Interval] = []
    counts = {
        "confirmedKeep": 0,
        "confirmedReject": 0,
        "uncertain": 0,
    }
    for index, value in enumerate(annotations):
        interval = _validated_interval(
            value,
            f"annotations[{index}]",
            duration=duration,
        )
        keep = value.get("keep")
        confidence = value.get("confidence", "uncertain")
        if keep not in (True, False, None):
            raise AudioEventEvaluationError(
                f"annotations[{index}].keep must be true, false, or null"
            )
        if confidence not in ("confirmed", "uncertain"):
            raise AudioEventEvaluationError(
                f"annotations[{index}].confidence is invalid"
            )
        if confidence == "uncertain" or keep is None:
            counts["uncertain"] += 1
        elif keep:
            counts["confirmedKeep"] += 1
            references.append(interval)
        else:
            counts["confirmedReject"] += 1
    return references, counts


def interval_coverage(
    intervals: list[Interval],
    duration: float,
) -> float:
    if duration <= 0 or not intervals:
        return 0.0
    ordered = sorted(intervals, key=lambda item: (item.start, item.end))
    covered = 0.0
    current_start = ordered[0].start
    current_end = ordered[0].end
    for interval in ordered[1:]:
        if interval.start <= current_end:
            current_end = max(current_end, interval.end)
        else:
            covered += current_end - current_start
            current_start, current_end = interval.start, interval.end
    covered += current_end - current_start
    return min(max(covered / duration, 0.0), 1.0)


def calculate_metrics(
    predictions: list[Interval],
    references: list[Interval],
    *,
    duration: float,
    iou_threshold: float,
) -> dict[str, Any]:
    matches = match_intervals(
        predictions,
        references,
        iou_threshold,
    )
    true_positives = len(matches)
    false_positives = len(predictions) - true_positives
    false_negatives = len(references) - true_positives
    precision = (
        true_positives / len(predictions) if predictions else 0.0
    )
    recall = true_positives / len(references) if references else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall > 0
        else 0.0
    )
    mean_iou = (
        float(np.mean([match[2] for match in matches]))
        if matches
        else 0.0
    )
    start_error = (
        float(
            np.mean(
                [
                    abs(
                        predictions[prediction_index].start
                        - references[reference_index].start
                    )
                    for prediction_index, reference_index, _ in matches
                ]
            )
        )
        if matches
        else None
    )
    end_error = (
        float(
            np.mean(
                [
                    abs(
                        predictions[prediction_index].end
                        - references[reference_index].end
                    )
                    for prediction_index, reference_index, _ in matches
                ]
            )
        )
        if matches
        else None
    )
    hours = duration / 3600.0
    return {
        "candidateCount": len(predictions),
        "referenceCount": len(references),
        "truePositives": true_positives,
        "falsePositives": false_positives,
        "falseNegatives": false_negatives,
        "eventPrecision": round(precision, 6),
        "eventRecall": round(recall, 6),
        "f1": round(f1, 6),
        "meanMatchedIoU": round(mean_iou, 6),
        "meanAbsoluteStartErrorSeconds": (
            round(start_error, 6) if start_error is not None else None
        ),
        "meanAbsoluteEndErrorSeconds": (
            round(end_error, 6) if end_error is not None else None
        ),
        "falsePositivesPerHour": round(
            false_positives / hours if hours > 0 else 0.0,
            6,
        ),
        "candidateCoverage": round(
            interval_coverage(predictions, duration),
            6,
        ),
        "matches": [
            {
                "candidateIndex": prediction_index,
                "referenceIndex": reference_index,
                "iou": round(iou, 6),
            }
            for prediction_index, reference_index, iou in matches
        ],
    }


def evaluate_candidates(
    candidates: list[Interval],
    references: list[Interval],
    *,
    duration: float,
    annotation_counts: dict[str, int],
    iou_threshold: float = 0.3,
    score_threshold: float = 0.0,
    sweep_thresholds: list[float] | None = None,
) -> dict[str, Any]:
    if not 0 <= score_threshold <= 1:
        raise AudioEventEvaluationError(
            "Score threshold must be between 0 and 1"
        )
    thresholds = sweep_thresholds or [
        round(value, 2)
        for value in np.linspace(0.1, 0.9, 9)
    ]
    selected = [
        candidate
        for candidate in candidates
        if candidate.score >= score_threshold
    ]

    if not references:
        return {
            "version": 1,
            "available": False,
            "reason": (
                "No independently reviewed, confirmed keep annotations exist"
            ),
            "duration": round(duration, 6),
            "matchingRule": {
                "method": "maximum_total_iou_one_to_one",
                "minimumIoU": iou_threshold,
            },
            "annotationCounts": annotation_counts,
            "candidateCount": len(selected),
            "candidateCoverage": round(
                interval_coverage(selected, duration),
                6,
            ),
            "thresholdSweep": [],
        }

    metrics = calculate_metrics(
        selected,
        references,
        duration=duration,
        iou_threshold=iou_threshold,
    )
    sweep = []
    for threshold in thresholds:
        if not 0 <= threshold <= 1:
            raise AudioEventEvaluationError(
                "Sweep thresholds must be between 0 and 1"
            )
        predictions = [
            candidate
            for candidate in candidates
            if candidate.score >= threshold
        ]
        threshold_metrics = calculate_metrics(
            predictions,
            references,
            duration=duration,
            iou_threshold=iou_threshold,
        )
        sweep.append(
            {
                "scoreThreshold": threshold,
                **{
                    key: threshold_metrics[key]
                    for key in (
                        "candidateCount",
                        "eventPrecision",
                        "eventRecall",
                        "f1",
                        "falsePositivesPerHour",
                        "candidateCoverage",
                    )
                },
            }
        )

    return {
        "version": 1,
        "available": True,
        "duration": round(duration, 6),
        "matchingRule": {
            "method": "maximum_total_iou_one_to_one",
            "minimumIoU": iou_threshold,
            "notes": (
                "Each candidate and reference can participate in at most "
                "one match"
            ),
        },
        "scoreThreshold": score_threshold,
        "annotationCounts": annotation_counts,
        "metrics": metrics,
        "thresholdSweep": sweep,
        "overfittingWarning": (
            "Do not tune and report final quality on the same small review set"
        ),
    }


def annotation_template(
    recording_id: str | None = None,
    duration: float | None = None,
) -> dict[str, Any]:
    recordings: list[dict[str, Any]] = []
    if recording_id is not None:
        if duration is None or not math.isfinite(duration) or duration <= 0:
            raise AudioEventEvaluationError(
                "A positive duration is required with recording_id"
            )
        recordings.append(
            {
                "recordingId": recording_id,
                "duration": round(duration, 6),
                "annotations": [],
            }
        )
    return {
        "version": 1,
        "timeUnit": "seconds",
        "recordings": recordings,
    }


def _write_json(value: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, allow_nan=False),
        encoding="utf-8",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create or evaluate audio event review annotations."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    template_parser = subparsers.add_parser(
        "template",
        help="Create an empty annotation document",
    )
    template_parser.add_argument("output", type=Path)
    template_parser.add_argument("--recording-id")
    template_parser.add_argument("--duration", type=float)

    evaluate_parser = subparsers.add_parser(
        "evaluate",
        help="Compare candidates with reviewed annotations",
    )
    evaluate_parser.add_argument("candidates", type=Path)
    evaluate_parser.add_argument("annotations", type=Path)
    evaluate_parser.add_argument("output", type=Path)
    evaluate_parser.add_argument("--recording-id", required=True)
    evaluate_parser.add_argument(
        "--iou-threshold",
        type=float,
        default=0.3,
    )
    evaluate_parser.add_argument(
        "--score-threshold",
        type=float,
        default=0.0,
    )
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    try:
        if args.command == "template":
            result = annotation_template(
                args.recording_id,
                args.duration,
            )
            _write_json(result, args.output)
            event = {
                "event": "audio.annotations.template_created",
                "output": str(args.output),
            }
        else:
            duration, candidates = load_candidate_document(
                args.candidates
            )
            references, counts = load_reviewed_references(
                args.annotations,
                args.recording_id,
                duration,
            )
            result = evaluate_candidates(
                candidates,
                references,
                duration=duration,
                annotation_counts=counts,
                iou_threshold=args.iou_threshold,
                score_threshold=args.score_threshold,
            )
            _write_json(result, args.output)
            event = {
                "event": "audio.events.evaluated",
                "output": str(args.output),
                "available": result["available"],
            }
    except AudioEventEvaluationError as error:
        print(f"Audio event evaluation failed: {error}", file=sys.stderr)
        return 2

    print(json.dumps(event))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
