import type { Plan } from "./primitives";

export type AnalyticsValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | Date
  | AnalyticsValue[]
  | AnalyticsProperties;

export interface AnalyticsProperties {
  [property: string]: AnalyticsValue;
}

export interface IdentifyProperties {
  email?: string;
  name?: string;
  tier?: Plan;
}

export interface IdentifySetOnceProperties {
  createdAt?: string;
}
