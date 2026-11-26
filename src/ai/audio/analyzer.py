"""Streaming acoustic feature extraction for PCM WAV recordings.

Feature definitions:

* ``rms``: root mean square of full-scale-normalized mono samples. This is a
  raw per-window amplitude measure in [0, 1], not normalized across a file.
* ``peak``: maximum absolute full-scale-normalized sample in [0, 1].
* ``spectralFlux``: Euclidean norm of positive changes between adjacent
  L2-normalized Hann-windowed magnitude spectra. It measures change, not an
  event class, and normally lies between 0 and sqrt(2).
* ``relativeEnergy``: current RMS divided by current RMS plus the median RMS
  of preceding windows in a configurable local baseline. Values above 0.5
  are louder than the trailing baseline; silence is 0.

The reader processes PCM WAV frames in blocks and retains only samples needed
for overlapping windows, the previous spectrum, and rolling RMS values.
"""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys
from typing import Any, Iterator
import wave

import numpy as np
from scipy.signal import get_window


EPSILON = 1e-12


class AudioAnalysisError(RuntimeError):
    """Raised when a WAV cannot be decoded or analyzed safely."""


@dataclass(frozen=True)
class AnalysisConfig:
    window_seconds: float = 0.5
    hop_seconds: float = 0.25
    baseline_seconds: float = 10.0
    block_seconds: float = 60.0

    def validate(self) -> None:
        values = {
            "window_seconds": self.window_seconds,
            "hop_seconds": self.hop_seconds,
            "baseline_seconds": self.baseline_seconds,
            "block_seconds": self.block_seconds,
        }
        for name, value in values.items():
            if not math.isfinite(value) or value <= 0:
                raise AudioAnalysisError(f"{name} must be positive and finite")


def _decode_pcm(
    raw: bytes,
    sample_width: int,
    channels: int,
) -> np.ndarray:
    if not raw:
        return np.empty(0, dtype=np.float64)

    if sample_width == 1:
        samples = np.frombuffer(raw, dtype=np.uint8).astype(np.float64)
        samples = (samples - 128.0) / 128.0
    elif sample_width == 2:
        samples = np.frombuffer(raw, dtype="<i2").astype(np.float64)
        samples /= 32768.0
    elif sample_width == 3:
        byte_rows = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        values = (
            byte_rows[:, 0].astype(np.int32)
            | (byte_rows[:, 1].astype(np.int32) << 8)
            | (byte_rows[:, 2].astype(np.int32) << 16)
        )
        values = (values ^ 0x800000) - 0x800000
        samples = values.astype(np.float64) / 8388608.0
    elif sample_width == 4:
        samples = np.frombuffer(raw, dtype="<i4").astype(np.float64)
        samples /= 2147483648.0
    else:
        raise AudioAnalysisError(
            f"Unsupported PCM sample width: {sample_width} bytes"
        )

    if samples.size % channels != 0:
        raise AudioAnalysisError("WAV sample data is not channel-aligned")

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    return np.clip(samples, -1.0, 1.0)


def _iter_windows(
    reader: wave.Wave_read,
    sample_rate: int,
    channels: int,
    sample_width: int,
    total_frames: int,
    window_frames: int,
    hop_frames: int,
    block_frames: int,
) -> Iterator[tuple[int, np.ndarray]]:
    buffer = np.empty(0, dtype=np.float64)
    buffer_start = 0
    next_start = 0
    frames_read = 0

    while frames_read < total_frames:
        requested = min(block_frames, total_frames - frames_read)
        raw = reader.readframes(requested)
        chunk = _decode_pcm(raw, sample_width, channels)
        if chunk.size == 0:
            break

        buffer = (
            chunk
            if buffer.size == 0
            else np.concatenate((buffer, chunk))
        )
        frames_read += int(chunk.size)
        buffered_end = buffer_start + int(buffer.size)

        while next_start + window_frames <= buffered_end:
            local_start = next_start - buffer_start
            yield (
                next_start,
                buffer[local_start : local_start + window_frames],
            )
            next_start += hop_frames

        discard = max(0, next_start - buffer_start)
        if discard:
            buffer = buffer[discard:]
            buffer_start += discard

    # Include every final partial window whose start lies inside the file.
    while next_start < total_frames:
        local_start = next_start - buffer_start
        if local_start < 0 or local_start >= buffer.size:
            break
        yield next_start, buffer[local_start : local_start + window_frames]
        next_start += hop_frames


def _finite(value: float, feature_name: str) -> float:
    numeric = float(value)
    if not math.isfinite(numeric):
        raise AudioAnalysisError(
            f"{feature_name} produced a non-finite value"
        )
    return numeric


def analyze_wav(
    input_path: str | Path,
    config: AnalysisConfig | None = None,
) -> dict[str, Any]:
    """Analyze a PCM WAV without loading the complete recording into memory."""

    resolved_config = config or AnalysisConfig()
    resolved_config.validate()
    input_path = Path(input_path)

    try:
        reader = wave.open(str(input_path), "rb")
    except (EOFError, OSError, wave.Error) as error:
        raise AudioAnalysisError(
            f"Unable to read PCM WAV: {error}"
        ) from error

    with reader:
        sample_rate = reader.getframerate()
        channels = reader.getnchannels()
        sample_width = reader.getsampwidth()
        total_frames = reader.getnframes()

        if reader.getcomptype() != "NONE":
            raise AudioAnalysisError("Compressed WAV input is not supported")
        if sample_rate <= 0:
            raise AudioAnalysisError("WAV sample rate must be positive")
        if channels <= 0:
            raise AudioAnalysisError("WAV channel count must be positive")

        window_frames = max(
            1, round(resolved_config.window_seconds * sample_rate)
        )
        hop_frames = max(
            1, round(resolved_config.hop_seconds * sample_rate)
        )
        block_frames = max(
            window_frames,
            round(resolved_config.block_seconds * sample_rate),
        )
        baseline_windows = max(
            1,
            round(
                resolved_config.baseline_seconds
                / resolved_config.hop_seconds
            ),
        )

        analysis_window = get_window(
            "hann",
            window_frames,
            fftbins=True,
        ).astype(np.float64)
        previous_spectrum: np.ndarray | None = None
        recent_rms: deque[float] = deque(maxlen=baseline_windows)
        features: list[dict[str, float]] = []

        for start_frame, samples in _iter_windows(
            reader,
            sample_rate,
            channels,
            sample_width,
            total_frames,
            window_frames,
            hop_frames,
            block_frames,
        ):
            sample_count = int(samples.size)
            if sample_count == 0:
                continue

            rms = math.sqrt(
                float(np.dot(samples, samples)) / sample_count
            )
            peak = float(np.max(np.abs(samples)))

            padded = np.zeros(window_frames, dtype=np.float64)
            padded[:sample_count] = samples
            magnitude = np.abs(
                np.fft.rfft(padded * analysis_window)
            )
            magnitude_norm = float(np.linalg.norm(magnitude))
            if magnitude_norm > EPSILON:
                normalized_spectrum = magnitude / magnitude_norm
            else:
                normalized_spectrum = np.zeros_like(magnitude)

            if previous_spectrum is None:
                spectral_flux = 0.0
            else:
                positive_change = np.maximum(
                    normalized_spectrum - previous_spectrum,
                    0.0,
                )
                spectral_flux = float(
                    np.linalg.norm(positive_change)
                )
            previous_spectrum = normalized_spectrum

            baseline = (
                float(np.median(np.fromiter(recent_rms, dtype=np.float64)))
                if recent_rms
                else rms
            )
            if rms <= EPSILON and baseline <= EPSILON:
                relative_energy = 0.0
            else:
                relative_energy = rms / (
                    rms + baseline + EPSILON
                )
            recent_rms.append(rms)

            start_seconds = start_frame / sample_rate
            end_seconds = min(
                (start_frame + sample_count) / sample_rate,
                total_frames / sample_rate,
            )
            features.append(
                {
                    "start": round(
                        _finite(start_seconds, "start"),
                        6,
                    ),
                    "end": round(
                        _finite(end_seconds, "end"),
                        6,
                    ),
                    "rms": round(_finite(rms, "rms"), 10),
                    "peak": round(_finite(peak, "peak"), 10),
                    "spectralFlux": round(
                        _finite(spectral_flux, "spectralFlux"),
                        10,
                    ),
                    "relativeEnergy": round(
                        _finite(relative_energy, "relativeEnergy"),
                        10,
                    ),
                }
            )

    duration = total_frames / sample_rate
    return {
        "version": 1,
        "sampleRate": sample_rate,
        "channels": channels,
        "duration": round(_finite(duration, "duration"), 6),
        "windowSeconds": resolved_config.window_seconds,
        "hopSeconds": resolved_config.hop_seconds,
        "baselineSeconds": resolved_config.baseline_seconds,
        "featureDefinitions": {
            "rms": "full-scale-normalized RMS amplitude [0, 1]",
            "peak": "full-scale-normalized peak amplitude [0, 1]",
            "spectralFlux": (
                "positive L2 difference of adjacent L2-normalized spectra"
            ),
            "relativeEnergy": (
                "RMS / (RMS + trailing median RMS); >0.5 is elevated"
            ),
        },
        "features": features,
    }


def write_feature_json(
    result: dict[str, Any],
    output_path: str | Path,
    *,
    pretty: bool = False,
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            result,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    return output_path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract timestamped acoustic features from a PCM WAV."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--window-seconds", type=float, default=0.5)
    parser.add_argument("--hop-seconds", type=float, default=0.25)
    parser.add_argument("--baseline-seconds", type=float, default=10.0)
    parser.add_argument("--block-seconds", type=float, default=60.0)
    parser.add_argument("--pretty", action="store_true")
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    config = AnalysisConfig(
        window_seconds=args.window_seconds,
        hop_seconds=args.hop_seconds,
        baseline_seconds=args.baseline_seconds,
        block_seconds=args.block_seconds,
    )

    try:
        result = analyze_wav(args.input, config)
        output = write_feature_json(
            result,
            args.output,
            pretty=args.pretty,
        )
    except AudioAnalysisError as error:
        print(f"Audio analysis failed: {error}", file=sys.stderr)
        return 2

    print(
        json.dumps(
            {
                "event": "audio.analysis.completed",
                "input": str(args.input),
                "output": str(output),
                "duration": result["duration"],
                "windows": len(result["features"]),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
