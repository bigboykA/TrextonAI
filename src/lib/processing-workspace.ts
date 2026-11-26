import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WORKSPACE_PREFIX = "trexton-video-";
const DEFAULT_STALE_AGE_MS = 24 * 60 * 60 * 1000;

export type ProcessingWorkspace = {
  root: string;
  sourcePath: string;
  audioPath: string;
  audioFeaturesPath: string;
  transcriptPath: string;
  clipsDir: string;
};

export async function createProcessingWorkspace():
Promise<ProcessingWorkspace> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), WORKSPACE_PREFIX)
  );
  const clipsDir = path.join(root, "clips");

  await fs.mkdir(clipsDir, { recursive: true });

  return {
    root,
    sourcePath: path.join(root, "source.mp4"),
    audioPath: path.join(root, "audio.wav"),
    audioFeaturesPath: path.join(root, "audio-features.json"),
    transcriptPath: path.join(root, "transcript.json"),
    clipsDir,
  };
}

export async function removeProcessingWorkspace(root: string) {
  const tempRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(root);

  if (
    !resolved.startsWith(
      path.join(tempRoot, WORKSPACE_PREFIX)
    )
  ) {
    throw new Error("Refusing to remove a non-Trexton workspace");
  }

  await fs.rm(resolved, {
    recursive: true,
    force: true,
  });
}

/**
 * Best-effort cleanup for workspaces left by crashes or process kills.
 * `finally` handles normal failures, but cannot run after abrupt exit.
 */
export async function cleanupStaleProcessingWorkspaces(
  maxAgeMs = DEFAULT_STALE_AGE_MS
) {
  const tempRoot = os.tmpdir();
  const cutoff = Date.now() - maxAgeMs;
  const entries = await fs.readdir(tempRoot, {
    withFileTypes: true,
  });

  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(WORKSPACE_PREFIX)
      )
      .map(async (entry) => {
        const workspace = path.join(tempRoot, entry.name);

        try {
          const stat = await fs.stat(workspace);

          if (stat.mtimeMs < cutoff) {
            await removeProcessingWorkspace(workspace);
          }
        } catch (error) {
          console.warn(
            `Unable to inspect stale workspace ${entry.name}:`,
            error
          );
        }
      })
  );
}
