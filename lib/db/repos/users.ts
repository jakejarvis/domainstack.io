import "server-only";

import { eq, type InferSelectModel } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type UserData = Pick<
  InferSelectModel<typeof users>,
  "id" | "name" | "email"
>;

/**
 * Get user by ID.
 * Returns basic user info needed for email sending.
 */
export async function getUserById(userId: string): Promise<UserData | null> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * Get user's avatar URL by ID.
 * Returns the external OAuth avatar URL or null if not found.
 */
export async function getUserAvatarUrl(userId: string): Promise<string | null> {
  const rows = await db
    .select({
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rows[0].image;
}
