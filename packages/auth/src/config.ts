/**
 * Default session configuration for Better Auth.
 * Can be spread into the betterAuth() options.
 */
export const SESSION_CONFIG = {
  /** Session expires after 7 days of inactivity */
  expiresIn: 60 * 60 * 24 * 7,
  /** Update session timestamp if older than 1 day */
  updateAge: 60 * 60 * 24,
  /** Cookie-based session caching */
  cookieCache: {
    enabled: true,
    /** Cache session in cookie for 5 minutes */
    maxAge: 60 * 5,
  },
} as const;

/**
 * Default account linking configuration.
 */
export const ACCOUNT_LINKING_CONFIG = {
  enabled: true,
} as const;
