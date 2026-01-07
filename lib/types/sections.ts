/**
 * Section types for domain report UI.
 *
 * Constants and metadata are in @/lib/constants/sections.ts.
 */

export type Section =
  | "dns"
  | "headers"
  | "hosting"
  | "certificates"
  | "seo"
  | "registration";

export type SectionAccent =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "pink"
  | "cyan";

export interface SectionDef {
  title: string;
  accent: SectionAccent;
  icon: React.ElementType;
  description: string;
  help: string;
  slug: string;
}
