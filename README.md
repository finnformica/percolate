# Percolate

A note-taking app that stores your notes as markdown files in a GitHub repository you own.

Percolate is built on the foundation of [**Lumen**](https://github.com/lumen-notes/lumen)
by Cole Bemis & contributors (MIT). It keeps Lumen's design system, editor, and
GitHub sync, trimmed down and re-hosted on Cloudflare:

- **Kept:** the full frontend (CodeMirror editor, calendar, command menu, tags,
  templates, theming), GitHub OAuth login, and in-browser git sync via
  `isomorphic-git`. State stays in **Jotai** + **XState**; schemas in **Zod**.
- **Removed:** the Supabase database and all AI features. Vercel is replaced by a
  **Cloudflare Worker** that serves the app and the small set of API endpoints.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS v4 + Radix / Base UI, `motion`
- CodeMirror 6 (markdown source editor)
- TanStack Router (file-based; `routeTree.gen.ts` is generated)
- Jotai (+ jotai-xstate) and XState for the sync state machine
- Zod for schema validation
- `isomorphic-git` + LightningFS for GitHub-backed storage
- **Cloudflare Workers** (Static Assets) for hosting + API routes

## How auth works

Notes live in your GitHub repo, so the app needs a GitHub token:

- **Production:** the OAuth flow. The sign-in button sends you to GitHub; GitHub
  redirects back to the Worker's `/github-auth` route, which exchanges the
  `code` for an access token using your **client secret** (a Worker secret,
  never in the frontend bundle). The token is returned to the app and used for
  git.
- **Local dev:** set `VITE_GITHUB_PAT` in `.env` to sign in directly with a
  personal access token (skips OAuth).

## Local development

```bash
npm install
cp .env.example .env            # frontend build vars (VITE_*)
npm run dev                     # http://localhost:5173 — UI only, no API
```

`npm run dev` doesn't run the Worker, so **git sync won't work** (the cors-proxy
lives in the Worker). For the full app locally, run it through Wrangler:

```bash
cp .dev.vars.example .dev.vars  # Worker vars/secrets for local dev
npm run dev:worker              # builds, then serves app + API via wrangler dev
```

## Deploying to Cloudflare

```bash
# One-time: set the OAuth client id (public) and secret
#   - add VITE_GITHUB_CLIENT_ID under "vars" in wrangler.jsonc (or the dashboard)
npx wrangler secret put GITHUB_CLIENT_SECRET

npm run deploy                  # tsc + vite build, then wrangler deploy
```

Then point your GitHub OAuth app's **Authorization callback URL** at
`https://<your-worker-domain>/github-auth`.

### Worker routes

The Worker (`worker/index.ts`) serves the built SPA from `dist/` and handles:

| Route           | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `/cors-proxy/*` | Relays git-over-http so the browser can talk to GitHub      |
| `/github-auth`  | OAuth `code` → access-token exchange                        |
| `/file-proxy`   | Proxies binary files (Git LFS blobs)                        |
| `/git-lfs-file` | Resolves/uploads Git LFS objects                            |
| `/share/*`      | OG meta tags for shared-note link previews (SPA for humans) |

## Scripts

```bash
npm run dev          # Vite dev server (frontend only)
npm run dev:worker   # build + wrangler dev (full app with API)
npm run build        # tsc + vite build
npm run deploy       # build + wrangler deploy
npm run check:worker # typecheck the Worker
npm run lint         # eslint
npm run knip         # dead-code check (unused files, deps, exports)
npm run format       # prettier --write
npm run test         # vitest
```

## Credits & license

Percolate is derived from [Lumen](https://github.com/lumen-notes/lumen)
(MIT © 2024 Lumen). The original license is preserved in [`LICENSE`](./LICENSE).
Percolate is likewise MIT-licensed.
