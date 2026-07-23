import { google } from "googleapis";
import { loadRefreshToken } from "./tokenStore.js";

/**
 * One shared consent screen for every scope a Spell might need, so a family signs in
 * with Google once instead of re-authenticating per Spell. Add a scope here (and
 * document why in the comment) when a new Spell needs a new Google API.
 */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar", // Family Calendar spell
  "https://www.googleapis.com/auth/tasks", // Chores spell (Phase 2)
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required for the google-account spell`);
  return value;
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function getConsentUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

/**
 * The shared primitive other Spells use to talk to Google APIs: returns an OAuth2
 * client pre-loaded with the family's refresh token, or null if no account is linked
 * yet. The refresh token itself only ever lives encrypted in SQLite (see
 * tokenStore.ts) — never in a ConfigMap/Secret. GOOGLE_CLIENT_ID/SECRET are the only
 * Google-related values that belong in a k8s Secret, since they identify the Grimoire
 * app's OAuth client itself, not any one user's session.
 */
export function getAuthorizedClient(): ReturnType<typeof createOAuthClient> | null {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) return null;
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
