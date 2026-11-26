import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export type AudioFeature = {
  start: number;
  end: number;
  rms: number;
  peak: number;
  spectralFlux: number;
  relativeEnergy: number;
};

export type AudioFeatureDocument = {
  version: 1;
  sampleRate: number;
  channels: number;
  duration: number;
  windowSeconds: number;
  hopSeconds: number;
  baselineSeconds: number;
  featureDefinitions: Record<string, string>;
  features: AudioFeature[];
};

export type AudioAnalysisOptions = {
  windowSeconds?: number;
  hopSeconds?: number;
  baselineSeconds?: number;
  blockSeconds?: number;
  pretty?: boolean;
};

function finitePositive(value: number | undefined, name: string) {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value <= 0)
  ) {
    throw new Error(`${name} must be positive and finite`);
  }
}

function isFeatureDocument(value: unknown): value is AudioFeatureDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<AudioFeatureDocument>;

  if (
    document.version !== 1 ||
    !Number.isFinite(document.sampleRate) ||
    !Number.isFinite(document.duration) ||
    !Array.isArray(document.features)
  ) {
    return false;
  }

  return document.features.every((feature) => {
    if (!feature || typeof feature !== "object") return false;
    const item = feature as Partial<AudioFeature>;
    return [
      item.start,
      item.end,
      item.rms,
      item.peak,
      item.spectralFlux,
      item.relativeEnergy,
    ].every((number) => Number.isFinite(number));
  });
}

export async function analyzeAudio(
  inputPath: string,
  outputPath: string,
  options: AudioAnalysisOptions = {}
): Promise<AudioFeatureDocument> {
  finitePositive(options.windowSeconds, "windowSeconds");
  finitePositive(options.hopSeconds, "hopSeconds");
  finitePositive(options.baselineSeconds, "baselineSeconds");
  finitePositive(options.blockSeconds, "blockSeconds");

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

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
    "audio",
    "analyzer.py"
  );
  const args = [scriptPath, inputPath, outputPath];
  const optionArgs: Array<
    [keyof AudioAnalysisOptions, string]
  > = [
    ["windowSeconds", "--window-seconds"],
    ["hopSeconds", "--hop-seconds"],
    ["baselineSeconds", "--baseline-seconds"],
    ["blockSeconds", "--block-seconds"],
  ];

  for (const [key, flag] of optionArgs) {
    const value = options[key];
    if (typeof value === "number") {
      args.push(flag, String(value));
    }
  }
  if (options.pretty) args.push("--pretty");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      console.log(data.toString().trim());
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr = `${stderr}${data.toString()}`.slice(-16_384);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Audio analysis failed with code ${code}: ${
              stderr.trim() || "no diagnostic output"
            }`
          )
        );
      }
    });
  });

  const parsed: unknown = JSON.parse(
    await fs.readFile(outputPath, "utf-8")
  );
  if (!isFeatureDocument(parsed)) {
    throw new Error("Audio analyzer returned an invalid feature document");
  }

  return parsed;
}
