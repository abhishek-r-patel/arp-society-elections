# Deploying to Cloudflare (one-time setup)

This project deploys as two independent pieces — a Cloudflare Pages site (the
React frontend) and a Cloudflare Worker (the API, backed by a production D1
database) — both **only** via manual GitHub Actions runs
(`.github/workflows/deploy-frontend.yml` / `deploy-worker.yml`, both
`workflow_dispatch`-only). Neither piece is connected to Cloudflare's own Git
integration, so **nothing builds automatically** on any push to any branch —
a deploy only happens when you explicitly run one of these workflows from the
repo's **Actions** tab (or `gh workflow run <file>`).

Do the steps below once. After that, deploying a change is just: push to
`main`, then run the relevant workflow(s) manually.

## 1. Create a Cloudflare API token

Dashboard → **My Profile → API Tokens → Create Token → Custom token**, with:
- **Account – Cloudflare Pages – Edit**
- **Account – Workers Scripts – Edit**
- **Account – D1 – Edit**

Copy the token (shown once) and your **Account ID** (Dashboard home page, right
sidebar).

## 2. Add GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → Secrets** tab:
- `CLOUDFLARE_API_TOKEN` — the token from step 1
- `CLOUDFLARE_ACCOUNT_ID` — your account ID

## 3. Create the production D1 database

From `worker/`, logged in locally (`npx wrangler login`, or set
`CLOUDFLARE_API_TOKEN` in your shell for that command only):
```powershell
npx wrangler d1 create election-db
```
Copy the `database_id` it prints into `worker/wrangler.toml`'s
`[[env.production.d1_databases]]` block (replacing the placeholder
`00000000-...`), then commit that change.

## 4. Set the Worker's production secrets

These are set directly against Cloudflare (never via GitHub Actions or a
committed file) — run once from `worker/`:
```powershell
npx wrangler secret put ADMIN_PASSWORD_HASH --env production
npx wrangler secret put ADMIN_SESSION_SECRET --env production
npx wrangler secret put CREDENTIAL_PEPPER --env production
```
Use the same hash-generation approach as local dev for the password
(`npm run set-admin-password -- "..."` prints the hash to paste in when
prompted — it does not write to `.dev.vars` for `--env production`).
`ADMIN_SESSION_SECRET` / `CREDENTIAL_PEPPER` should be different long random
strings than your local `.dev.vars` values.

## 5. First Worker deploy

Repo → **Actions → Deploy Worker to Cloudflare → Run workflow** (branch:
`main`). This applies `schema.sql` to the production database and deploys the
Worker. Open the run's log and note the deployed URL, e.g.
`https://arp-society-elections-worker.<your-subdomain>.workers.dev`.

## 6. Create the Pages project as Direct Upload

Dashboard → **Workers & Pages → Create → Pages → Upload assets** (*not*
"Connect to Git" — that path enables Cloudflare's own auto-build-on-push,
which is exactly what we don't want here). Name the project
`arp-society-elections`. You can upload any placeholder file to finish
creating it; the real content comes from the GitHub Actions workflow.

## 7. Add a GitHub repo variable for the Worker URL

Repo → **Settings → Secrets and variables → Actions → Variables** tab → new
repository variable:
- `WORKER_URL` = the `*.workers.dev` URL from step 5 (no trailing slash)

## 8. Point the Worker's CORS at the real Pages URL

Edit `worker/wrangler.toml`'s `[env.production.vars]` → `ALLOWED_ORIGIN` to
your actual Pages URL (`https://arp-society-elections.pages.dev`, adjusted if
that name was taken), commit, then re-run **Deploy Worker to Cloudflare**.

## 9. First frontend deploy

Repo → **Actions → Deploy Frontend to Cloudflare Pages → Run workflow**
(branch: `main`). Visit the Pages URL and confirm login/voting works
end-to-end.

## Redeploying after changes

Push your change to `main`, then run the affected workflow(s) manually from
the Actions tab — the Worker workflow re-applies `schema.sql` (safe: it's all
`CREATE TABLE/INDEX IF NOT EXISTS`) and redeploys the Worker; the frontend
workflow rebuilds and redeploys the Pages site. Nothing else triggers either
one.

## Why the cross-origin cookie/CORS handling exists

Without a custom domain, the Pages site (`*.pages.dev`) and the Worker
(`*.workers.dev`) are different origins, so the admin session cookie needs
`SameSite=None; Secure` (see `worker/src/routes/admin.ts`) instead of the
`SameSite=Lax` used for local dev, and the Worker must send explicit CORS
headers naming the Pages origin (see `worker/src/index.ts` /
`worker/src/http.ts`'s `corsHeaders()`) since `Access-Control-Allow-Origin: *`
is not allowed together with credentialed requests. If you later add a custom
domain and route the Worker at `yourdomain.com/api/*` alongside Pages on the
same origin, none of this is required to change — `SameSite=None` still works
fine same-origin, it's just stricter than necessary there.
