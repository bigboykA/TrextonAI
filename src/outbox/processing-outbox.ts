import {
  and,
  asc,
  eq,
  inArray,
  lte,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import {
  processingOutbox,
  type VideoProcessingRequestedPayload,
} from "@/db/schema";
import { publishVideoProcessingJob } from "@/lib/video-queue";

export type ClaimedOutboxEvent =
  typeof processingOutbox.$inferSelect & {
    recoveredExpiredClaim: boolean;
  };

type PublishOptions = {
  instanceId: string;
  publishTimeoutMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
};

function log(
  event: string,
  fields: Record<string, unknown>
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...fields,
    })
  );
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error);

  return message.slice(0, 2_000);
}

function validPayload(
  payload: unknown,
  processingJobId: string
): payload is VideoProcessingRequestedPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const value = payload as Record<string, unknown>;

  return (
    typeof value.videoId === "string" &&
    typeof value.jobId === "string" &&
    value.jobId === processingJobId
  );
}

export async function claimOutboxEvents(
  instanceId: string,
  batchSize: number,
  leaseMs: number
): Promise<ClaimedOutboxEvent[]> {
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + leaseMs);

  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(processingOutbox)
      .where(
        or(
          and(
            eq(processingOutbox.status, "pending"),
            lte(processingOutbox.nextAttemptAt, now)
          ),
          and(
            eq(processingOutbox.status, "claimed"),
            lte(processingOutbox.claimExpiresAt, now)
          )
        )
      )
      .orderBy(asc(processingOutbox.createdAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) {
      return [];
    }

    const expiredIds = new Set(
      candidates
        .filter((event) => event.status === "claimed")
        .map((event) => event.id)
    );
    const events = await tx
      .update(processingOutbox)
      .set({
        status: "claimed",
        claimedBy: instanceId,
        claimedAt: now,
        claimExpiresAt,
      })
      .where(
        inArray(
          processingOutbox.id,
          candidates.map((event) => event.id)
        )
      )
      .returning();

    return events.map((event) => ({
      ...event,
      recoveredExpiredClaim: expiredIds.has(event.id),
    }));
  });

  if (claimed.length > 0) {
    log("outbox.claimed", {
      dispatcherId: instanceId,
      count: claimed.length,
      eventIds: claimed.map((event) => event.id),
    });

    for (const event of claimed) {
      if (event.recoveredExpiredClaim) {
        log("outbox.expired_claim_recovered", {
          dispatcherId: instanceId,
          eventId: event.id,
          processingJobId: event.processingJobId,
        });
      }
    }
  }

  return claimed;
}

async function acknowledgePublished(
  event: ClaimedOutboxEvent,
  instanceId: string
) {
  return db.transaction(async (tx) => {
    const [published] = await tx
      .update(processingOutbox)
      .set({
        status: "published",
        publishedAt: new Date(),
        lastError: null,
        claimedBy: null,
        claimedAt: null,
        claimExpiresAt: null,
      })
      .where(
        and(
          eq(processingOutbox.id, event.id),
          eq(processingOutbox.status, "claimed"),
          eq(processingOutbox.claimedBy, instanceId)
        )
      )
      .returning({ id: processingOutbox.id });

    if (!published) {
      return false;
    }

    return true;
  });
}

async function scheduleRetry(
  event: ClaimedOutboxEvent,
  options: PublishOptions,
  error: unknown
) {
  const attemptCount = event.attemptCount + 1;
  const exponent = Math.min(attemptCount - 1, 16);
  const exponential = Math.min(
    options.retryMaxMs,
    options.retryBaseMs * 2 ** exponent
  );
  const jitter = 0.5 + Math.random();
  const delayMs = Math.max(
    options.retryBaseMs,
    Math.round(exponential * jitter)
  );
  const nextAttemptAt = new Date(Date.now() + delayMs);
  const message = errorMessage(error);

  const [updated] = await db
    .update(processingOutbox)
    .set({
      status: "pending",
      attemptCount,
      nextAttemptAt,
      lastError: message,
      claimedBy: null,
      claimedAt: null,
      claimExpiresAt: null,
    })
    .where(
      and(
        eq(processingOutbox.id, event.id),
        eq(processingOutbox.status, "claimed"),
        eq(processingOutbox.claimedBy, options.instanceId)
      )
    )
    .returning({ id: processingOutbox.id });

  if (updated) {
    log("outbox.publication_failed", {
      dispatcherId: options.instanceId,
      eventId: event.id,
      processingJobId: event.processingJobId,
      attemptCount,
      nextAttemptAt: nextAttemptAt.toISOString(),
      error: message,
    });
  }
}

export async function publishClaimedEvent(
  event: ClaimedOutboxEvent,
  options: PublishOptions
) {
  try {
    if (
      event.eventType !== "video_processing_requested" ||
      !validPayload(event.payload, event.processingJobId)
    ) {
      throw new Error("Invalid processing outbox payload");
    }

    const publication = publishVideoProcessingJob(
      event.payload.videoId,
      event.payload.jobId
    );
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        publication,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            reject(
              new Error(
                `Redis publication timed out after ${options.publishTimeoutMs}ms`
              )
            );
          }, options.publishTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const acknowledged = await acknowledgePublished(
      event,
      options.instanceId
    );

    if (!acknowledged) {
      log("outbox.acknowledgement_skipped", {
        dispatcherId: options.instanceId,
        eventId: event.id,
        processingJobId: event.processingJobId,
        reason: "claim_lost",
      });

      return false;
    }

    log("outbox.published", {
      dispatcherId: options.instanceId,
      eventId: event.id,
      processingJobId: event.processingJobId,
      attemptCount: event.attemptCount,
    });

    return true;
  } catch (error) {
    await scheduleRetry(event, options, error);
    return false;
  }
}

export async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<unknown>
) {
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      await handler(item);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(concurrency, items.length),
      },
      () => worker()
    )
  );
}

export { log as logOutboxEvent };
