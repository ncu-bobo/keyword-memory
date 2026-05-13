# Keyword Memory

Keyword Memory is a fast-capture knowledge app focused on three actions:

- Save a knowledge point in about 10 seconds.
- Extract high-value keywords from long text with AI.
- Review with masked keywords until the idea can be recalled.

## Apps

- `apps/mobile`: uni-app mobile/H5 client.
- `apps/desktop`: Electron + Vue desktop client for macOS.
- `packages/core`: shared types, parsing helpers, and review scheduling.
- `packages/supabase`: Supabase browser client helper.
- `supabase`: database migrations and Edge Functions.

## Quick Start

```bash
npm install
npm run check
npm run dev:desktop
```

For mobile H5 development:

```bash
npm run dev:mobile
```

Create local environment files from the examples:

```bash
cp apps/desktop/.env.example apps/desktop/.env
cp apps/mobile/.env.example apps/mobile/.env
cp supabase/functions/parse-knowledge/.env.example supabase/functions/parse-knowledge/.env
```

## MVP Scope

- Home: manual quick capture and AI text extraction.
- Review: masked keyword recall with remembered/vague/forgot feedback.
- Mine: tags, sync status, and settings entry points.
