# Image capability coverage

Registry version: `2026-08-29.1`

The capability registry and Baroque controls cover every request parameter documented for the targets below. Unsupported fields are intentionally rejected per target rather than being forwarded to a provider.

## Amazon Bedrock generation models

<!-- prettier-ignore -->
| Target | Modes | Parameters | Output | Seed range |
| --- | --- | --- | --- | --- |
| Stable Image Core | Text to image | `prompt`, `negative_prompt`, `aspect_ratio`, `seed`, `output_format` | JPEG, PNG | 0–4,294,967,295 |
| Stable Image Ultra | Text to image, image to image | `mode`, `prompt`, `image`, `strength`, `negative_prompt`, `aspect_ratio`, `seed`, `output_format` | JPEG, PNG | 0–4,294,967,295 |
| Stable Diffusion 3.5 Large | Text to image, image to image | `mode`, `prompt`, `image`, `strength`, `negative_prompt`, `aspect_ratio`, `seed`, `output_format` | JPEG, PNG, WebP | 0–4,294,967,294 |

All nine documented aspect ratios are available: 16:9, 1:1, 21:9, 2:3, 3:2, 4:5, 5:4, 9:16, and 9:21. Adding a source image selects image-to-image mode for Ultra and SD3.5 Large.

All three generation models are available only through the `us-west-2` Bedrock Runtime endpoint. The server pins its Bedrock client to that region so ambient AWS profile or environment region settings cannot produce an invalid-model error.

## Azure AI Foundry targets

<!-- prettier-ignore -->
| Target | Modes | Parameters | Output | Seed range |
| --- | --- | --- | --- | --- |
| GPT Image 2 | Text to image | `prompt`, `size`, `quality`, `background`, `output_format`, `n` | JPEG, PNG | Not supported |
| GPT Image 2 Edit | Image and optional mask | `prompt`, `image`, `mask`, `size`, `quality`, `background`, `input_fidelity`, `output_format`, `n` | JPEG, PNG | Not supported |

GPT Image takes explicit pixel dimensions rather than a named ratio, so the shared aspect-ratio picker maps each of the nine ratios to a size that keeps both edges on a multiple of 16 and stays inside the documented pixel-count and 3:1 limits. Quality is `low`, `medium`, or `high`. A transparent background requires PNG output and is rejected with any other format. Editing takes PNG or JPEG source bytes and a PNG mask; WebP is not accepted by either target.

Neither target accepts a seed, so the harness uses provider-random planning without injecting a seed field. Requesting several images sends one call with `n` set to the run's output count, which charges the prompt and any source image once instead of once per image. Both targets are reached through the `images/generations` and `images/edits` endpoints of a single deployment on the configured Azure OpenAI resource.

## Image Services on Amazon Bedrock

<!-- prettier-ignore -->
| Target | Required inputs | Optional controls |
| --- | --- | --- |
| Control Sketch | Prompt, image | Control strength, negative prompt, seed, output format, style preset |
| Control Structure | Prompt, image | Control strength, negative prompt, seed, output format, style preset |
| Style Match | Prompt, image | Aspect ratio, fidelity, negative prompt, seed, output format, style preset |
| Style Transfer | Content image, style image | Prompt, negative prompt, seed, output format, composition fidelity, style strength, change strength |
| Creative Upscale | Prompt, image | Creativity, negative prompt, seed, output format, style preset |
| Conservative Upscale | Prompt, image | Creativity, negative prompt, seed, output format |
| Fast Upscale | Image | Output format |
| Inpaint | Prompt, image | Mask or alpha channel, mask growth, negative prompt, seed, output format, style preset |
| Outpaint | Image and at least one direction | Prompt, style preset, seed, output format, creativity, left, right, up, down |
| Search and Recolor | Prompt, image, selection prompt | Mask growth, negative prompt, seed, output format, style preset |
| Search and Replace | Prompt, image, search prompt | Mask growth, negative prompt, seed, output format, style preset |
| Erase | Image | Mask or alpha channel, mask growth, seed, output format |
| Remove Background | Image | Output format |

Image Services use JPEG, PNG, or WebP output. Seed-capable services accept 0–4,294,967,294. Fast Upscale and Remove Background do not accept seeds, so the harness uses provider-random planning without injecting a seed field.

Image Services use US Geo inference profiles. The pinned `us-west-2` endpoint is a supported source region for every registered profile.

The complete style preset set is available where supported: 3D model, analog film, anime, cinematic, comic book, digital art, enhance, fantasy art, isometric, line art, low poly, modeling compound, neon punk, origami, photographic, pixel art, and tile texture.

## Provider constraints

- Prompts and negative prompts are limited to 10,000 characters.
- Generation and service images accept JPEG, PNG, and WebP source bytes, except GPT Image editing, which accepts PNG or JPEG. Individual services impose documented pixel-count, minimum-side, and aspect-ratio constraints; the provider remains authoritative for these image-content constraints.
- Mask-capable tools accept a separate black-and-white mask, where white marks the area to change. When omitted, Inpaint and Erase derive the mask from the source image alpha channel. GPT Image masks invert that convention: they are PNG files whose fully transparent pixels mark the area to change. The studio's mask editor draws once and exports whichever encoding the selected target expects.
- Outpaint directions are integers from 0 through 2,000, with at least one non-zero direction.
- Mask growth is an integer from 0 through 20.
- Stability targets perform one invocation per requested output so each output has an independently planned seed and durable job record. GPT Image targets accept `n` and return a whole run from a single billed call, so one job holds every output of that run.

## Sources

- [Stable Image Core request and response](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-diffusion-stable-image-core-text-image-request-response.html)
- [Stable Image Ultra request and response](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-diffusion-stable-ultra-text-image-request-response.html)
- [Stable Diffusion 3.5 Large](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-diffusion-3-5-large.html)
- [Stability AI Image Services](https://docs.aws.amazon.com/bedrock/latest/userguide/stable-image-services.html)
- [Azure OpenAI image generation](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/dall-e)
