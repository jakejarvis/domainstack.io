import { describe, expect, it, vi } from "vitest";
/* @vitest-environment node */
import { FatalError, RetryableError, type getStepMetadata } from "workflow";

const sendResendEmailMock = vi.hoisted(() =>
  vi
    .fn<typeof import("@domainstack/email").sendEmail>()
    .mockResolvedValue({ data: { id: "em_1" }, error: null } as never),
);
const getStepMetadataMock = vi.hoisted(() =>
  vi.fn<typeof getStepMetadata>(() => ({ stepId: "step_1" }) as never),
);

vi.mock("@domainstack/email", () => ({ sendEmail: sendResendEmailMock }));
vi.mock("workflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("workflow")>()),
  getStepMetadata: getStepMetadataMock,
}));

describe("sendEmail", () => {
  it("uses the step id as the idempotency key when no key is given", async () => {
    const { sendEmail } = await import("./email");

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
    });

    expect(result).toEqual({ emailId: "em_1" });
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: "step_1" }),
    );
  });

  it("hashes a caller-provided idempotency key instead of using the step id", async () => {
    const { sendEmail } = await import("./email");

    await sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
      idempotencyKey: "provider:td-1:a>b",
    });

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^k:[0-9a-f]{64}$/) }),
    );
    expect(getStepMetadataMock).not.toHaveBeenCalled();
  });

  it("hashes the same key to the same value and different keys to different values", async () => {
    const { sendEmail } = await import("./email");

    await sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
      idempotencyKey: "key-a",
    });
    const keyA = sendResendEmailMock.mock.calls.at(-1)?.[1].idempotencyKey;

    await sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
      idempotencyKey: "key-a",
    });
    const keyARepeat = sendResendEmailMock.mock.calls.at(-1)?.[1].idempotencyKey;

    await sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
      idempotencyKey: "key-b",
    });
    const keyB = sendResendEmailMock.mock.calls.at(-1)?.[1].idempotencyKey;

    expect(keyA).toBe(keyARepeat);
    expect(keyA).not.toBe(keyB);
  });

  it("classifies invalid_idempotent_request as a FatalError", async () => {
    sendResendEmailMock.mockResolvedValueOnce({
      data: null,
      error: { name: "invalid_idempotent_request", message: "x" },
    } as never);

    const { sendEmail } = await import("./email");

    const promise = sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
      idempotencyKey: "key-a",
    });

    const err = await promise.catch((e) => e);
    expect(FatalError.is(err)).toBe(true);
  });

  it("jitters the rate_limit_exceeded retry delay so concurrent retries don't resynchronize", async () => {
    sendResendEmailMock.mockResolvedValueOnce({
      data: null,
      error: { name: "rate_limit_exceeded", message: "x" },
    } as never);

    const { sendEmail } = await import("./email");

    const before = Date.now();
    const err = await sendEmail({
      to: "user@example.com",
      subject: "Subject",
      react: {} as React.ReactElement,
      idempotencyKey: "key-a",
    }).catch((e) => e);
    const after = Date.now();

    expect(RetryableError.is(err)).toBe(true);
    const delayMs = (err as RetryableError).retryAfter.getTime() - before;
    // Base 1s plus 0-500ms of jitter, with slack for test execution time.
    expect(delayMs).toBeGreaterThanOrEqual(1000);
    expect(delayMs).toBeLessThanOrEqual(1500 + (after - before));
  });
});
