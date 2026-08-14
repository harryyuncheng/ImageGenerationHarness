# Local Stability Bedrock Image Harness workspace instructions

## Development rules

- Use pnpm 11 and Node.js 22; preserve strict TypeScript and strict Zod boundaries.
- Keep the application fully local and single-user. Amazon Bedrock is the only cloud service boundary.
- Keep AWS credentials and SDK calls server-side. Never expose credentials through Vite variables, browser DTOs, metadata, or logs.
- Bind services only to loopback and retain Host, Origin, CSP, and private-storage safeguards.
- The user-selected local image repository is the sole source of truth for image-domain data.
- Centralize repository paths in `LocalImageRepository`; reject traversal, absolute records, malformed manifests, and symlink escapes.
- Use stable UUIDs for identity and filesystem-safe slugs only for display-derived directory names.
- Keep provider outputs immutable and byte-exact. Store strict adjacent `.image.json` sidecars; never put base64 bodies or secrets in sidecars.
- Project and project-asset descriptions are organizational only and must never alter a provider prompt.
- Direct Bedrock processing uses a bounded in-process queue with conservative default concurrency one.
- Keep queue items bound to their originating repository when repositories are switched.
- Recover queued jobs on startup. Mark an interrupted active attempt ambiguous; never retry it automatically.
- Polling is the authoritative browser update mechanism. Queued jobs may be cancelled; active provider calls cannot be reliably interrupted.
- Do not add a public API, authentication service, desktop wrapper, local SQL database, or unnecessary network infrastructure.
- Keep paid Bedrock tests opt-in and confirmation-gated. Normal verification must use mocks only.
- Run the `verify` task after changes, then run Playwright for browser changes.
