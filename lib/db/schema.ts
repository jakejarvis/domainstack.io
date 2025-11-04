import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RegistrationContacts,
  RegistrationStatuses,
  RobotsTxt,
  TwitterMeta,
} from "@/lib/schemas";

// Enums
export const providerCategory = pgEnum("provider_category", [
  "hosting",
  "email",
  "dns",
  "ca",
  "registrar",
]);
export const providerSource = pgEnum("provider_source", [
  "catalog",
  "discovered",
]);
export const dnsRecordType = pgEnum("dns_record_type", [
  "A",
  "AAAA",
  "MX",
  "TXT",
  "NS",
]);
export const registrationSource = pgEnum("registration_source", [
  "rdap",
  "whois",
]);

// Providers
export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: providerCategory("category").notNull(),
    name: text("name").notNull(),
    domain: text("domain"),
    slug: text("slug").notNull(),
    source: providerSource("source").notNull().default("discovered"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("u_providers_category_slug").on(t.category, t.slug),
    index("i_providers_name_lower").using(
      "btree",
      t.category,
      sql`lower(${t.name})`,
    ),
  ],
);

// Domains
export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tld: text("tld").notNull(),
    unicodeName: text("unicode_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  },
  (t) => [
    unique("u_domains_name").on(t.name),
    index("i_domains_tld").on(t.tld),
    index("i_domains_last_accessed").on(t.lastAccessedAt),
  ],
);

// Registration (snapshot)
export const registrations = pgTable(
  "registrations",
  {
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    isRegistered: boolean("is_registered").notNull(),
    privacyEnabled: boolean("privacy_enabled"),
    registry: text("registry"),
    creationDate: timestamp("creation_date", { withTimezone: true }),
    updatedDate: timestamp("updated_date", { withTimezone: true }),
    expirationDate: timestamp("expiration_date", { withTimezone: true }),
    deletionDate: timestamp("deletion_date", { withTimezone: true }),
    transferLock: boolean("transfer_lock"),
    statuses: jsonb("statuses")
      .$type<RegistrationStatuses>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    contacts: jsonb("contacts")
      .$type<RegistrationContacts>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    whoisServer: text("whois_server"),
    rdapServers: jsonb("rdap_servers")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    source: registrationSource("source").notNull(),
    registrarProviderId: uuid("registrar_provider_id").references(
      () => providers.id,
    ),
    resellerProviderId: uuid("reseller_provider_id").references(
      () => providers.id,
    ),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("i_reg_registrar").on(t.registrarProviderId),
    index("i_reg_expires").on(t.expiresAt),
  ],
);

export const registrationNameservers = pgTable(
  "registration_nameservers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    host: text("host").notNull(),
    ipv4: jsonb("ipv4").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ipv6: jsonb("ipv6").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    unique("u_reg_ns").on(t.domainId, t.host),
    index("i_reg_ns_host").on(t.host),
  ],
);

// DNS (per-record rows)
export const dnsRecords = pgTable(
  "dns_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    type: dnsRecordType("type").notNull(),
    name: text("name").notNull(),
    value: text("value").notNull(),
    ttl: integer("ttl"),
    priority: integer("priority"),
    isCloudflare: boolean("is_cloudflare"),
    resolver: text("resolver").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    // Include priority in uniqueness for MX/SRV records
    // (same host with different priorities = different records)
    unique("u_dns_record").on(t.domainId, t.type, t.name, t.value, t.priority),
    index("i_dns_domain_type").on(t.domainId, t.type),
    index("i_dns_type_value").on(t.type, t.value),
    index("i_dns_expires").on(t.expiresAt),
  ],
);

// TLS certificates (latest)
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    altNames: jsonb("alt_names")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
    caProviderId: uuid("ca_provider_id").references(() => providers.id),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("i_certs_domain").on(t.domainId),
    index("i_certs_valid_to").on(t.validTo),
    index("i_certs_expires").on(t.expiresAt),
    // Ensure validTo >= validFrom
    check("ck_cert_valid_window", sql`${t.validTo} >= ${t.validFrom}`),
    // GIN on alt_names via raw migration
  ],
);

// HTTP headers (latest set)
export const httpHeaders = pgTable(
  "http_headers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: text("value").notNull(),
    status: integer("status").notNull().default(200),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("i_http_domain").on(t.domainId),
    index("i_http_name").on(t.name),
  ],
);

// Hosting (latest)
export const hosting = pgTable(
  "hosting",
  {
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    hostingProviderId: uuid("hosting_provider_id").references(
      () => providers.id,
    ),
    emailProviderId: uuid("email_provider_id").references(() => providers.id),
    dnsProviderId: uuid("dns_provider_id").references(() => providers.id),
    geoCity: text("geo_city"),
    geoRegion: text("geo_region"),
    geoCountry: text("geo_country"),
    geoCountryCode: text("geo_country_code"),
    geoLat: doublePrecision("geo_lat"),
    geoLon: doublePrecision("geo_lon"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("i_hosting_providers").on(
      t.hostingProviderId,
      t.emailProviderId,
      t.dnsProviderId,
    ),
  ],
);

// SEO (latest)
export const seo = pgTable(
  "seo",
  {
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    sourceFinalUrl: text("source_final_url"),
    sourceStatus: integer("source_status"),
    metaOpenGraph: jsonb("meta_open_graph")
      .$type<OpenGraphMeta>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    metaTwitter: jsonb("meta_twitter")
      .$type<TwitterMeta>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    metaGeneral: jsonb("meta_general")
      .$type<GeneralMeta>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    previewTitle: text("preview_title"),
    previewDescription: text("preview_description"),
    previewImageUrl: text("preview_image_url"),
    canonicalUrl: text("canonical_url"),
    robots: jsonb("robots")
      .$type<RobotsTxt>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    robotsSitemaps: jsonb("robots_sitemaps")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    errors: jsonb("errors").notNull().default(sql`'[]'::jsonb`),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("i_seo_src_final_url").on(t.sourceFinalUrl),
    index("i_seo_canonical").on(t.canonicalUrl),
  ],
);
