/**
 * CSP for the Vite SPA (static HTML/JS on Vercel).
 * Keep vercel.json Content-Security-Policy header in sync — see contentSecurityPolicy.test.ts.
 */
export function buildSpaContentSecurityPolicy() {
    const directives = {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'self'"],
        "form-action": ["'self'"],
        "script-src": [
            "'self'",
            "https://www.googletagmanager.com",
            "https://www.google-analytics.com",
            "https://connect.facebook.net",
            "https://accounts.google.com",
            "https://cdn.paddle.com",
        ],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "connect-src": [
            "'self'",
            "https://www.google-analytics.com",
            "https://region1.google-analytics.com",
            "https://www.googletagmanager.com",
            "https://us.i.posthog.com",
            "https://eu.i.posthog.com",
            "https://connect.facebook.net",
            "https://www.facebook.com",
            "https://accounts.google.com",
            "https://cdn.paddle.com",
            "https://sandbox-api.paddle.com",
            "https://api.paddle.com",
            "https://checkout.paddle.com",
            "https://sandbox-checkout.paddle.com",
            "https://vitals.vercel-insights.com",
            "https://va.vercel-scripts.com",
        ],
        "frame-src": [
            "'self'",
            "https://checkout.paddle.com",
            "https://sandbox-checkout.paddle.com",
            "https://buy.paddle.com",
            "https://accounts.google.com",
        ],
        "worker-src": ["'self'", "blob:"],
    };
    return Object.entries(directives)
        .map(([name, sources]) => `${name} ${sources.join(" ")}`)
        .join("; ");
}
