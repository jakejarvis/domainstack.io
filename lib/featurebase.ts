import "server-only";

import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import type { Session } from "@/lib/auth";

export async function createFeaturebaseToken(session?: Session) {
  if (!process.env.FEATUREBASE_JWT_SECRET || !session?.user) return;

  const body = {
    name: session.user.name,
    email: session.user.email,
    userId: session.user.id,
    profilePicture: session.user.image,
    jti: uuid(),
  };

  return jwt.sign(body, process.env.FEATUREBASE_JWT_SECRET, {
    algorithm: "HS256",
  });
}
