/**
 * Authentication and session constants
 */

export const SESSION_CONFIG = {
  /** Session expiry time in seconds (7 days) */
  EXPIRES_IN: 60 * 60 * 24 * 7,

  /** Session update age in seconds (1 day) */
  UPDATE_AGE: 60 * 60 * 24,

  /** Cookie cache duration in seconds (5 minutes) */
  COOKIE_CACHE_MAX_AGE: 5 * 60,
} as const;

export const AUTH_CONFIG = {
  /** Cookie prefix for Better Auth session cookies */
  COOKIE_PREFIX: 'escrow-lite',

  /** Enable secure cookies in production */
  USE_SECURE_COOKIES: true,

  /** Base URL for the application (required for cross-subdomain cookies) */
  BASE_URL: 'https://escrow-lite.dzulfikar-at.workers.dev',

  /** Enable cross-subdomain cookies */
  CROSS_SUBDOMAIN_COOKIES: false, // Disabled for MVP - requires baseURL configuration
} as const;
