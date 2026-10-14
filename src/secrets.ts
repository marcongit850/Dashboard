export {};

declare global {
  interface Env {
    /** Read-only fine-grained token. Set with `npx wrangler secret put GITHUB_TOKEN`. */
    GITHUB_TOKEN?: string;
    /** Required to open the dashboard. Set with `npx wrangler secret put DASH_PASSWORD`. */
    DASH_PASSWORD?: string;
    /** Optional HMAC key. When unset, the password signs the session cookie. */
    DASH_COOKIE_SECRET?: string;
  }
}
