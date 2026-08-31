import {
  gptImageErrorSchema,
  gptImageResponseSchema,
  type Capability,
} from '@harness/capabilities';
import type { MediaType } from '@harness/contracts';
import { characterizeImageData } from '@harness/image';
import type { ImageProvider, ProviderInvocation } from '../image-provider.js';

const DEFAULT_API_VERSION = '2025-04-01-preview';
const EDIT_IMAGE_MEDIA_TYPES: readonly MediaType[] = ['image/png', 'image/jpeg'];
const EDIT_MASK_MEDIA_TYPES: readonly MediaType[] = ['image/png'];

interface FoundryCredentials {
  /** Always carries a trailing slash so deployment paths append cleanly. */
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deploymentOverride: string | undefined;
}

function environmentValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === '' ? undefined : value;
}

/**
 * The Foundry portal shows endpoints that already carry an API path, such as
 * `https://<resource>.openai.azure.com/openai/v1`, while the harness appends its own
 * deployment path. Trimming that suffix keeps a pasted portal value working.
 */
function normalizeEndpoint(value: string): string | undefined {
  let url;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const path = url.pathname.replace(/\/openai(?:\/v\d+)?\/?$/u, '/');
  return `${url.origin}${path.endsWith('/') ? path : `${path}/`}`;
}

function readCredentials(): FoundryCredentials | undefined {
  const rawEndpoint = environmentValue('AZURE_OPENAI_ENDPOINT');
  const apiKey = environmentValue('AZURE_OPENAI_API_KEY');
  const endpoint = rawEndpoint ? normalizeEndpoint(rawEndpoint) : undefined;
  if (!endpoint || !apiKey) return undefined;
  return {
    endpoint,
    apiKey,
    apiVersion: environmentValue('AZURE_OPENAI_API_VERSION') ?? DEFAULT_API_VERSION,
    deploymentOverride: environmentValue('AZURE_OPENAI_IMAGE_DEPLOYMENT'),
  };
}

async function imageFile(
  encoded: string,
  name: 'image' | 'mask',
  accepted: readonly MediaType[],
): Promise<File> {
  const data = await characterizeImageData(encoded, { label: `The ${name}` });
  if (!accepted.includes(data.mediaType)) {
    throw new Error(`GPT Image accepts only ${accepted.join(' or ')} for the ${name}`);
  }
  return new File([data.bytes], `${name}.${data.extension}`, { type: data.mediaType });
}

/** The edits endpoint takes multipart form data, so staged base64 inputs become files here. */
async function editFormData(request: Record<string, unknown>): Promise<FormData> {
  const form = new FormData();
  for (const [field, value] of Object.entries(request)) {
    if (field === 'image' || field === 'mask') continue;
    form.set(field, String(value));
  }
  const image = request['image'];
  if (typeof image !== 'string') throw new Error('GPT Image editing requires a source image');
  form.append('image[]', await imageFile(image, 'image', EDIT_IMAGE_MEDIA_TYPES));
  const mask = request['mask'];
  if (typeof mask === 'string') {
    form.set('mask', await imageFile(mask, 'mask', EDIT_MASK_MEDIA_TYPES));
  }
  return form;
}

/** The URL is safe to surface: the key travels in a header, never the path or query. */
async function describeFailure(response: Response, url: URL): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  const parsed = gptImageErrorSchema.safeParse(payload);
  const detail = parsed.success
    ? [parsed.data.error.code, parsed.data.error.message].filter(Boolean).join(': ')
    : response.statusText;
  const hint =
    response.status === 404 ? ' Check that the deployment name and endpoint are correct.' : '';
  return `Azure AI Foundry rejected the request (${String(response.status)}): ${detail}.${hint} Called ${url.pathname}`;
}

export class AzureFoundryAdapter implements ImageProvider {
  readonly #credentials: FoundryCredentials | undefined;

  constructor(credentials = readCredentials()) {
    this.#credentials = credentials;
  }

  get configured(): boolean {
    return this.#credentials !== undefined;
  }

  async invoke(
    capability: Capability,
    request: Record<string, unknown>,
  ): Promise<ProviderInvocation> {
    const credentials = this.#credentials;
    if (!credentials) {
      throw new Error(
        'Azure AI Foundry is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY for the server process.',
      );
    }
    const invocation = capability.invocation;
    if (invocation.kind !== 'azure-openai-deployment') {
      throw new Error(`${capability.name} is not an Azure AI Foundry target`);
    }
    const deployment = credentials.deploymentOverride ?? invocation.deploymentName;
    const url = new URL(
      `openai/deployments/${encodeURIComponent(deployment)}/images/${invocation.operation}`,
      credentials.endpoint,
    );
    url.searchParams.set('api-version', credentials.apiVersion);

    // `n` travels in the validated request, so one call returns the whole run.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': credentials.apiKey,
        ...(invocation.operation === 'edits' ? {} : { 'content-type': 'application/json' }),
      },
      body:
        invocation.operation === 'edits' ? await editFormData(request) : JSON.stringify(request),
    });
    if (!response.ok) throw new Error(await describeFailure(response, url));
    const decoded = gptImageResponseSchema.parse(await response.json());
    const requestId = response.headers.get('apim-request-id');
    return {
      invocationId: deployment,
      images: decoded.data.map((item) => ({
        base64: item.b64_json,
        seed: null,
        finishReason: null,
      })),
      ...(requestId ? { requestId } : {}),
      metadata: {
        httpStatusCode: response.status,
        apiVersion: credentials.apiVersion,
      },
    };
  }
}
