import type { Plan } from "@domainstack/types";

export interface IdentifyProperties {
  email?: string;
  name?: string;
  tier?: Plan;
}

export interface IdentifySetOnceProperties {
  createdAt?: string;
}
