import { auth, toNextJsHandler } from "@domainstack/auth/server";

export const { GET, POST } = toNextJsHandler(auth.handler);
