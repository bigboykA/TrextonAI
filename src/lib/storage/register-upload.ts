import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  uploadSessions,
  users,
  videos,
} from "@/db/schema";
import { validateR2ObjectKey } from "@/lib/storage/r2";
import {
  isUuid,
  type UploadSession,
} from "@/lib/storage/upload-sessions";

export async function getDevelopmentUploadUserId() {
  const configured = process.env.DEV_UPLOAD_USER_ID;

  if (configured) {
    if (!isUuid(configured)) {
      throw new Error("DEV_UPLOAD_USER_ID must be a UUID");
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, configured))
      .limit(1);

    if (!user) {
      throw new Error("DEV_UPLOAD_USER_ID does not exist");
    }

    return user.id;
  }

  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .limit(2);

  if (candidates.length === 1) {
    return candidates[0].id;
  }

  throw new Error(
    candidates.length === 0
      ? "Create a development user before uploading"
      : "Set DEV_UPLOAD_USER_ID when multiple users exist"
  );
}

export async function registerCompletedUpload(
  session: UploadSession
) {
  const userId =
    session.userId ?? (await getDevelopmentUploadUserId());
  const storageKey = validateR2ObjectKey(session.objectKey);
  const title =
    session.fileName.replace(/\.mp4$/i, "").trim() ||
    "Uploaded recording";
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(videos)
      .values({
        id: session.videoId,
        userId,
        title,
        storageKey,
        status: "pending",
      })
      .onConflictDoNothing({ target: videos.id });

    const [video] = await tx
      .select({
        id: videos.id,
        userId: videos.userId,
        storageKey: videos.storageKey,
      })
      .from(videos)
      .where(eq(videos.id, session.videoId))
      .limit(1);

    if (
      !video ||
      video.userId !== userId ||
      video.storageKey !== storageKey
    ) {
      throw new Error("Video registration conflicts with existing data");
    }

    await tx
      .update(uploadSessions)
      .set({
        userId,
        status: "completed",
        updatedAt: now,
        completedAt: session.completedAt ?? now,
      })
      .where(eq(uploadSessions.id, session.id));
  });

  return {
    videoId: session.videoId,
    userId,
    storageKey,
  };
}
