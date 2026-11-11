
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

export async function transcribeAudio(
  inputPath: string,
  outputPath: string
): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  const pythonPath = path.join(
    process.cwd(),
    ".venv",
    "bin",
    "python"
  );

  const scriptPath = path.join(
    process.cwd(),
    "src",
    "ai",
    "transcribe.py"
  );

  return new Promise((resolve, reject) => {
    const process = spawn(pythonPath, [
      scriptPath,
      inputPath,
      outputPath,
    ]);

    process.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    process.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(
          new Error(`Transcription failed with code ${code}`)
        );
      }
    });
  });
}
