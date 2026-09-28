import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@domainstack/logger", () => ({
  createLogger: () => ({
    info: vi.fn<() => void>(),
    warn: vi.fn<() => void>(),
    error: vi.fn<() => void>(),
  }),
}));

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "email-outbox-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.stubEnv("RESEND_API_KEY", "");
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(cwd, { recursive: true, force: true });
});

const email = {
  to: "user@example.com",
  subject: "Confirm your account deletion",
  react: createElement("p", null, "Hello from the outbox"),
};

describe("sendEmail without Resend configured", () => {
  it("writes the email to the local outbox in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await import("./resend");

    const { data, error } = await sendEmail(email, { baseUrl: "http://localhost:3000" });

    expect(error).toBeNull();
    expect(data?.id).toMatch(/^dev-/);

    const dir = path.join(cwd, "public", "_dev-emails");
    const [file] = await readdir(dir);
    expect(file).toMatch(/-confirm-your-account-deletion\.html$/);
    expect(await readFile(path.join(dir, file), "utf8")).toContain("Hello from the outbox");
  });

  it("throws outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sendEmail } = await import("./resend");

    await expect(sendEmail(email, { baseUrl: "https://domainstack.io" })).rejects.toThrow(
      "Resend is not configured",
    );
  });
});

describe("contacts without Resend configured", () => {
  it("no-ops in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { addContact, removeContact } = await import("./resend");

    await expect(addContact("user@example.com", "Jane Doe")).resolves.toBeUndefined();
    await expect(removeContact("user@example.com")).resolves.toBeUndefined();
  });

  it("throws outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { addContact } = await import("./resend");

    await expect(addContact("user@example.com", "Jane Doe")).rejects.toThrow(
      "Resend is not configured",
    );
  });
});
