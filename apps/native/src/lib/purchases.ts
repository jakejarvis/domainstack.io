import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

import { revenueCatAndroidKey, revenueCatIosKey } from "./env";

/**
 * RevenueCat entitlement identifier. Configured in the RevenueCat dashboard and
 * mapped to the App Store / Play products. A user is "pro" on a device when
 * this entitlement is active.
 */
export const PRO_ENTITLEMENT_ID = "pro";

function platformApiKey(): string {
  if (Platform.OS === "ios") return revenueCatIosKey;
  if (Platform.OS === "android") return revenueCatAndroidKey;
  return "";
}

/**
 * Whether in-app purchases are usable (a RevenueCat public SDK key is present
 * for this platform). When false the billing UI falls back to a "manage on the
 * web" message instead of crashing.
 */
export function isPurchasesEnabled(): boolean {
  return platformApiKey() !== "";
}

let configured = false;
let currentAppUserId: string | null = null;

function ensureConfigured(): boolean {
  if (!isPurchasesEnabled()) return false;
  if (configured) return true;
  Purchases.configure({ apiKey: platformApiKey() });
  void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  configured = true;
  return true;
}

/**
 * Bind the RevenueCat SDK identity to our authenticated user (so the webhook's
 * `app_user_id` equals our user id — never an anonymous id). Call on every
 * session change: `userId` on sign-in / switch, `null` on sign-out.
 *
 * Best-effort and idempotent: failures are swallowed (purchases simply remain
 * unavailable) and a repeated id is a no-op.
 */
export async function syncPurchasesUser(userId: string | null): Promise<void> {
  if (!ensureConfigured()) return;

  try {
    if (userId) {
      if (currentAppUserId === userId) return;
      await Purchases.logIn(userId);
      currentAppUserId = userId;
    } else {
      if (currentAppUserId === null) return;
      // logOut rejects if the current user is already anonymous — ignore that.
      await Purchases.logOut().catch(() => undefined);
      currentAppUserId = null;
    }
  } catch {
    // Leave purchases disabled for this session rather than blocking auth.
  }
}

/** The current RevenueCat offering ("default"), or null if unavailable. */
export async function getProOffering(): Promise<PurchasesOffering | null> {
  if (!ensureConfigured()) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export function hasProEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

/**
 * Run the native purchase flow for a package. Returns `{ cancelled: true }`
 * when the user dismissed the sheet (not an error); throws on real failures so
 * the caller can surface a toast.
 */
export async function purchaseProPackage(pkg: PurchasesPackage): Promise<{ cancelled: boolean }> {
  if (!ensureConfigured()) {
    throw new Error("In-app purchases are unavailable on this device.");
  }
  try {
    await Purchases.purchasePackage(pkg);
    return { cancelled: false };
  } catch (err) {
    if ((err as PurchasesError).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { cancelled: true };
    }
    throw err;
  }
}

/** Restore prior purchases; returns whether the pro entitlement is now active. */
export async function restoreProPurchases(): Promise<boolean> {
  if (!ensureConfigured()) {
    throw new Error("In-app purchases are unavailable on this device.");
  }
  const info = await Purchases.restorePurchases();
  return hasProEntitlement(info);
}

/**
 * Subscribe to RevenueCat entitlement changes (purchase, renewal, restore).
 * Used to refetch the server subscription so the UI reconciles with the
 * webhook-derived state. Returns an unsubscribe function.
 */
export function addProEntitlementListener(onChange: () => void): () => void {
  const listener: CustomerInfoUpdateListener = () => onChange();
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
