/**
 * Flags Explorer discovery endpoint.
 *
 * Lets the Vercel Toolbar list this project's flags and apply local overrides.
 * Requires `FLAGS_SECRET` in the environment.
 */

import { getProviderData } from "@flags-sdk/vercel";
import { createFlagsDiscoveryEndpoint } from "flags/next";

import * as flags from "../../../../lib/flags";

export const GET = createFlagsDiscoveryEndpoint(async () => getProviderData(flags));
