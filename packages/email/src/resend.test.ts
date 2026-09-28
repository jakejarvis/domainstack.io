import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

    const dir = path.join(cwd, ".dev-emails");
    const [file] = await readdir(dir);
    expect(file).toBe(`confirm-your-account-deletion-${data?.id}.html`);
    expect(data?.id).toMatch(/^dev-[0-9a-f-]{36}$/);
    expect(await readFile(path.join(dir, file), "utf8")).toContain("Hello from the outbox");
  });

  it("gives each email its own file", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await import("./resend");

    await Promise.all([
      sendEmail(email, { baseUrl: "http://localhost:3000" }),
      sendEmail(email, { baseUrl: "http://localhost:3000" }),
    ]);

    expect(await readdir(path.join(cwd, ".dev-emails"))).toHaveLength(2);
  });

  it("points the inline logo at the hosted image", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await import("./resend");

    await sendEmail(
      { ...email, react: createElement("img", { src: "cid:domainstack-logo", alt: "" }) },
      { baseUrl: "http://localhost:3000/" },
    );

    const dir = path.join(cwd, ".dev-emails");
    const [file] = await readdir(dir);
    const html = await readFile(path.join(dir, file), "utf8");
    expect(html).toContain('src="http://localhost:3000/apple-icon.png"');
    expect(html).not.toContain("cid:");
  });

  it("keeps text-only emails, escaped", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await import("./resend");

    const { error } = await sendEmail(
      { to: "user@example.com", subject: "Plain", text: "a < b & c" },
      { baseUrl: "http://localhost:3000" },
    );

    expect(error).toBeNull();
    const dir = path.join(cwd, ".dev-emails");
    const [file] = await readdir(dir);
    expect(await readFile(path.join(dir, file), "utf8")).toContain("a &lt; b &amp; c");
  });

  it("returns a Resend-style error for an email with no body", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendEmail } = await import("./resend");

    const { data, error } = await sendEmail(
      { to: "user@example.com", subject: "Empty" },
      { baseUrl: "http://localhost:3000" },
    );

    expect(data).toBeNull();
    expect(error?.name).toBe("application_error");
  });

  it("returns a Resend-style error when the outbox cannot be written", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // A file where the outbox directory should be makes mkdir fail
    await writeFile(path.join(cwd, ".dev-emails"), "");
    const { sendEmail } = await import("./resend");

    const { data, error } = await sendEmail(email, { baseUrl: "http://localhost:3000" });

    expect(data).toBeNull();
    expect(error?.name).toBe("application_error");
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
