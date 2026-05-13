# Development Notes

## Environment

Desktop and mobile clients expect:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PARSE_FUNCTION_URL`

The parse Edge Function expects:

- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

## Desktop

```bash
npm run dev:desktop
```

The macOS client includes:

- `Command + Shift + K` quick capture focus.
- Clipboard text parsing.
- Local-first storage with `localStorage`.

## Mobile

```bash
npm run dev:mobile
npm run build:mobile
```

The mobile MVP includes:

- Manual quick capture.
- Clipboard parsing.
- Local masked review.
- Tags and sync placeholder.

The uni-app dependency family is pinned to `3.0.0-alpha-5000920260512001`.
Keep those versions aligned because mismatched `@dcloudio/*` packages can
resolve incompatible Vite plugins inside npm workspaces.

## Verification

```bash
npm run typecheck
npm run build
npm run check
```

## Supabase

Apply migrations from `supabase/migrations`.

Deploy the Edge Function from `supabase/functions/parse-knowledge`.

Desktop sync uses Supabase Auth and the `knowledge_items` / `review_logs`
tables. After creating a Supabase project:

```bash
cp apps/desktop/.env.example apps/desktop/.env
```

Fill:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then restart `npm run dev:desktop`. The "我的" page will show the Supabase
login panel. Existing local knowledge items are merged into the cloud after
login.

## Supabase MCP

Codex is configured globally with the hosted `supabase` MCP server:

```text
https://mcp.supabase.com/mcp
```

Authentication uses Supabase OAuth via `codex mcp login supabase`. This
repository also includes `.mcp.json` for MCP clients that prefer project-local
configuration with a personal access token.

For `.mcp.json` clients, set these environment variables before launching the
client:

- `SUPABASE_ACCESS_TOKEN`: Supabase personal access token.
- `SUPABASE_PROJECT_REF`: Optional project ref used by `.mcp.json` clients.

Use a development Supabase project for MCP work, and scope the server to one
project whenever possible.
