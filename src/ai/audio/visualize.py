"""Render development-only audio feature diagnostics as a PNG."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

try:
    from .evaluation import Interval, match_intervals
except ImportError:
    from evaluation import Interval, match_intervals


FEATURE_PLOTS = (
    ("rms", "RMS energy", "#247a68"),
    ("peak", "Peak amplitude", "#9a6b2f"),
    ("spectralFlux", "Spectral flux", "#6b5ea8"),
    ("relativeEnergy", "Relative energy", "#b54e5c"),
)


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _intervals(
    path: Path | None,
    keys: tuple[str, ...],
) -> list[dict[str, Any]]:
    if path is None:
        return []
    data = _load_json(path)
    if isinstance(data, list):
        values = data
    elif isinstance(data, dict):
        values = []
        for key in keys:
            candidate = data.get(key)
            if isinstance(candidate, list):
                values = candidate
                break
    else:
        values = []

    return [
        value
        for value in values
        if isinstance(value, dict)
        and isinstance(value.get("start"), (int, float))
        and isinstance(value.get("end"), (int, float))
    ]


def _plot_indices(length: int, limit: int = 20_000) -> np.ndarray:
    if length <= limit:
        return np.arange(length)
    return np.unique(
        np.linspace(0, length - 1, limit, dtype=np.int64)
    )


def _reviewed_references(
    path: Path | None,
    recording_id: str | None,
) -> list[dict[str, Any]]:
    if path is None:
        return []
    if not recording_id:
        raise ValueError(
            "--recording-id is required with --annotations"
        )
    data = _load_json(path)
    recordings = (
        data.get("recordings", [])
        if isinstance(data, dict)
        else []
    )
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
        raise ValueError(
            f"Recording {recording_id!r} is absent from annotations"
        )
    annotations = recording.get("annotations", [])
    return [
        item
        for item in annotations
        if isinstance(item, dict)
        and item.get("keep") is True
        and item.get("confidence") == "confirmed"
        and isinstance(item.get("start"), (int, float))
        and isinstance(item.get("end"), (int, float))
    ]


def visualize_features(
    feature_path: str | Path,
    output_path: str | Path,
    *,
    transcript_path: str | Path | None = None,
    highlights_path: str | Path | None = None,
    candidates_path: str | Path | None = None,
    annotations_path: str | Path | None = None,
    recording_id: str | None = None,
    iou_threshold: float = 0.3,
) -> Path:
    feature_path = Path(feature_path)
    output_path = Path(output_path)
    data = _load_json(feature_path)
    features = data.get("features", [])
    if not isinstance(features, list) or not features:
        raise ValueError("Feature JSON does not contain any windows")

    starts = np.asarray(
        [float(item["start"]) for item in features],
        dtype=np.float64,
    )
    indices = _plot_indices(len(features))
    transcript = _intervals(
        Path(transcript_path) if transcript_path else None,
        ("segments",),
    )
    highlights = _intervals(
        Path(highlights_path) if highlights_path else None,
        ("highlights", "candidates", "features"),
    )
    candidates = _intervals(
        Path(candidates_path) if candidates_path else None,
        ("candidates",),
    )
    references = _reviewed_references(
        Path(annotations_path) if annotations_path else None,
        recording_id,
    )
    candidate_intervals = [
        Interval(
            float(item["start"]),
            float(item["end"]),
            float(item.get("score", 0.0)),
        )
        for item in candidates
    ]
    reference_intervals = [
        Interval(float(item["start"]), float(item["end"]))
        for item in references
    ]
    matches = match_intervals(
        candidate_intervals,
        reference_intervals,
        iou_threshold,
    )
    matched_candidates = {match[0] for match in matches}
    matched_references = {match[1] for match in matches}
    unmatched_candidates = (
        set(range(len(candidates))) - matched_candidates
    )
    unmatched_references = (
        set(range(len(references))) - matched_references
    )

    figure, axes = plt.subplots(
        5,
        1,
        figsize=(16, 12),
        sharex=True,
        constrained_layout=True,
        gridspec_kw={"height_ratios": [1, 1, 1, 1, 0.65]},
    )
    figure.suptitle(
        (
            f"Trexton audio features · {data['duration']:.1f}s · "
            f"{data['sampleRate']} Hz"
        ),
        fontsize=14,
        fontweight="bold",
    )

    feature_axes = axes[:4]
    score_axis = axes[4]
    for axis, (feature_name, label, color) in zip(
        feature_axes,
        FEATURE_PLOTS,
        strict=True,
    ):
        values = np.asarray(
            [float(item[feature_name]) for item in features],
            dtype=np.float64,
        )
        axis.plot(
            starts[indices],
            values[indices],
            color=color,
            linewidth=0.9,
        )
        axis.set_ylabel(label)
        axis.grid(alpha=0.18, linewidth=0.6)

        for highlight_index, interval in enumerate(highlights):
            axis.axvspan(
                float(interval["start"]),
                float(interval["end"]),
                color="#d29b32",
                alpha=0.16,
                label=(
                    "Known highlight interval"
                    if highlight_index == 0
                    else None
                ),
            )

        for candidate_index, candidate in enumerate(candidates):
            matched = candidate_index in matched_candidates
            color = "#2f8174" if matched or not references else "#bf4d4d"
            if not references and candidate_index == 0:
                candidate_label = "Audio candidate"
            elif matched and candidate_index == min(
                matched_candidates,
                default=-1,
            ):
                candidate_label = "Matched candidate"
            elif (
                references
                and not matched
                and candidate_index
                == min(unmatched_candidates, default=-1)
            ):
                candidate_label = "False-positive candidate"
            else:
                candidate_label = None
            axis.axvspan(
                float(candidate["start"]),
                float(candidate["end"]),
                color=color,
                alpha=0.12,
                label=candidate_label,
            )

        for reference_index, reference in enumerate(references):
            matched = reference_index in matched_references
            if matched and reference_index == min(
                matched_references,
                default=-1,
            ):
                reference_label = "Matched reference"
            elif (
                not matched
                and reference_index
                == min(unmatched_references, default=-1)
            ):
                reference_label = "Missed reference"
            else:
                reference_label = None
            axis.axvspan(
                float(reference["start"]),
                float(reference["end"]),
                color="#d29b32" if matched else "#7f56a6",
                alpha=0.18,
                label=reference_label,
            )

        # Transcript starts provide timing context without rendering text over
        # multi-hour plots. Cap lines to keep dense transcripts readable.
        for segment in transcript[:200]:
            axis.axvline(
                float(segment["start"]),
                color="#777777",
                alpha=0.08,
                linewidth=0.5,
            )

    for candidate_index, candidate in enumerate(candidates):
        start = float(candidate["start"])
        end = float(candidate["end"])
        score = float(candidate.get("score", 0.0))
        matched = candidate_index in matched_candidates
        color = "#2f8174" if matched or not references else "#bf4d4d"
        score_axis.bar(
            start,
            score,
            width=max(end - start, 0.01),
            align="edge",
            color=color,
            alpha=0.7,
        )
    for reference_index, reference in enumerate(references):
        if reference_index not in matched_references:
            score_axis.axvspan(
                float(reference["start"]),
                float(reference["end"]),
                color="#7f56a6",
                alpha=0.2,
            )
    score_axis.set_ylabel("Candidate\nscore")
    score_axis.set_ylim(0, 1.05)
    score_axis.grid(alpha=0.18, linewidth=0.6)
    score_axis.set_xlabel("Recording time (seconds)")
    score_axis.set_xlim(0, max(float(data["duration"]), 0.01))
    if highlights or candidates or references:
        feature_axes[0].legend(loc="upper right", frameon=False)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output_path, dpi=150)
    plt.close(figure)
    return output_path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Render Trexton audio feature diagnostics."
    )
    parser.add_argument("features", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--transcript", type=Path)
    parser.add_argument("--highlights", type=Path)
    parser.add_argument("--candidates", type=Path)
    parser.add_argument("--annotations", type=Path)
    parser.add_argument("--recording-id")
    parser.add_argument("--iou-threshold", type=float, default=0.3)
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    output = visualize_features(
        args.features,
        args.output,
        transcript_path=args.transcript,
        highlights_path=args.highlights,
        candidates_path=args.candidates,
        annotations_path=args.annotations,
        recording_id=args.recording_id,
        iou_threshold=args.iou_threshold,
    )
    print(
        json.dumps(
            {
                "event": "audio.visualization.completed",
                "output": str(output),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
