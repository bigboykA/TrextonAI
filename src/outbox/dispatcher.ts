import { randomUUID } from "node:crypto";
import os from "node:os";
import { closeDatabase } from "@/db";
import { videoQueue } from "@/lib/video-queue";
import {
  claimOutboxEvents,
  logOutboxEvent,
  processWithConcurrency,
  publishClaimedEvent,
} from "@/outbox/processing-outbox";

function integerSetting(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : fallback;

  if (
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(
      `${name} must be an integer from ${minimum} to ${maximum}`
    );
  }

  return parsed;
}

const config = {
  pollIntervalMs: integerSetting(
    "OUTBOX_POLL_INTERVAL_MS",
    2_000,
    250,
    60_000
  ),
  batchSize: integerSetting(
    "OUTBOX_BATCH_SIZE",
    20,
    1,
    100
  ),
  concurrency: integerSetting(
    "OUTBOX_CONCURRENCY",
    4,
    1,
    20
  ),
  leaseMs: integerSetting(
    "OUTBOX_LEASE_MS",
    30_000,
    5_000,
    10 * 60_000
  ),
  publishTimeoutMs: integerSetting(
    "OUTBOX_PUBLISH_TIMEOUT_MS",
    5_000,
    500,
    60_000
  ),
  retryBaseMs: integerSetting(
    "OUTBOX_RETRY_BASE_MS",
    2_000,
    250,
    60_000
  ),
  retryMaxMs: integerSetting(
    "OUTBOX_RETRY_MAX_MS",
    5 * 60_000,
    1_000,
    24 * 60 * 60_000
  ),
};

if (config.leaseMs <= config.publishTimeoutMs + 1_000) {
  throw new Error(
    "OUTBOX_LEASE_MS must exceed OUTBOX_PUBLISH_TIMEOUT_MS by at least 1000ms"
  );
}

const instanceId = `${os.hostname()}:${process.pid}:${randomUUID()}`;
let stopping = false;

function requestShutdown(signal: string) {
  if (stopping) return;
  stopping = true;

  logOutboxEvent("outbox.dispatcher_stopping", {
    dispatcherId: instanceId,
    signal,
  });
}

process.on("SIGINT", () => requestShutdown("SIGINT"));
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

videoQueue.on("error", (error) => {
  logOutboxEvent("outbox.redis_error", {
    dispatcherId: instanceId,
    error: error.message || error.name || String(error),
  });
});

async function wait(milliseconds: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function dispatchBatch() {
  const events = await claimOutboxEvents(
    instanceId,
    config.batchSize,
    config.leaseMs
  );

  await processWithConcurrency(
    events,
    config.concurrency,
    async (event) => {
      try {
        await publishClaimedEvent(event, {
          instanceId,
          publishTimeoutMs: config.publishTimeoutMs,
          retryBaseMs: config.retryBaseMs,
          retryMaxMs: config.retryMaxMs,
        });
      } catch (error) {
        logOutboxEvent("outbox.dispatch_unexpected_error", {
          dispatcherId: instanceId,
          eventId: event.id,
          processingJobId: event.processingJobId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }
  );

  return events.length;
}

async function main() {
  logOutboxEvent("outbox.dispatcher_started", {
    dispatcherId: instanceId,
    ...config,
  });

  const runOnce = process.env.OUTBOX_RUN_ONCE === "1";

  while (!stopping) {
    try {
      const count = await dispatchBatch();

      if (runOnce) {
        break;
      }

      if (count === 0) {
        await wait(config.pollIntervalMs);
      }
    } catch (error) {
      logOutboxEvent("outbox.dispatcher_error", {
        dispatcherId: instanceId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      if (runOnce) {
        process.exitCode = 1;
        break;
      }

      await wait(config.pollIntervalMs);
    }
  }

  await Promise.allSettled([
    videoQueue.close(),
    closeDatabase(),
  ]);

  logOutboxEvent("outbox.dispatcher_stopped", {
    dispatcherId: instanceId,
  });
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "outbox.dispatcher_fatal",
      dispatcherId: instanceId,
      error:
        error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
});
