type OriginCallback = (error: Error | null, allow?: boolean) => void;

/**
 * CORS origin check for the gateway.
 *
 * An origin outside ALLOWED_ORIGINS gets no CORS headers (`allow = false`), so the browser keeps
 * other sites from reading responses. It must not be answered with an error: the cors middleware
 * turns that into a 500 for the whole request. Browsers send `Origin` on every POST, including
 * same-origin ones, so a 500 broke ordering, payment and login as soon as the app was opened from
 * a URL missing from the list (e.g. a new Cloudflare quick-tunnel URL).
 *
 * Authentication uses the Authorization header, never cookies, so not answering CORS is enough:
 * a foreign page cannot attach a user's token to a request.
 */
export function buildCorsOriginCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.map((origin) => origin.trim()).filter(Boolean));
  return (origin: string | undefined, callback: OriginCallback) => {
    if (!origin || !allowed.size || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
