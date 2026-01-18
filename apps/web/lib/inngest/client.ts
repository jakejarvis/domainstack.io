import "server-only";
import { Inngest } from "inngest";
import { createLogger } from "@/lib/logger/server";

// Configure a logger for Inngest functions.
// Our unified logger supports Inngest's standardized interface via flexible child() implementation.
// https://www.inngest.com/docs/guides/logging
const logger = createLogger({ source: "inngest" });

export const inngest = new Inngest({
  id: "domainstack",
  logger,
});
