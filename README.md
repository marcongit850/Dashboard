# Team HQ

Private dashboard for Marc's bot team. It is a Cloudflare Worker named `dashboard`. Data loads when you open a page. Nothing runs while the site is idle.

```bash
npm install
npm test
npx wrangler dev
```

Live site: <https://2911studio.com/dash>. Locally the site is served under `/dash`. Put `DASH_PASSWORD=...` in `.dev.vars` (gitignored), then open <http://127.0.0.1:8787/dash/login>. Sample data, with no sheet or GitHub calls: <http://127.0.0.1:8787/dash?demo=1>

Live data uses the vars in `wrangler.jsonc` and the `GITHUB_TOKEN` secret. See [ARCHITECTURE.md](ARCHITECTURE.md) for sources, the password cookie, attribution, Access, and deploy.

Deploy from `main` with Cloudflare Workers Builds:

```bash
npx wrangler deploy
```
