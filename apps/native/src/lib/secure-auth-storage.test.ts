/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItem: vi.fn<(key: string) => string | null>(() => "stored-cookie"),
  setItem: vi.fn<(key: string, value: string, options?: unknown) => void>(),
  AFTER_FIRST_UNLOCK: "afterFirstUnlock",
}));

import * as SecureStore from "expo-secure-store";

import { secureAuthStorage } from "./secure-auth-storage";

const getItemMock = vi.mocked(SecureStore.getItem);
const setItemMock = vi.mocked(SecureStore.setItem);

beforeEach(() => {
  getItemMock.mockClear();
  setItemMock.mockClear();
});

// Regression: the Better Auth expo plugin reads this cookie synchronously on
// every request. Writing without AFTER_FIRST_UNLOCK means a locked-device /
// pre-first-unlock read returns null → UNAUTHORIZED → forced sign-out.
describe("secureAuthStorage", () => {
  it("reads through SecureStore.getItem", () => {
    expect(secureAuthStorage.getItem("better-auth_cookie")).toBe("stored-cookie");
    expect(getItemMock).toHaveBeenCalledWith("better-auth_cookie");
  });

  it("writes with keychainAccessible AFTER_FIRST_UNLOCK", () => {
    secureAuthStorage.setItem("better-auth_cookie", "token-value");
    expect(setItemMock).toHaveBeenCalledWith("better-auth_cookie", "token-value", {
      keychainAccessible: "afterFirstUnlock",
    });
  });
});
