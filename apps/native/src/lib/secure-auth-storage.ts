import * as SecureStore from "expo-secure-store";

import type { NativeAuthStorage } from "@domainstack/auth/native";

// Better Auth's expo plugin persists the session cookie + cached session data
// through this storage, reading the cookie SYNCHRONOUSLY on every request. The
// bare SecureStore module defaults to keychain accessibility WHEN_UNLOCKED, so
// a session-dependent request while the device is locked — or before the first
// unlock after a reboot — reads a null cookie. That cascades to an
// UNAUTHORIZED, a forced sign-out, and a full query-cache wipe.
//
// AFTER_FIRST_UNLOCK keeps the value readable once the user has unlocked at
// least once since boot (still unreadable while powered off / pre-first-unlock)
// — the standard trade-off for a credential that must work in background and
// locked-device flows. iOS-only attribute; a no-op on Android's keystore.
const keychainAccessible = SecureStore.AFTER_FIRST_UNLOCK;

export const secureAuthStorage: NativeAuthStorage = {
  getItem: (key) => SecureStore.getItem(key),
  setItem: (key, value) => SecureStore.setItem(key, value, { keychainAccessible }),
};
