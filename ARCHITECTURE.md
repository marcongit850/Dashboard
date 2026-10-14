# Team HQ architecture

Team HQ is a private dashboard for Marc's bot team. It shows who is typing, who is idle, what posted this week, and what needs Marc. The page is built on each request. Nothing runs while the site is idle.

## Worker and domain

- Worker name: `dashboard`
- Config: `wrangler.jsonc`
- Account: `f1c59948520f1ec39473238b621c7e24`
- Domain: the `workers.dev` subdomain only (`workers_dev: true`)
- No custom domain and no route patterns
- Static files live in `public/` and are served with Workers static assets (`ASSETS`)
- HTML is rendered by the Worker. CSS and the favicon are static assets. The shared office is original SVG drawn in the page

Cloudflare Access can sit in front of the hostname later. Until `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` are both set, the Worker allows the request and shows "Login not enabled yet".

## Data sources

All sheet URLs are plain vars in `wrangler.jsonc`. Posts and status point at the published Team HQ Log tabs. Docs stays blank until that CSV link is ready. A blank var, bad JSON, or a failed fetch renders an empty state. The page still loads.

Every bot logs in one workbook, Team HQ Log. Two tabs, two CSV links:

| Var | What it is |
| --- | --- |
| `POSTS_CSV_URL` | Posts tab. Columns: `posted_at_ct`, `bot`, `site`, `platform`, `account`, `status`, `topic`, `post_url`, `reach`, `clicks`, `signups`, `notes`. The bot comes from the `bot` column. Reach, clicks, and signups are kept with the row notes. |
| `STATUS_CSV_URL` | Status tab. Columns: `timestamp_ct`, `bot`, `state`, `task`, `link`, `needs_marc`. `state` is `started`, `finished`, `blocked`, or `idle`. `needs_marc` is `yes` or `no`. The latest row for each bot is the current task. |
| `DOCS_CSV_URL` | Key docs and sheets tab. Columns: `Name`, `Link`, `What it is`, `Owner bot`. |
| `BOT_REPO_MAP` | JSON object of repo name to bot name. |
| `ACCESS_AUD` | Cloudflare Access application AUD tag. |
| `ACCESS_TEAM_DOMAIN` | Team issuer, for example `https://your-team.cloudflareaccess.com`. |

Example posts tab value (one string, the published CSV for that tab):

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=POSTS_GID
```

Use the status tab gid for `STATUS_CSV_URL` and the docs tab gid for `DOCS_CSV_URL`. Posts and status are tabs of the Team HQ Log workbook. The docs inventory can be another tab or its own published sheet.

The bot column on the posts and status tabs is matched to the fixed roster without case sensitivity. Display names: Chief, Bob (Bob The Builder), money-man, Walton, Foody (Foody & Friends), Tango, Tik-Toker, Rank, Outreach, Scout, Warden, Savenello Marketing, Personal Assistant. Bot pages are `/bot/:slug`.

`/docs` reads `DOCS_CSV_URL` on the same page load and caches the CSV for about 5 minutes, like the other sheets. Rows are grouped by Owner bot, roster order first, then any other owner names. The name is the link and "What it is" sits under it. A row is skipped when Name contains `DELETE`, or when Link is not an http or https URL on `docs.google.com` or `drive.google.com`. Cells that look like secrets are not rendered. A secret-shaped description is left blank. Each bot page links that bot's handbook (a row whose name contains handbook), or the Team handbooks folder when that bot has none, and lists the bot's other docs. When `DOCS_CSV_URL` is blank the page says "Docs sheet is not connected yet."

GitHub reads `marcongit850` with a few cached calls: one GraphQL query for the 12 most recently pushed repos (merged PRs, open PRs, recent commits) and one search for open PRs. Attribution:

1. PR title or branch contains the whole word `security` or `warden`: Warden. `seo` or `rank`: Rank. Warden wins if both match.
2. `BOT_REPO_MAP` overrides the default and the name prefix.
3. Repo names starting with `savenello` or `money` belong to money-man.
4. Everything else is Bob.

## Secrets

Only the secret name is listed here. Do not put the value in git, in `wrangler.jsonc`, or in a var.

- `GITHUB_TOKEN`: read-only fine-grained GitHub token that can read pull requests, contents, and metadata on `marcongit850` repositories. Set it with `npx wrangler secret put GITHUB_TOKEN`.

The token is optional at runtime. If it is missing, GitHub shows as not connected and the rest of the page still renders. It is not in `secrets.required`, because that check would refuse `npx wrangler deploy` before the token exists.

Sheet URLs are vars, so anyone who can read the Worker config can see them. Do not hide a credential inside a URL. Publish the tabs, or use a link that is already public to the internet. The Worker fetches server side and cannot use your browser cookies.

## Cost while idle

- No cron triggers in config, and none should be added in the dashboard
- No Workers AI and no other model calls
- The browser has no script, no polling, and no auto refresh
- Upstream reads happen only when someone opens a page
- Those reads use the Cache API (`caches.default`) with `max-age=300` (about 5 minutes)
- The HTML response is `private, no-store`. Only the sheet and GitHub bodies are cached
- The Cache API is per data center. The first request in a city after expiry fetches again. Nobody is called when the tab is closed

Draft, scheduled, skipped, cancelled, failed, idea, planned, and queued rows are hidden. Open pull requests older than 24 hours show under Needs you. A bot is busy when the latest status is `started`, or when a post, merged PR, or commit is within 2 hours. `idle` and `finished` rows do not keep a bot typing. `blocked` or `needs_marc=yes` on the latest row paints the red mark. The bubble uses the current task when the latest status is `started` or `blocked`. Otherwise it uses the latest post topic, merged PR title, or commit subject.

Times are Central Time (`America/Chicago`). A sheet time with no zone is read as Central Time. A trailing `CT`, `CST`, `CDT`, or `Central Time` label means the same.

`?demo=1` renders fixture data and does not call Google or GitHub. It is not an access bypass. If Access is on, the JWT is still required.

## Deploy

Deploy with Cloudflare Workers Builds from `main`:

- Production branch: `main`
- Deploy command: `npx wrangler deploy`

Workers Builds installs dependencies from `package.json` before that command. Do not add a cron trigger to the build or to the Worker settings.

Local check:

```bash
npm test
npx wrangler dev
```

Open `http://127.0.0.1:8787/?demo=1` for sample data. Put `GITHUB_TOKEN=...` in `.dev.vars` (gitignored) when you want live GitHub data locally.

## Gotchas

- Set both Access vars or neither. If only one is set, the Worker returns 403.
- `ACCESS_TEAM_DOMAIN` should be the team origin. Certs are read from `{origin}/cdn-cgi/access/certs`. The request must include `Cf-Access-Jwt-Assertion`.
- `workers.dev` is public until Access is turned on. The in-Worker check is the second lock, not a replacement for Access.
- `POSTS_CSV_URL`, `STATUS_CSV_URL`, and `DOCS_CSV_URL` are single https CSV links. `BOT_REPO_MAP` is JSON stored in a string var. Invalid JSON is an empty state, not a crash.
- Doc links are limited to `docs.google.com` and `drive.google.com`. A private sheet still has to be published for the CSV fetch. Do not put a token in a doc title, description, or link. Those cells are dropped.
- Keyword rules beat the repo map. A security PR on a savenello repo is Warden.
- The map and the `savenello` / `money` prefix do not look at words inside other words. `ranking` does not go to Rank. `seo-titles` does.
- Google must return CSV to an anonymous HTTPS GET. A private sheet that only you can open will fail and show an empty state.
- Cache entries are not purged globally. After you change a sheet, wait about 5 minutes, or expect the previous copy until that datacenter expires it.
- Do not add a cron, a scheduled handler, or a meta refresh. Any of those would wake the Worker while nobody is looking.
