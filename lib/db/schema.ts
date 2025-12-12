import { relations, sql } from "drizzle-orm";
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
  Header,
  NotificationOverrides,
  OpenGraphMeta,
  RegistrationContacts,
  RegistrationNameservers,
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
export const verificationMethod = pgEnum("verification_method", [
  "dns_txt",
  "html_file",
  "meta_tag",
]);
export const verificationStatus = pgEnum("verification_status", [
  "verified",
  "failing",
  "unverified",
]);
export const userTier = pgEnum("user_tier", ["free", "pro"]);

// ============================================================================
// Authentication Tables (better-auth)
// ============================================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  users: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  users: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Domain Tracking Tables
// ============================================================================

// User subscriptions (tier and subscription state)
export const userSubscriptions = pgTable(
  "user_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: userTier("tier").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // When a canceled subscription ends and user downgrades to free
    // Null means: no pending cancellation (subscription active or user is on free tier)
    endsAt: timestamp("ends_at", { withTimezone: true }),
    // Last subscription expiry notification threshold sent (7, 3, or 1 days)
    // Null means no notification sent for current cancellation cycle
    // Cleared when endsAt is cleared (resubscribed or revoked)
    lastExpiryNotification: integer("last_expiry_notification"),
  },
  (t) => [unique("u_user_subscription_user").on(t.userId)],
);

// User's tracked domains
export const userTrackedDomains = pgTable(
  "user_tracked_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(false),
    verificationMethod: verificationMethod("verification_method"),
    verificationToken: text("verification_token").notNull(),
    // Re-verification tracking
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("unverified"),
    verificationFailedAt: timestamp("verification_failed_at", {
      withTimezone: true,
    }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    // Per-domain notification overrides (empty = inherit from user preferences)
    notificationOverrides: jsonb("notification_overrides")
      .$type<NotificationOverrides>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // Soft-archive timestamp (null = active, set = archived)
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    unique("u_tracked_domain_user").on(t.userId, t.domainId),
    index("i_tracked_domains_user").on(t.userId),
    index("i_tracked_domains_domain").on(t.domainId),
    index("i_tracked_domains_verified").on(t.verified),
    index("i_tracked_domains_status").on(t.verificationStatus),
    index("i_tracked_domains_archived").on(t.archivedAt),
    // Composite index for paginated dashboard query:
    // WHERE userId = ? AND archivedAt IS NULL ORDER BY createdAt DESC, id DESC
    index("i_tracked_domains_user_active_ordered").on(
      t.userId,
      t.archivedAt,
      t.createdAt,
      t.id,
    ),
  ],
);

// Notification history (prevent duplicate emails)
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackedDomainId: uuid("tracked_domain_id")
      .notNull()
      .references(() => userTrackedDomains.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    // Resend email ID for troubleshooting delivery issues
    resendId: text("resend_id"),
  },
  (t) => [
    unique("u_notification_unique").on(t.trackedDomainId, t.type),
    index("i_notifications_tracked_domain").on(t.trackedDomainId),
  ],
);

// User notification preferences (global defaults for all domains)
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    // Global toggles (defaults for all domains)
    domainExpiry: boolean("domain_expiry").notNull().default(true),
    certificateExpiry: boolean("certificate_expiry").notNull().default(true),
    verificationStatus: boolean("verification_status").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

// ============================================================================
// Domain Data Tables
// ============================================================================

// Providers (hosting, email, dns, ca, registrar)
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
    index("i_providers_category_domain").on(t.category, t.domain),
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
    nameservers: jsonb("nameservers")
      .$type<RegistrationNameservers>()
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
    index("i_dns_type_value").on(t.type, t.value),
    index("i_dns_expires").on(t.expiresAt),
    index("i_dns_domain_expires").on(t.domainId, t.expiresAt),
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
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    headers: jsonb("headers")
      .$type<Header[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: integer("status").notNull().default(200),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("i_http_headers_expires").on(t.expiresAt)],
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
    previewImageUploadedUrl: text("preview_image_uploaded_url"),
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

// Favicons
export const favicons = pgTable(
  "favicons",
  {
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    url: text("url"),
    pathname: text("pathname"),
    size: integer("size").notNull(),
    source: text("source"),
    notFound: boolean("not_found").notNull().default(false),
    upstreamStatus: integer("upstream_status"),
    upstreamContentType: text("upstream_content_type"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("i_favicons_expires").on(t.expiresAt)],
);

// Screenshots
export const screenshots = pgTable(
  "screenshots",
  {
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    url: text("url"),
    pathname: text("pathname"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    source: text("source"),
    notFound: boolean("not_found").notNull().default(false),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("i_screenshots_expires").on(t.expiresAt)],
);
