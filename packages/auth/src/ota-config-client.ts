import type { BetterAuthClientPlugin } from "better-auth/client";

import type { otaConfig } from "./ota-config";
import type { OtaConfigResponse } from "./ota-config-core";

export type OtaConfigClientResult =
  | {
      data: OtaConfigResponse;
      error: null;
    }
  | {
      data: null;
      error: {
        message?: string;
        status: number;
        statusText: string;
      };
    };

export type OtaConfigClientActions = {
  otaConfig: {
    config: () => Promise<OtaConfigClientResult>;
  };
};

export function otaConfigClient() {
  return {
    id: "otaConfig",
    $InferServerPlugin: {} as ReturnType<typeof otaConfig>,
    pathMethods: {
      "/ota-config/config": "GET",
    },
  } satisfies BetterAuthClientPlugin;
}

export type {
  OtaConfigAuthProvider,
  OtaConfigNativeApp,
  OtaConfigResponse,
} from "./ota-config-core";
