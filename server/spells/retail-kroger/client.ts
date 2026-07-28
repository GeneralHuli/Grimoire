import { loadTokens, saveTokens } from "./tokenStore.js";

const BASE_URL = "https://api.kroger.com";

/**
 * Cart writes need a signed-in shopper's consent (same shape as the google-account
 * Ritual's OAuth flow); product/location lookups are public data behind an
 * app-level client_credentials token instead.
 */
const USER_SCOPE = "cart.basic:write";
const CLIENT_SCOPE = "product.compact";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required for the retail-kroger spell`);
  return value;
}

function basicAuthHeader(): string {
  const credentials = `${requireEnv("KROGER_CLIENT_ID")}:${requireEnv("KROGER_CLIENT_SECRET")}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/v1/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Kroger token request failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export function getConsentUrl(): string {
  const params = new URLSearchParams({
    scope: USER_SCOPE,
    client_id: requireEnv("KROGER_CLIENT_ID"),
    redirect_uri: requireEnv("KROGER_REDIRECT_URI"),
    response_type: "code",
  });
  return `${BASE_URL}/v1/connect/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: requireEnv("KROGER_REDIRECT_URI"),
    })
  );
}

async function refreshUserTokens(refreshToken: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

// In-memory cache for the app-level (client_credentials) token — it's public product
// and location data, not tied to any family member, so sharing one cached token across
// requests until it expires is fine (no SQLite row needed, unlike the user's tokens).
let clientToken: { accessToken: string; expiresAt: number } | null = null;

async function getClientCredentialsToken(): Promise<string> {
  if (clientToken && clientToken.expiresAt > Date.now()) return clientToken.accessToken;
  const token = await postToken(new URLSearchParams({ grant_type: "client_credentials", scope: CLIENT_SCOPE }));
  clientToken = { accessToken: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1000 };
  return clientToken.accessToken;
}

/**
 * A valid user access token for cart operations, transparently refreshing (and
 * persisting the refreshed token) if the stored one has expired. Null if no Fred Meyer
 * account is connected yet.
 */
async function getUserAccessToken(): Promise<string | null> {
  const stored = loadTokens();
  if (!stored) return null;
  if (new Date(stored.expiresAt).getTime() > Date.now() + 60_000) {
    return stored.accessToken;
  }
  const refreshed = await refreshUserTokens(stored.refreshToken);
  saveTokens({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? stored.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  });
  return refreshed.access_token;
}

export interface KrogerProduct {
  productId: string;
  description: string;
  brand?: string;
  size?: string;
  price?: number;
  promoPrice?: number;
}

interface RawKrogerProduct {
  productId: string;
  description: string;
  brand?: string;
  items?: { size?: string; price?: { regular?: number; promo?: number } }[];
}

function toProduct(raw: RawKrogerProduct): KrogerProduct {
  const item = raw.items?.[0];
  return {
    productId: raw.productId,
    description: raw.description,
    brand: raw.brand,
    size: item?.size,
    price: item?.price?.regular,
    promoPrice: item?.price?.promo,
  };
}

export async function searchProducts(term: string, locationId: string, limit = 5): Promise<KrogerProduct[]> {
  const token = await getClientCredentialsToken();
  const params = new URLSearchParams({
    "filter.term": term,
    "filter.locationId": locationId,
    "filter.limit": String(limit),
  });
  const res = await fetch(`${BASE_URL}/v1/products?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Kroger product search failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: RawKrogerProduct[] };
  return body.data.map(toProduct);
}

export interface KrogerLocation {
  locationId: string;
  name: string;
  address: string;
}

interface RawKrogerLocation {
  locationId: string;
  name: string;
  address?: { addressLine1?: string; city?: string; state?: string };
}

export async function searchLocations(zipCode: string, limit = 5): Promise<KrogerLocation[]> {
  const token = await getClientCredentialsToken();
  const params = new URLSearchParams({
    "filter.zipCode.near": zipCode,
    "filter.limit": String(limit),
  });
  const res = await fetch(`${BASE_URL}/v1/locations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Kroger location search failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: RawKrogerLocation[] };
  return body.data.map((loc) => ({
    locationId: loc.locationId,
    name: loc.name,
    address: [loc.address?.addressLine1, loc.address?.city, loc.address?.state].filter(Boolean).join(", "),
  }));
}

/**
 * Adds items to the connected shopper's Fred Meyer cart. Kroger's Cart API only
 * supports adding items — there's no checkout/order-placement endpoint, so this is as
 * far as the integration can automate; the shopper finishes checkout themselves.
 */
export async function addToCart(items: { upc: string; quantity: number }[]): Promise<void> {
  const token = await getUserAccessToken();
  if (!token) throw new Error("Not connected to a Fred Meyer account");
  const res = await fetch(`${BASE_URL}/v1/cart/add`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Kroger add-to-cart failed: ${res.status} ${await res.text()}`);
}
