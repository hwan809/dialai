<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DialAI phone-call safety

For any request that asks to place or check a real phone call, use the registered DialAI MCP tools. Web search may be used to find and verify a public business number, but do not create temporary calling scripts, import `ClawOpsVoiceGateway` from the repository, or invoke ClawOps/OpenAI telephony through the shell.

If `create_phone_call` is not present, MCP authentication fails, or the MCP endpoint is unreachable, stop and report that DialAI is unavailable. Do not bypass the missing MCP connection. Call `create_phone_call` at most once per user-approved destination and use its idempotency key for retries.
