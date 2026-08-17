# My Notes

Cloudflare Worker version of my notes app.

## Files

- `src/worker.js` - routes, auth, storage, and page shells
- `src/notes.js` - seed notes
- `src/style.js` - shared styles
- `src/public-app.js` - public page behavior
- `src/manage-app.js` - hidden editor behavior
- `wrangler.toml` - worker config

## Setup

1. Bind a KV namespace to `NOTES`.
2. Put your KV namespace IDs into `wrangler.toml`.
3. Deploy with:

```bash
wrangler deploy
```

## Routes

- `/` public notes page
- `/manage` hidden editor
- `/api/notes` read notes
- `/api/notes/:id` update/delete notes
- `/api/notes/:id/usage` record public usage counters

## GitHub Actions

A workflow can deploy the worker with `wrangler deploy` on push to `main`. Set Cloudflare secrets in GitHub for the API token and account ID.

These secrets are read:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

## Seeding

Default notes are only loaded when `SEED_DEFAULT_NOTES=true` is present in the worker environment. Leave it unset for public deployments so the database stays the single source of truth.

## Keyboard shortcuts
Key(s) | Function
-- | --
"/" key or Ctrl+K or Cmd+K | Search focus
"j" and "k" keys or arrow keys | Move through visible cards
"Home" and "End" keys | Jump through visible cards
"Esc" key | Clear search focus
