# Percolate

A note-taking app that stores your notes as markdown files in a GitHub repository you own.

Percolate is built on the foundation of [**Lumen**](https://github.com/lumen-notes/lumen)
by Cole Bemis & contributors (MIT). It keeps Lumen's design system, editor, and
GitHub sync, and starts trimmed down as a base for further work:

- **Kept:** the full frontend (CodeMirror editor, calendar, command menu, tags,
  templates, theming), GitHub OAuth login, and in-browser git sync via
  `isomorphic-git`. State stays in **Jotai** + **XState**; schemas in **Zod**.
- **Removed:** the Supabase database (only an analytics endpoint used it) and all
  AI features (chat route + OpenAI voice assistant).

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS v4 + Radix / Base UI, `motion`
- CodeMirror 6 (markdown source editor)
- TanStack Router (file-based, `routeTree.gen.ts` is generated)
- Jotai (+ jotai-xstate) and XState for the sync state machine
- Zod for schema validation
- `isomorphic-git` + LightningFS for GitHub-backed storage

## Getting started

```bash
npm install
cp .env.example .env   # fill in the GitHub values below
npm run dev
```

Environment variables (`.env`):

| Variable                | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `VITE_GITHUB_PAT`       | A GitHub personal access token for local dev sign-in (skips OAuth). |
| `VITE_GITHUB_CLIENT_ID` | GitHub OAuth app client id (production sign-in).                    |
| `GITHUB_CLIENT_SECRET`  | GitHub OAuth app client secret (used by the auth function).         |
| `TMDB_API_KEY`          | Optional — powers the movie-poster template feature only.           |

The `/api/*` functions (GitHub OAuth callback, CORS proxy for git, git-LFS,
file proxy, share) are Vercel serverless functions; run them locally with
`npm run dev:vercel`.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # tsc + vite build (regenerates the route tree)
npm run lint       # eslint
npm run format     # prettier --write
npm run test       # vitest
```

## Credits & license

Percolate is derived from [Lumen](https://github.com/lumen-notes/lumen)
(MIT © 2024 Lumen). The original license is preserved in [`LICENSE`](./LICENSE).
Percolate is likewise MIT-licensed.
