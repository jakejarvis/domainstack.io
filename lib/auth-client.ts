"use client";

import { createAuthClient } from "better-auth/react";
import { BASE_URL } from "@/lib/constants/app";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
});

export const { useSession, signIn, signOut } = authClient;
