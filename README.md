# Local Bedrock and Foundry Image Harness

A local-first, single-user image-generation workbench for Stability AI models on Amazon Bedrock and OpenAI GPT Image deployments on Azure AI Foundry. The browser communicates only with a Fastify server bound to loopback. Image-domain data belongs to a user-selected folder on this Mac; the configured model providers are the only required cloud services.

## Constable

The browser workbench provides:

- Stable Image Core, Stable Image Ultra, Stable Diffusion 3.5 Large, and the registered Stability Image Services on Amazon Bedrock.
- GPT Image 2 generation and editing on Azure AI Foundry, with up to 16 ordered image inputs. Create accepts 16 optional references; Edit accepts a source plus 15 references and an optional source mask. Both support negative prompts through ordinary-language exclusions appended to the provider prompt.
- One upward-opening model dropdown per workflow, with Stability and GPT Image models available together. Models without server-side provider credentials remain visible but disabled, with their setup requirements.
- Model-aware controls for documented prompts, source images, styles, masks, strengths, quality, backgrounds, output formats, aspect ratios, and seed ranges. Toolbar pop-ups use title-only headers.
- A text-only Negative prompt toolbar button opens a compact multiline editor using the same popover as the image-count and other toolbar controls. Edits persist as you type; long text scrolls vertically with a thin, theme-colored scrollbar. The toolbar expands to fit the button without widening the other top-row controls, and the workflow tabs share the extra width equally.
- The prompt moves smoothly between its centered layout and the left side when working images appear or are dismissed, without replacing the text editor. Text automatically shrinks to fit its allotted area, down to 24 px before scrolling, and grows back when space permits. Movement respects reduced-motion preferences.
- A local image-repository selector in Settings with native macOS folder selection, New Folder support, recent folders, and automatic reopening of the last valid repository.
- Appearance settings with local Sans, Serif, and Mono font choices, previewed in their own typefaces and remembered on this device. Cutting mat Dark, Build, and Craft retain the exact black, green, and blue backgrounds sampled from the original-resolution [Draftpad artwork](https://themousepadcompany.com/collections/utility). Softer foreground ink and lower-contrast grid and ruler colours stay consistent across the canvas, gallery, and previews. Settings reopens to the last selected section.
- Configurable shortcuts for focusing the prompt, creating, adding images, and opening Settings. Record a combination in Settings → Shortcuts, remove a binding, or restore defaults. Conflicts appear inline, and Escape and normal text editing remain available.
- An ungrouped saved-preset library with optional covers uploaded from your computer or copied from your gallery. Click a cover to append its prompt without leaving the picker; mix and match presets without replacing what you have written. The canvas shortcut is a large bookmark tilted toward north-northwest and partly tucked beyond the left edge, with a centered plus and the style-guide cards' muted fill and dashed outline. Prompts and covers stay in the selected local repository, and covers are never sent to a model.
- A fully local gallery of reusable style guides, with first-four-image covers and separate image views with back navigation. The side stack opens the applied guide directly, or the gallery when none is applied. Every visible image in the applied guide unfolds from the three-card fan and collapses back on close, including images hidden in its preview. Guides with three or more images share a fully offscreen anchor at the fan's vertical center; one- and two-image guides use the visible first and second cards. Reduced-motion preferences skip this movement. Close with X or Escape, not by clicking outside the guide. Applying a folder adds guide images through opaque `repo-image://<image-id>` references without replacing attached sources, references, or their masks, and returns to the canvas. Changing or unapplying a guide preserves other attachments, and opening or closing the guide preserves the loaded preview. A model that cannot combine a guide with the current attachments reports its input limit inline instead of replacing them. Active guide previews stay in the left-hand stack rather than being duplicated in the main area. Each image has a plus/minus control to include or exclude it from the request without deleting its file; these individual changes keep the guide open. Selecting an image from another guide switches the active guide. Click a guide or image name to rename it inline. GPT Image 2 stays in Create when a guide is applied; describe the references' style or role in the prompt. Excess references block generation until removed.
- The main image area appears only for actual source images or output previews, including pending outputs. With none, the prompt keeps its full-width layout: no empty image slots, upload tiles, or reserved drop zones. Use the toolbar's Add images action, the image shortcut, or drop files without a dedicated drop area. Source images retain their fitted size. Every main-area image has an unboxed X over its top-right corner to remove the current source or dismiss the output preview, without deleting saved files or cancelling generation. Opening an output restores its original inputs rather than making the output a source. Drag the large output into the far-right reference area to use it as a reference instead: this clears the main preview and source-bound mask, removes the source input, and recenters the prompt. Other references stay attached; unsupported models or full reference slots report the conflict inline without changing the setup.
- Temporary reference images form a floating vertical stack at the right edge without shifting the prompt or working images. Previews share a responsive height capped at 180 px, with widths following their natural aspect ratios. Preset alternating tilts and a 20% outward offset tuck each image partly off-screen. There are no rounded corners, borders, captions, or numbering; each has an unboxed X over its top-left corner. The stack scrolls vertically when needed, preserves reference order, and never duplicates style-guide previews.
- Live in-place masking: draw directly over the source image with box, pen, eraser, undo, clear, and mask upload in a compact icon toolbar. Each completed stroke, undo, and clear immediately updates the next request, without an apply or cancel step. Masks stay visible over their source, and switching providers preserves the selection while converting its encoding. Generation waits only while a stroke or mask conversion is in progress, or an input needs correction.
- A zoomed-out gallery at `/gallery` on the same ruled sheet. Matching bordered circular controls sit in the bottom corners: Settings on the left and an icon-only gallery/create switch on the right. Saved outputs form a continuous newest-first grid of uncropped images without headings, captions, numbering, or hover movement. Buttons and browser history share a transform-based zoom that does not wait for unrelated thumbnails to load.
- Durable server-backed history, polling-based status, and cancellation of queued work. In-progress images appear as thumbnail-sized skeletons in the gallery grid, preserving the submitted aspect ratio. Pending and saved images use the same gallery card, image frame, and measured camera transition. Selecting either restores the original prompt, model, generation controls, image count, seed mode, selected style-guide images, and ordered source/reference/mask inputs. Completed pixels replace the skeleton inside the same frame without overwriting subsequent draft edits. Back to canvas (or Escape) preserves the current draft and loaded image; the overview hides the style guide and generation toolbar. Failed attempts surface inline and are discarded without deleting successfully saved images.
- Adjacent, strict JSON sidecars containing the exact prompt, captured generation controls, normalized request, seed provenance, dimensions, hashes, invocation target, style-guide identity and name, immutable input snapshots, and non-secret provider metadata. Saved setups remain usable after a guide is renamed or deleted. Older images restore the parameters and inputs already recorded; unrecorded editor controls use defaults.

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

`AZURE_OPENAI_ENDPOINT` accepts the resource root, an `/openai/v1/` or `/openai/deployments/<name>/` base URL, or a full image generation/edit URL under either base copied from Azure. The server removes that API suffix before constructing the request URL; the deployment name still comes from `AZURE_OPENAI_IMAGE_DEPLOYMENT` or the registry default. Restart the API server and refresh the browser after changing `.env`, and restrict the file to your account with `chmod 600 .env`.

`.env` is gitignored and only ever read by the server process. It cannot reach the browser: Vite inlines only `VITE_`-prefixed variables, and its dev server refuses to serve `.env` files. Provider credentials must never be given a `VITE_` prefix or placed in browser DTOs, sidecars, or browser storage. The browser learns only whether a provider is configured, never any credential value.

The native folder chooser is implemented with `/usr/bin/osascript` through `execFile`; no shell command string is used. Application preferences store only active and recent canonical repository paths in `~/Library/Application Support/ImageGenerationHarness/config.json`. Repository-domain records remain inside the selected repository.

## Source layout

The monorepo keeps deployable applications separate from reusable boundaries:

```text
apps/
  web/src/
    app/          # application composition and shell
    features/     # generation, editing, gallery, presets, style guide, and history
    shared/       # browser-only HTTP, hooks, image helpers, and reusable UI
    styles/       # ordered global, shell, shared, and feature styles
  server/src/
    app/          # Fastify composition, errors, and loopback security
    repository/   # selected-repository path and filesystem authority
    style-guide/  # local style guide behavior
    presets/      # saved prompts and decorative cover images
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
  presets/
    <preset-slug>--<preset-id>/
      preset.json
      cover--<image-id>.<ext>
      cover--<image-id>.image.json
```

Generated image bytes are immutable and byte-exact. Each image has an adjacent `.image.json` provenance sidecar. Files are written with temporary-file-plus-rename or immutable-link semantics under an in-process repository mutation lock.

Reopening a folder reuses its repository identity and mutation lock. A moved repository retains its UUID, but another known, still-available folder cannot share that UUID. Repository selection changes become active only after their preferences are saved; a failed save leaves the previous selection intact.

## Local processing and recovery

`POST /api/runs` includes the originating repository UUID and durably writes local run/job records before placing jobs on a bounded in-process queue. Switching folders during an upload cannot redirect the request. Concurrency defaults to one. The server verifies local input hashes, converts only the trusted bytes to base64 for the model request, invokes the target's provider directly with retries disabled, validates the response, and writes outputs into the originating repository's `images/` directory.

GPT Image 2 uses `images/generations` for text-only requests and `images/edits` whenever image inputs are present, including creating a new composition from references. The edit transport does not require modifying an existing composition. Ordered references are snapshotted separately, and a mask applies only to the first image. Azure inputs must be PNG or JPEG; the harness retains its 10 MiB per-image limit. The run-upload route allows bounded base64 payloads for all 16 images plus a separate mask without increasing other routes' body limits.

GPT Image has no native `negative_prompt` parameter. The server appends a blank line followed by `Avoid: <negative prompt>` to its normal prompt for both generation and editing, leaving an empty negative prompt out entirely. Stored prompts remain separate and unchanged; sidecar provider metadata records the combined `effectivePrompt` when exclusions are added. Stability targets continue to use their native negative-prompt field. These are model instructions, not guaranteed exclusions; see [the prompting sources](docs/model-capabilities.md#sources).

While a request is submitting, queued, or generating, the canvas shows a skeleton in the image's place, shaped to the submitted aspect ratio or pixel dimensions. The gallery uses the same skeleton at thumbnail size for each pending output, without visible progress text. Polling retains that shape even if the draft settings change. An icon-only Reset settings button is always available just left of the Create toolbar, vertically centered, with a "Reset settings" hover label.

The app does not show pop-up notifications. Errors appear inline in the relevant canvas, form, or panel. When generation fails, polling delivers a minimal one-shot error from memory. The failed job and attempt records and any now-unreferenced staged inputs are removed instead of entering recents or history; a run with no remaining jobs is removed too. Successfully published images, their sidecars, and their required input snapshots are kept, even if another output in the same batch fails. The browser leaves the current prompt, attachments, and generation settings intact so the request can be corrected or rerun.

If saving final completion metadata fails, already-published outputs are preserved and the run is handled conservatively for recovery. Cleanup and recovery-write failures are reported inline rather than hidden, without exposing private filesystem paths.

Polling through `GET /api/runs/:runId` remains authoritative. On restart, queued jobs resume across all available recent repositories, with larger backlogs refilling the bounded queue as space becomes available. A job that was running is marked interrupted with an ambiguous attempt because the provider may already have accepted and billed the call; it is never retried automatically. Reactivating a repository does not interrupt live work. Queued jobs can be cancelled, immediately freeing their queue slots, while an active provider call cannot be reliably interrupted.

Switching repositories does not redirect already queued work: every in-memory queue item remains bound to the repository that created it.

## Security and data guarantees

- Host, Origin, CSP, and loopback binding safeguards are enforced by Fastify.
- Repository-relative records are validated as untrusted input.
- Traversal, absolute paths, malformed manifests, and symlink escapes are rejected by the centralized repository layer.
- Content routes resolve stable IDs through validated records; they do not accept filesystem paths.
- Browser DTOs omit absolute paths, internal input paths, and provider request bodies.
- Sidecars contain no credentials, authorization data, or base64 image bodies.
- Saved source images and style guide bytes selected by repository reference are snapshotted under the repository control directory so later moves or edits do not invalidate queued work.

## Prompt caching

Prompt caching remains unsupported by the registered image targets. Their strict request schemas contain no cache-checkpoint field, so the harness sends no undocumented cache controls.

## Verification

- `pnpm verify` runs formatting, linting, strict type checks, and production builds.

See [docs/architecture.md](docs/architecture.md) for boundaries and recovery semantics, and [docs/model-capabilities.md](docs/model-capabilities.md) for the audited model matrix.
