import { exportPKCS8, generateKeyPair, type CryptoKey, jwtVerify, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppleClientSecret, type AppleClientSecretInput } from "./apple-client-secret";

let INPUT: AppleClientSecretInput;
let publicKey: CryptoKey;

beforeAll(async () => {
  // A real ES256 keypair so we sign verifiable JWTs without touching Apple.
  const pair = await generateKeyPair("ES256", { extractable: true });
  publicKey = pair.publicKey;
  INPUT = {
    teamId: "TEAM123456",
    keyId: "KEY1234567",
    clientId: "io.domainstack.app",
    privateKey: await exportPKCS8(pair.privateKey),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function expiry(jwt: string): Promise<number> {
  const { payload } = await jwtVerify(jwt, publicKey, { audience: "https://appleid.apple.com" });
  return payload.exp as number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("AppleClientSecret", () => {
  it("signs a usable Apple client-secret JWT", async () => {
    const secret = await AppleClientSecret.create(INPUT);
    const jwt = secret.current();
    expect(jwt.split(".")).toHaveLength(3);
    await expect(expiry(jwt)).resolves.toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("serves the same value while the JWT is comfortably fresh", async () => {
    const secret = await AppleClientSecret.create(INPUT);
    const first = secret.current();

    const base = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(base + DAY_MS); // far from refresh window
    expect(secret.current()).toBe(first);
  });

  it("re-signs in the background once inside the refresh window", async () => {
    const secret = await AppleClientSecret.create(INPUT);
    const original = secret.current();
    const originalExp = await expiry(original);

    // Within 14 days of the 180-day expiry.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 170 * DAY_MS);

    // Refresh kicks off but the old value keeps serving synchronously.
    expect(secret.current()).toBe(original);

    await vi.waitFor(() => {
      expect(secret.current()).not.toBe(original);
    });

    expect(await expiry(secret.current())).toBeGreaterThan(originalExp);
  });

  it("keeps the old value if a background re-sign fails", async () => {
    const secret = await AppleClientSecret.create(INPUT);
    const original = secret.current();

    const signSpy = vi
      .spyOn(SignJWT.prototype, "sign")
      .mockRejectedValueOnce(new Error("signing unavailable"));

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 170 * DAY_MS);
    expect(secret.current()).toBe(original);

    await vi.waitFor(() => {
      expect(signSpy).toHaveBeenCalled();
    });
    expect(secret.current()).toBe(original);
  });
});
