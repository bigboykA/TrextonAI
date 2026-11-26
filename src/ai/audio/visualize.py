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


def visualize_features(
    feature_path: str | Path,
    output_path: str | Path,
    *,
    transcript_path: str | Path | None = None,
    highlights_path: str | Path | None = None,
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

    figure, axes = plt.subplots(
        4,
        1,
        figsize=(16, 10),
        sharex=True,
        constrained_layout=True,
    )
    figure.suptitle(
        (
            f"Trexton audio features · {data['duration']:.1f}s · "
            f"{data['sampleRate']} Hz"
        ),
        fontsize=14,
        fontweight="bold",
    )

    for axis, (feature_name, label, color) in zip(
        axes,
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

        # Transcript starts provide timing context without rendering text over
        # multi-hour plots. Cap lines to keep dense transcripts readable.
        for segment in transcript[:200]:
            axis.axvline(
                float(segment["start"]),
                color="#777777",
                alpha=0.08,
                linewidth=0.5,
            )

    axes[-1].set_xlabel("Recording time (seconds)")
    axes[-1].set_xlim(0, max(float(data["duration"]), 0.01))
    if highlights:
        axes[0].legend(loc="upper right", frameon=False)

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
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    output = visualize_features(
        args.features,
        args.output,
        transcript_path=args.transcript,
        highlights_path=args.highlights,
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
