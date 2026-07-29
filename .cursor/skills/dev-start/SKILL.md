---
name: dev-start
description: Starts the Next.js development server for this project and reports the local URL. Use when the user asks to start the app, run the dev server, boot the site locally, or says "dev-start".
disable-model-invocation: true
---

# Dev Start

Starts the Next.js dev server (`pnpm dev`) in the background and confirms it is serving.

## Steps

1. **Check for an existing server.** Read the terminal files metadata in the terminals folder for a running `pnpm dev` / `next dev`. If one is already running, report its URL instead of starting a second server.

2. **Install dependencies if missing.** If `node_modules/` is absent, run `pnpm install` first.

3. **Start the server in the background.** Run with `block_until_ms: 0`:

```bash
pnpm dev
```

4. **Wait for readiness.** Poll the shell output for the ready line, which includes the local URL:

```
- Local:        http://localhost:3000
✓ Ready in 1.2s
```

Match on `Local:|Ready in|Error|EADDRINUSE`.

5. **Report the result.** Give the user the local URL. If the port was taken, Next.js picks the next free port — report the port it actually chose, not `3000`.

## Failure handling

- **`EADDRINUSE` / port conflict**: Next.js normally shifts ports on its own. If it exits instead, identify the process holding the port and ask the user before killing anything.
- **Compile or module errors in the output**: report the error and the file it points to rather than restarting blindly.
- Do not run `pnpm build` or `pnpm start` for this skill — those are production commands.

## Verifying in the browser

Only when the user asks to see the app: navigate the Cursor browser to the reported URL and take a screenshot.
