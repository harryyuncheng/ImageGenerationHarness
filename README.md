# Local Bedrock and Foundry Image Harness

A local-first, single-user image-generation workbench for Stability AI models on Amazon Bedrock and OpenAI GPT Image deployments on Azure AI Foundry. The browser communicates only with a Fastify server bound to loopback. Image-domain data belongs to a user-selected folder on this Mac; the configured model providers are the only required cloud services.

## Baroque

The browser workbench provides:

- Stable Image Core, Stable Image Ultra, Stable Diffusion 3.5 Large, and the registered Stability Image Services on Amazon Bedrock.
- GPT Image 2 generation and editing on Azure AI Foundry.
- One upward-opening model dropdown per workflow, with Stability and GPT Image models available together. Models without server-side provider credentials remain visible but disabled, with their setup requirements.
- Model-aware controls for documented prompts, source images, styles, masks, strengths, quality, backgrounds, output formats, aspect ratios, and seed ranges.
- A local image-repository selector in Settings with native macOS folder selection, New Folder support, recent folders, and automatic reopening of the last valid repository.
- Projects with editable organizational descriptions, generated images, and nested project assets.
- An explicit generation destination: the main repository, a project, or a nested project asset.
- A fully local style guide of reusable image folders. Applying one folder attaches its images to Create-tab generations through opaque `repo-image://<image-id>` browser references.
- A mask editor for the targets that accept one, with box, pen, and eraser tools plus undo. It exports the encoding the selected provider expects, so the same drawing works on Stability and GPT Image.
- Durable server-backed history and gallery views for retained work, polling-based status, and cancellation of queued work. Selecting a saved image or run loads it into the main area beside the prompt it was made from. Failed attempts surface as pop-up errors and are discarded.
- Adjacent, strict JSON sidecars containing the exact prompt, normalized settings, seed provenance, dimensions, hashes, invocation target, inputs, and non-secret provider metadata.

Project and project-asset descriptions are organizational notes only. They are never included in a provider request.

## Prerequisites

- macOS, Node.js 22.9 or newer, and pnpm 11
- For Amazon Bedrock: model access in US West (Oregon), `us-west-2`, with credentials available through the standard AWS SDK credential chain, such as an AWS profile or an active IAM Identity Center session
- For Azure AI Foundry: a `gpt-image-2` deployment on an Azure OpenAI resource

At least one provider must be reachable. No deployment or infrastructure provisioning is required.

## Development

1. Install dependencies with `pnpm install`.
2. Run `pnpm dev`.
3. Open `http://127.0.0.1:5173`.
4. Choose an image repository from Settings → Repository, creating a new folder in the native picker if needed.

The API server listens on `127.0.0.1:4173` by default. `HARNESS_PORT` may select another loopback port. The server pins its Bedrock Runtime client to `us-west-2`, the only endpoint that supports all three registered generation models; Image Services use their US Geo inference profiles from that supported source region.

Azure AI Foundry is enabled by setting `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`; the provider reports itself unconfigured until both are present. Copy `.env.example` to `.env` in the repository root and fill it in — the server loads that file at startup, so the values survive closing the terminal. `AZURE_OPENAI_API_VERSION` and `AZURE_OPENAI_IMAGE_DEPLOYMENT` override the pinned API version and the `gpt-image-2` deployment name from the registry. A variable already exported in the shell takes precedence over the file, which keeps one-off overrides working.

`AZURE_OPENAI_ENDPOINT` accepts the resource root, an `/openai/v1/` base URL, or a full `/openai/v1/images/generations` or `/openai/v1/images/edits` URL copied from Azure. The server removes that API suffix before constructing the deployment-specific request URL. Restart the API server after changing `.env`, and restrict the file to your account with `chmod 600 .env`.

`.env` is gitignored and only ever read by the server process. It cannot reach the browser: Vite inlines only `VITE_`-prefixed variables, and its dev server refuses to serve `.env` files. Provider credentials must never be given a `VITE_` prefix or placed in browser DTOs, sidecars, or browser storage. The browser learns only whether a provider is configured, never any credential value.

The native folder chooser is implemented with `/usr/bin/osascript` through `execFile`; no shell command string is used. Application preferences store only active and recent canonical repository paths in `~/Library/Application Support/ImageGenerationHarness/config.json`. Repository-domain records remain inside the selected repository.

## Source layout

The monorepo keeps deployable applications separate from reusable boundaries:

```text
apps/
  web/src/
    app/          # application composition and shell
    features/     # generation, editing, gallery, projects, style guide, and history
    shared/       # browser-only HTTP, hooks, image helpers, and reusable UI
    styles/       # ordered global, shell, shared, and feature styles
  server/src/
    app/          # Fastify composition, errors, and loopback security
    repository/   # selected-repository path and filesystem authority
    projects/     # project and nested-asset behavior
    style-guide/  # local style guide behavior
    runs/         # durable run orchestration, queueing, workers, and recovery
    images/       # generated-image lookup, integrity checks, and HTTP routes
    providers/    # server-only provider adapters and the shared invocation interface
packages/
  capabilities/   # model catalog and strict provider schemas
  contracts/      # browser/server API schemas grouped by resource
  domain/         # durable repository record schemas grouped by entity
  image/          # byte, format, hash, and sidecar utilities
```

Application code is feature-first. Feature modules may depend on their application-level shared code and workspace packages, while workspace packages must not depend on either application. Package root `index.ts` files are stable re-export surfaces rather than implementation modules.

ESLint treats production files above 425 non-blank, non-comment lines as an architecture failure and warns when a production function exceeds 200 lines. These are review signals rather than targets: modules should still be split whenever they acquire more than one reason to change.

## Repository layout

```text
<selected-root>/
  .image-harness/
    repository.json
    runs/
    jobs/
    inputs/
  images/
  style-guide/
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

`POST /api/runs` validates and durably writes local run/job records before placing jobs on a bounded in-process queue. Concurrency defaults to one. The server verifies local input hashes, converts only the trusted bytes to base64 for the model request, invokes the target's provider directly with retries disabled, validates the response, and writes outputs to the selected destination.

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
- Style guide bytes selected for a run are snapshotted under the repository control directory so later edits do not invalidate queued work.

## Prompt caching

Prompt caching remains unsupported by the registered image targets. Their strict request schemas contain no cache-checkpoint field, so the harness sends no undocumented cache controls.

## Verification

- `pnpm verify` runs formatting, linting, strict type checks, and production builds.

See [docs/architecture.md](docs/architecture.md) for boundaries and recovery semantics, and [docs/model-capabilities.md](docs/model-capabilities.md) for the audited model matrix.
