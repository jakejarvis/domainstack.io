import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type UserData = {
  id: string;
  name: string;
  email: string;
};

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
