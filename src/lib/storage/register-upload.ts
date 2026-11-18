import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isUuid } from "@/lib/storage/upload-sessions";

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
