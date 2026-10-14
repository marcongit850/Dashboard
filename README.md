# Team HQ

Private dashboard for Marc's bot team. It is a Cloudflare Worker named `dashboard`. Data loads when you open a page. Nothing runs while the site is idle.

```bash
npm install
npm test
npx wrangler dev
```

Sample data, with no sheet or GitHub calls: <http://127.0.0.1:8787/?demo=1>

Live data uses the vars in `wrangler.jsonc` and the `GITHUB_TOKEN` secret. See [ARCHITECTURE.md](ARCHITECTURE.md) for sources, attribution, Access, and deploy.

Deploy from `main` with Cloudflare Workers Builds:

```bash
npx wrangler deploy
```
