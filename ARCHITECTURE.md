# Team HQ architecture

Team HQ is a private dashboard for Marc's bot team. It shows who is typing, who is idle, what posted this week, and what needs Marc. The page is built on each request. Nothing runs while the site is idle.

## Worker and domain

- Worker name: `dashboard`
- Config: `wrangler.jsonc`
- Account: `f1c59948520f1ec39473238b621c7e24`
- `workers_dev: true` stays on
- No custom domain on this Worker, and no schedule
- Path routes, apex host only:
  - `whatshappeningnetwork.com/dash`
  - `whatshappeningnetwork.com/dash/*`
- `BASE_PATH` is `/dash`. Pages, links, assets, login, logout, and redirects all use that prefix. An empty `BASE_PATH` serves at the host root. A request to `/` on `workers.dev` redirects to `/dash`
- Static files live in `public/` and are served with Workers static assets (`ASSETS`). The browser asks for `/dash/hq.css` and `/dash/favicon.svg`. The Worker strips the prefix before reading the asset
- HTML is rendered by the Worker. The shared office is original SVG drawn in the page

`whatshappeningnetwork.com` and `www.whatshappeningnetwork.com` are custom domains on the `whatshappening` Worker. The zone has no other Workers Routes. A route runs before that custom domain for a matching path, so `/dash` can belong to this Worker while the rest of the site stays put. `/dash` on the apex host was a 404, so the route does not replace a live page. The pattern is `/dash` and `/dash/*`, not `dash*`, because `dash*` would also take paths such as `/dashboard` away from the existing site. `www` is not routed. `www.whatshappeningnetwork.com/dash` still hits the `whatshappening` Worker.

The dashboard password is required. If `DASH_PASSWORD` is missing, every path returns 403. Cloudflare Access stays optional. If both `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` are set, the Worker checks the Access JWT before the password. If only one Access var is set, the Worker returns 403. When the password gate is active, pages do not show "Cloudflare Access is not enabled yet", because the password form is the login.

## Data sources

All sheet URLs are plain vars in `wrangler.jsonc`. Posts and status point at the published Team HQ Log tabs. Docs points at the published Key docs and sheets tab only. A blank var, bad JSON, or a failed fetch renders an empty state. The page still loads.

Every bot logs in one workbook, Team HQ Log. Two tabs, two CSV links:

| Var | What it is |
| --- | --- |
| `POSTS_CSV_URL` | Posts tab. Columns: `posted_at_ct`, `bot`, `site`, `platform`, `account`, `status`, `topic`, `post_url`, `reach`, `clicks`, `signups`, `notes`. The bot comes from the `bot` column. Reach, clicks, and signups are kept with the row notes. |
| `STATUS_CSV_URL` | Status tab. Columns: `timestamp_ct`, `bot`, `state`, `task`, `link`, `needs_marc`. `state` is `started`, `working`, `finished`, `done`, `blocked`, or `idle`. `done` counts as `finished`. `working` counts as in progress, the same as `started`. `needs_marc` is `yes` or `no`. The newest row by timestamp is the current task. A later row wins when timestamps match. |
| `DOCS_CSV_URL` | Key docs and sheets tab. Columns: `Name`, `Link`, `What it is`, `Owner bot`. |
| `BOT_REPO_MAP` | JSON object of repo name to bot name. |
| `ACCESS_AUD` | Cloudflare Access application AUD tag. |
| `ACCESS_TEAM_DOMAIN` | Team issuer, for example `https://your-team.cloudflareaccess.com`. |
| `BASE_PATH` | Path prefix. Set to `/dash`. |

Example posts tab value (one string, the published CSV for that tab):

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=POSTS_GID
```

Posts and status are tabs of the Team HQ Log workbook. Docs is a different workbook. `DOCS_CSV_URL` is only the published Key docs and sheets tab. The Worker requests that exact URL. A redirect is followed only when it keeps the same `gid`. It does not list tabs and it does not request any other gid. That workbook has private tabs.

The bot column on the posts and status tabs is matched to the fixed roster without case sensitivity. Display names: Chief, Bob (Bob The Builder), money-man, Walton, Foody (Foody & Friends), Tango, Tik-Toker, Rank, Outreach, Scout, Warden, Savenello Marketing, Personal Assistant. Each character in the office is a link to `/dash/bot/:slug`. That page starts with Job responsibilities. The sentences live in `src/jobs.ts`, one list per bot, so they can be edited without touching the page layout.

`/dash/docs` reads `DOCS_CSV_URL` on the same page load and caches the CSV for about 5 minutes, like the other sheets. Rows are grouped by Owner bot, roster order first, then any other owner names. The name is the link and "What it is" sits under it. A row is skipped when Name contains `DELETE`, or when Link is not an http or https URL on `docs.google.com` or `drive.google.com`. Cells that look like secrets are not rendered. A secret-shaped description is left blank. Each bot page links that bot's handbook (a row whose name contains handbook), or the Team handbooks folder when that bot has none, and lists the bot's other docs. When `DOCS_CSV_URL` is blank the page says "Docs sheet is not connected yet."

GitHub reads `marcongit850` with cached calls. The first call is a GraphQL query for the 12 most recently pushed repos (merged PRs, open PRs, recent commits). Each call sends `User-Agent: team-hq` and `Authorization: Bearer`. A token saved with a leading `Bearer` or `token` prefix is still sent once. The Worker logs `github_response` with the path and HTTP status, and `github_http_error` when a call fails. It does not log the token. A successful response is kept when `response.url` is empty, which the runtime can do on a POST. If GraphQL does not return the user, the Worker reads `GET /users/marcongit850/repos` and then pulls and commits for each repo. One repo that fails does not drop the others. The page names the failed call and includes the HTTP status. Search for open PRs is extra. A search failure does not hide history that loaded. Attribution:

1. PR title or branch contains the whole word `security` or `warden`: Warden. `seo` or `rank`: Rank. Warden wins if both match.
2. `BOT_REPO_MAP` overrides the default and the name prefix.
3. Repo names starting with `savenello` or `money` belong to money-man.
4. Everything else is Bob.

## Secrets

Only the secret name is listed here. Do not put the value in git, in `wrangler.jsonc`, or in a var.

- `GITHUB_TOKEN`: read-only fine-grained GitHub token that can read pull requests, contents, and metadata on `marcongit850` repositories. Set it with `npx wrangler secret put GITHUB_TOKEN`.
- `DASH_PASSWORD`: shared dashboard password. Set it with `npx wrangler secret put DASH_PASSWORD`. Until it is set, the Worker denies every request.
- `DASH_COOKIE_SECRET`: optional HMAC key for the session cookie. Set it with `npx wrangler secret put DASH_COOKIE_SECRET`. When it is unset, the password is the HMAC key, so changing the password signs out existing sessions.

`GITHUB_TOKEN` is optional at runtime. If it is missing, GitHub shows as not connected and the rest of the page still renders. None of these names are in `secrets.required`, because that check would refuse `npx wrangler deploy` before the values exist. `DASH_PASSWORD` is still required to open the site: a deploy without it answers 403.

Sheet URLs are vars, so anyone who can read the Worker config can see them. Do not hide a credential inside a URL. Publish the tabs, or use a link that is already public to the internet. The Worker fetches server side and cannot use your browser cookies.

## Cost while idle

- No cron triggers in config, and none should be added in the dashboard
- No Workers AI and no other model calls
- The browser has no script, no polling, and no auto refresh
- Upstream reads happen only when someone opens a page
- Those reads use the Cache API (`caches.default`) with `max-age=300` (about 5 minutes)
- The HTML response is `private, no-store`. Only the sheet and GitHub bodies are cached
- Opening a page reads the current red-mark keys from KV. Clear writes one key. Nothing reads KV while the site is idle
- The Cache API is per data center. The first request in a city after expiry fetches again. Nobody is called when the tab is closed

Draft, scheduled, skipped, cancelled, failed, idea, planned, and queued rows are hidden. Open pull requests older than 24 hours show under Needs you. A bot is typing only when its newest status row, by timestamp, is `started` or `working`, and that row is not older than about 2 hours. A newer `finished`, `done`, or `idle` row stops typing. Posts, merged PRs, and commits stay in the feed and in history. They do not make a bot type, and they do not fill the typing bubble. The bubble is the current task while the bot is typing. `blocked` or `needs_marc=yes` on the latest row paints the red mark and does not force typing. Clear, on that Needs you item and on the bot page, dismisses the mark for that row. The button POSTs to `/dash/clear`. The HTML referrer policy is `same-origin`, so the browser sends the page origin on that post and still omits the dashboard URL on links to other sites. The Worker accepts the post only when the password cookie is valid and the Origin header matches the page. It stores `v1:<bot id>:<timestamp in milliseconds>` in the KV namespace bound as `DISMISSALS`. It does not change the Google Sheet. A newer `needs_marc=yes` row has a new timestamp, so the mark shows again. Open pull requests in Needs you stay, because they are not a status row.

Times are Central Time (`America/Chicago`). A sheet time with no zone is read as Central Time. A trailing `CT`, `CST`, `CDT`, or `Central Time` label means the same.

`?demo=1` renders fixture data and does not call Google or GitHub. It is not an access bypass. The password cookie is still required. If Access is on, the JWT is still required.

## Password gate

`/dash/login` is a form. A correct password sets cookie `hq_session`. The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/dash`, and `Max-Age` is 7 days. The value is `v1.<expiry>.<hmac>` signed with HMAC-SHA256. The key is `DASH_COOKIE_SECRET`, or `DASH_PASSWORD` when that secret is unset. The password check hashes both sides with SHA-256 and compares the digests in constant time. The signature check is constant time too. Eight wrong passwords from one IP in ten minutes return 429. That limit lives in the isolate, so it is a speed bump, not a global lock. The header has a Log out link to `/dash/logout`, which clears the cookie. CSS and the favicon load without the cookie so the login page can be styled. They do not include team data. A `next` value is accepted only when it stays under `/dash`.

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

Open `http://127.0.0.1:8787/dash/login`. Put `DASH_PASSWORD=...` in `.dev.vars` (gitignored). Add `GITHUB_TOKEN=...` in that same file when you want live GitHub data locally. Sample data, after login: `http://127.0.0.1:8787/dash?demo=1`.

## Gotchas

- Set `DASH_PASSWORD` or the site stays closed. Do not commit the password.
- Set both Access vars or neither. If only one is set, the Worker returns 403.
- `ACCESS_TEAM_DOMAIN` should be the team origin. Certs are read from `{origin}/cdn-cgi/access/certs`. The request must include `Cf-Access-Jwt-Assertion`.
- The password gate is the lock on `workers.dev` and on `/dash`. Access is an extra check when both Access vars are set. The cookie is `Secure`, so the browser stores it on https and on `http://127.0.0.1`.
- The route does not cover `www`. It also does not use a `dash*` wildcard.
- `POSTS_CSV_URL`, `STATUS_CSV_URL`, and `DOCS_CSV_URL` are single https CSV links. `BOT_REPO_MAP` is JSON stored in a string var. Invalid JSON is an empty state, not a crash.
- `DOCS_CSV_URL` is only the Key docs and sheets tab. Do not add another gid from that workbook. The Worker will not follow a redirect onto a different gid.
- Doc links are limited to `docs.google.com` and `drive.google.com`. A private sheet still has to be published for the CSV fetch. Do not put a token in a doc title, description, or link. Those cells are dropped.
- Keyword rules beat the repo map. A security PR on a savenello repo is Warden.
- The map and the `savenello` / `money` prefix do not look at words inside other words. `ranking` does not go to Rank. `seo-titles` does.
- Google must return CSV to an anonymous HTTPS GET. A private sheet that only you can open will fail and show an empty state.
- Cache entries are not purged globally. After you change a sheet, wait about 5 minutes, or expect the previous copy until that datacenter expires it.
- Do not add a cron, a scheduled handler, or a meta refresh. Any of those would wake the Worker while nobody is looking.
- `DISMISSALS` is Workers KV namespace `dashboard-DISMISSALS`, id `1e0c1227633e4277b77ec6d0245641ec`, in account `f1c59948520f1ec39473238b621c7e24`. The namespace has to exist before deploy. On a new account, run `npx wrangler kv namespace create DISMISSALS` and put the printed id in `wrangler.jsonc`. Local `wrangler dev` keeps Clear keys on disk and does not write the remote namespace.
