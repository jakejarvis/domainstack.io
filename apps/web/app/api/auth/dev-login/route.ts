import { createHmac } from "node:crypto";

import { auth } from "@domainstack/auth/server";

const localDeveloper = {
  email: "developer@example.com",
  name: "Local Developer",
};

function authRequest(request: Request, action: "sign-in" | "sign-up", callbackURL: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  const password = createHmac("sha256", secret).update("domainstack-local-developer").digest("hex");
  return new Request(new URL(`/api/auth/${action}/email`, request.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
      origin: new URL(request.url).origin,
    },
    body: JSON.stringify({ ...localDeveloper, password, callbackURL }),
  });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  const hostname = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return Response.json(
      { message: "Local developer login is only available on localhost" },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as { callbackURL?: unknown } | null;
  const callbackURL = typeof payload?.callbackURL === "string" ? payload.callbackURL : "/dashboard";
  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
    return Response.json({ message: "Invalid callback URL" }, { status: 400 });
  }

  // Sign-up is the existence check: only its explicit duplicate-user response
  // falls through to sign-in. Other failures are returned without being masked.
  const signUpResponse = await auth.handler(authRequest(request, "sign-up", callbackURL));
  if (signUpResponse.ok) return signUpResponse;

  const error = (await signUpResponse
    .clone()
    .json()
    .catch(() => null)) as { code?: string } | null;
  if (error?.code !== "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") return signUpResponse;

  return auth.handler(authRequest(request, "sign-in", callbackURL));
}
