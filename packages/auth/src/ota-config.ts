import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";

import { buildOtaConfig } from "./ota-config-core";
import type { OAuthProvider } from "./types";

export type OtaConfigOptions = {
  enabledProviders: readonly OAuthProvider[];
};

export function otaConfig(options: OtaConfigOptions) {
  return {
    id: "otaConfig",
    endpoints: {
      config: createAuthEndpoint("/ota-config/config", { method: "GET" }, async (ctx) => {
        return ctx.json(buildOtaConfig(options));
      }),
    },
  } satisfies BetterAuthPlugin;
}

export type { OtaConfigAuthProvider, OtaConfigResponse } from "./ota-config-core";
