import { sql } from "drizzle-orm";
import { closeDatabase, db } from "@/db";

type OutboxStatusRow = {
  status: string;
  event_count: number;
  total_attempts: number;
  max_attempts: number;
  oldest_created_at: Date | null;
  oldest_age_seconds: number | null;
};

type PendingEventRow = {
  id: string;
  processing_job_id: string;
  status: string;
  attempt_count: number;
  next_attempt_at: Date;
  claim_expires_at: Date | null;
  last_error: string | null;
  age_seconds: number;
};

async function main() {
  const [statuses, pendingEvents] = await Promise.all([
    db.execute<OutboxStatusRow>(sql`
    select
      status::text,
      count(*)::int as event_count,
      coalesce(sum(attempt_count), 0)::int as total_attempts,
      coalesce(max(attempt_count), 0)::int as max_attempts,
      min(created_at) as oldest_created_at,
      extract(
        epoch from (now() - min(created_at))
      )::int as oldest_age_seconds
    from processing_outbox
    group by status
    order by status
  `),
    db.execute<PendingEventRow>(sql`
      select
        id,
        processing_job_id,
        status::text,
        attempt_count,
        next_attempt_at,
        claim_expires_at,
        last_error,
        extract(epoch from (now() - created_at))::int
          as age_seconds
      from processing_outbox
      where status <> 'published'
      order by created_at
      limit 20
    `),
  ]);

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        statuses,
        pendingEvents,
      },
      null,
      2
    )
  );
}

void main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
