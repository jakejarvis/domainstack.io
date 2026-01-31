import { eq, type InferSelectModel } from "drizzle-orm";
import { db } from "../client";
import { accounts, users } from "../schema";

export type UserData = Pick<
  InferSelectModel<typeof users>,
  "id" | "name" | "email"
>;

export interface LinkedAccount {
  providerId: string;
  createdAt: Date;
}

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

/**
 * Get the user's linked OAuth accounts.
 * Returns only provider IDs for security (no tokens or sensitive data).
 */
export async function getLinkedAccounts(
  userId: string,
): Promise<LinkedAccount[]> {
  const linkedAccounts = await db
    .select({
      providerId: accounts.providerId,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  return linkedAccounts;
}
