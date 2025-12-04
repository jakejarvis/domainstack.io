import "server-only";

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn(
    "RESEND_API_KEY is not set. Email notifications will not be sent.",
  );
}

export const resend = apiKey ? new Resend(apiKey) : null;

export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "alerts@domainstack.io";
