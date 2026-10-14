export {};

declare global {
  interface Env {
    /** Read-only fine-grained token. Set with `npx wrangler secret put GITHUB_TOKEN`. */
    GITHUB_TOKEN?: string;
  }
}
