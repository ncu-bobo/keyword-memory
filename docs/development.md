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
