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

export type AudioEventEvidence = {
  rmsActivity: number;
  relativeEnergyActivity: number;
  spectralActivity: number;
  peakDensity: number;
  temporalConsistency: number;
  durationSupport: number;
};

export type AudioEventCandidate = {
  id: string;
  start: number;
  end: number;
  score: number;
  reasons: string[];
  evidence: AudioEventEvidence;
};

export type AudioEventDocument = {
  version: 1;
  duration: number;
  detector: "audio_event_v1";
  scoreMeaning: string;
  timeUnit: "seconds";
  config: Record<string, number>;
  normalization: Record<
    string,
    { median: number; scale: number; method: string }
  >;
  candidates: AudioEventCandidate[];
};

export type AudioEventDetectionOptions = {
  smoothingSeconds?: number;
  startThreshold?: number;
  continueThreshold?: number;
  minimumActivitySeconds?: number;
  minimumCandidateSeconds?: number;
  maximumCandidateSeconds?: number;
  maximumGapSeconds?: number;
  contextPaddingSeconds?: number;
  minimumEvidenceScore?: number;
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

function finiteBounded(value: number | undefined, name: string) {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < 0 || value > 1)
  ) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

function finiteNonNegative(
  value: number | undefined,
  name: string
) {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < 0)
  ) {
    throw new Error(`${name} must be non-negative and finite`);
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

async function runAudioPython(
  scriptName: string,
  args: string[],
  operation: string
) {
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
    scriptName
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonPath, [scriptPath, ...args], {
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
            `${operation} failed with code ${code}: ${
              stderr.trim() || "no diagnostic output"
            }`
          )
        );
      }
    });
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

  const args = [inputPath, outputPath];
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

  await runAudioPython(
    "analyzer.py",
    args,
    "Audio analysis"
  );

  const parsed: unknown = JSON.parse(
    await fs.readFile(outputPath, "utf-8")
  );
  if (!isFeatureDocument(parsed)) {
    throw new Error("Audio analyzer returned an invalid feature document");
  }

  return parsed;
}

function isAudioEventDocument(
  value: unknown
): value is AudioEventDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<AudioEventDocument>;
  if (
    document.version !== 1 ||
    document.detector !== "audio_event_v1" ||
    !Number.isFinite(document.duration) ||
    !Array.isArray(document.candidates)
  ) {
    return false;
  }

  return document.candidates.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    return (
      typeof candidate.id === "string" &&
      Number.isFinite(candidate.start) &&
      Number.isFinite(candidate.end) &&
      Number.isFinite(candidate.score) &&
      Array.isArray(candidate.reasons) &&
      candidate.reasons.every(
        (reason) => typeof reason === "string"
      ) &&
      Boolean(candidate.evidence) &&
      Object.values(candidate.evidence).every((value) =>
        Number.isFinite(value)
      )
    );
  });
}

export async function detectAudioEvents(
  featurePath: string,
  outputPath: string,
  options: AudioEventDetectionOptions = {}
): Promise<AudioEventDocument> {
  const positive: Array<
    [keyof AudioEventDetectionOptions, string, string]
  > = [
    [
      "smoothingSeconds",
      "--smoothing-seconds",
      "smoothingSeconds",
    ],
    [
      "minimumActivitySeconds",
      "--minimum-activity-seconds",
      "minimumActivitySeconds",
    ],
    [
      "minimumCandidateSeconds",
      "--minimum-candidate-seconds",
      "minimumCandidateSeconds",
    ],
    [
      "maximumCandidateSeconds",
      "--maximum-candidate-seconds",
      "maximumCandidateSeconds",
    ],
  ];
  const nonNegative: Array<
    [keyof AudioEventDetectionOptions, string, string]
  > = [
    [
      "maximumGapSeconds",
      "--maximum-gap-seconds",
      "maximumGapSeconds",
    ],
    [
      "contextPaddingSeconds",
      "--context-padding-seconds",
      "contextPaddingSeconds",
    ],
  ];
  const bounded: Array<
    [keyof AudioEventDetectionOptions, string, string]
  > = [
    [
      "startThreshold",
      "--start-threshold",
      "startThreshold",
    ],
    [
      "continueThreshold",
      "--continue-threshold",
      "continueThreshold",
    ],
    [
      "minimumEvidenceScore",
      "--minimum-evidence-score",
      "minimumEvidenceScore",
    ],
  ];

  for (const [key, , name] of positive) {
    const value = options[key];
    finitePositive(
      typeof value === "number" ? value : undefined,
      name
    );
  }
  for (const [key, , name] of nonNegative) {
    const value = options[key];
    finiteNonNegative(
      typeof value === "number" ? value : undefined,
      name
    );
  }
  for (const [key, , name] of bounded) {
    const value = options[key];
    finiteBounded(
      typeof value === "number" ? value : undefined,
      name
    );
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const args = [featurePath, outputPath];
  for (const [key, flag] of [
    ...positive,
    ...nonNegative,
    ...bounded,
  ]) {
    const value = options[key];
    if (typeof value === "number") {
      args.push(flag, String(value));
    }
  }
  if (options.pretty) args.push("--pretty");

  await runAudioPython(
    "detector.py",
    args,
    "Audio event detection"
  );
  const parsed: unknown = JSON.parse(
    await fs.readFile(outputPath, "utf-8")
  );
  if (!isAudioEventDocument(parsed)) {
    throw new Error(
      "Audio event detector returned an invalid candidate document"
    );
  }
  return parsed;
}
