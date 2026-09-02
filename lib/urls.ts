/**
 * Absolute URLs for OAuth redirects.
 *
 * Providers match the redirect URI exactly against what is registered, so this
 * must be a single, stable, absolute value rather than something derived from
 * the incoming request (which an attacker could influence via Host).
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function callbackUrl(provider: string): string {
  return `${appUrl()}/api/oauth/callback/${provider}`;
}
