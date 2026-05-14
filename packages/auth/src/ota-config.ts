import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";

import { buildOtaConfig, type OtaConfigNativeApp } from "./ota-config-core";
import type { OAuthProvider } from "./types";

export type OtaConfigOptions = {
  enabledProviders: readonly OAuthProvider[];
  /**
   * Optional async loader for native gating config. The plugin keeps no I/O
   * dependency itself; the caller injects an Edge Config / DB / env reader.
   * Return `null` to disable the gate.
   */
  getNativeApp?: () => Promise<OtaConfigNativeApp | null>;
};

export function otaConfig(options: OtaConfigOptions) {
  return {
    id: "otaConfig",
    endpoints: {
      config: createAuthEndpoint("/ota-config/config", { method: "GET" }, async (ctx) => {
        const nativeApp = options.getNativeApp ? await options.getNativeApp() : null;
        return ctx.json(
          buildOtaConfig({
            enabledProviders: options.enabledProviders,
            nativeApp,
          }),
        );
      }),
    },
  } satisfies BetterAuthPlugin;
}

export type {
  OtaConfigAuthProvider,
  OtaConfigNativeApp,
  OtaConfigResponse,
} from "./ota-config-core";
