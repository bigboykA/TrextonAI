import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def transcribe_audio(input_path, output_path):
    model = WhisperModel(
        "base.en",
        device="cpu",
        compute_type="int8",
    )

    segments, info = model.transcribe(
        str(input_path),
        language="en",
        beam_size=5,
        vad_filter=True,
    )

    transcript = []

    for segment in segments:
        item = {
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
        }

        transcript.append(item)

        print(
            f"[{item['start']} - {item['end']}] "
            f"{item['text']}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)

    output_path.write_text(
        json.dumps(
            {
                "language": info.language,
                "segments": transcript,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Transcript saved to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument("input")
    parser.add_argument("output")

    args = parser.parse_args()

    transcribe_audio(
        Path(args.input),
        Path(args.output),
    )
