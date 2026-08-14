# Local Stability Bedrock Image Harness

A local-first, single-user image-generation workbench for Stability AI models on Amazon Bedrock. The browser communicates only with a Fastify server bound to loopback. Image-domain data belongs to a user-selected folder on this Mac; Amazon Bedrock is the only required cloud service.

## Baroque

The browser workbench provides:

- Stable Image Core, Stable Image Ultra, Stable Diffusion 3.5 Large, and the registered Stability Image Services.
- Model-aware controls for documented prompts, source images, styles, masks, strengths, output formats, aspect ratios, and seed ranges.
- A prominent local image-repository selector with native macOS folder selection, New Folder support, recent repositories, and automatic reopening of the last valid repository.
- Projects with editable organizational descriptions, generated images, and nested project assets.
- An explicit generation destination: the main repository, a project, or a nested project asset.
- A fully local reference-image library with reusable folders and opaque `repo-image://<image-id>` browser references.
- Durable server-backed history and gallery views for retained work, polling-based status, cancellation of queued work, explicit retries for interrupted runs, and generated metadata inspection. Failed attempts surface as pop-up errors and are discarded.
- Adjacent, strict JSON sidecars containing the exact prompt, normalized settings, seed provenance, dimensions, hashes, invocation target, inputs, and non-secret provider metadata.

Project and project-asset descriptions are organizational notes only. They are never included in a Bedrock request.

## Prerequisites

- macOS, Node.js 22, and pnpm 11
- Bedrock model access in US West (Oregon), `us-west-2`
- Credentials available through the standard AWS SDK credential chain, such as an AWS profile or an active IAM Identity Center session

No deployment or infrastructure provisioning is required.

## Development

1. Install dependencies with `pnpm install`.
2. Run `pnpm dev`.
3. Open `http://127.0.0.1:5173`.
4. Choose an image repository from the Studio header, creating a new folder in the native picker if needed.

The API server listens on `127.0.0.1:4173` by default. `HARNESS_PORT` may select another loopback port. The server pins its Bedrock Runtime client to `us-west-2`, the only endpoint that supports all three registered generation models; Image Services use their US Geo inference profiles from that supported source region. AWS credentials remain in the server process and must never be placed in Vite variables or browser storage.

The native folder chooser is implemented with `/usr/bin/osascript` through `execFile`; no shell command string is used. Application preferences store only active and recent canonical repository paths in `~/Library/Application Support/ImageGenerationHarness/config.json`. Repository-domain records remain inside the selected repository.

## Repository layout

```text
<selected-root>/
  .image-harness/
    repository.json
    runs/
    jobs/
    inputs/
  images/
  references/
    <folder-slug>--<folder-id>/
  projects/
    <project-slug>--<project-id>/
      project.json
      images/
      assets/
        <asset-slug>--<asset-id>/
          asset.json
          images/
```

Generated image bytes are immutable and byte-exact. Each image has an adjacent `.image.json` provenance sidecar. Files are written with temporary-file-plus-rename or immutable-link semantics under an in-process repository mutation lock.

## Local processing and recovery

`POST /api/runs` validates and durably writes local run/job records before placing jobs on a bounded in-process queue. Concurrency defaults to one. The server verifies local input hashes, converts only the trusted bytes to base64 for the model request, invokes Bedrock directly with SDK retries disabled, validates the response, and writes outputs to the selected destination.

If an invocation fails, polling delivers a minimal one-shot error notification from memory. The failed job and attempt records, partial outputs, and any now-unreferenced staged inputs are removed instead of entering recents or history. The browser leaves the current prompt, attachments, and generation settings intact so the request can be corrected or rerun.

Polling through `GET /api/runs/:runId` remains authoritative. On restart, queued jobs resume. A job that was running is marked interrupted with an ambiguous attempt because the provider may already have accepted and billed the call; it is never retried automatically. Queued jobs can be cancelled, while an active provider call cannot be reliably interrupted.

Switching repositories does not redirect already queued work: every in-memory queue item remains bound to the repository that created it.

## Security and data guarantees

- Host, Origin, CSP, and loopback binding safeguards are enforced by Fastify.
- Repository-relative records are validated as untrusted input.
- Traversal, absolute paths, malformed manifests, and symlink escapes are rejected by the centralized repository layer.
- Content routes resolve stable IDs through validated records; they do not accept filesystem paths.
- Browser DTOs omit absolute paths, internal input paths, and provider request bodies.
- Sidecars contain no credentials, authorization data, or base64 image bodies.
- Reference bytes selected for a run are snapshotted under the repository control directory so later library edits do not invalidate queued work.

## Bedrock prompt caching

Prompt caching remains unsupported by the registered Stability image targets. Their strict request schemas contain no cache-checkpoint field, so the harness sends no undocumented cache controls.

## Verification

- `pnpm verify` runs formatting, linting, strict type checks, unit/golden tests, and production builds.
- `pnpm test:e2e` runs the Playwright browser suite.

Tests use temporary repositories and a mocked Bedrock invoker. They do not make paid provider calls. See [docs/architecture.md](docs/architecture.md) for boundaries and recovery semantics, and [docs/model-capabilities.md](docs/model-capabilities.md) for the audited model matrix.
