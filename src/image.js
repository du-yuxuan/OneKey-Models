/**
 * Image generation.
 *
 * Two TokenDance protocols reach a picture, and they are not the same request:
 * `openai:image-generations` is the OpenAI-compatible `/v1/images/generations`
 * taking pixel sizes, while `ark:image-generations` is Volcano Ark's
 * `/ark/v3/images/generations` taking `size: "2K"`, an output format and — the
 * part that matters — optional reference images. A user who picks a Seedream
 * model needs the Ark route; sending it to the OpenAI route silently loses the
 * reference images.
 *
 * The protocol decides the endpoint. Nothing here guesses from the model name.
 *
 * @module src/image.js
 */
import { endpoints, request } from './http.js'

/**
 * Which image protocol a catalog model speaks.
 *
 * @param {{id: string, protocols?: string[]}} model
 * @returns {'openai' | 'ark' | undefined}
 */
export function imageProtocolOf(model) {
  const protocols = Array.isArray(model?.protocols) ? model.protocols : []
  // Ark first: it is the superset, and a model advertising both can do more.
  if (protocols.includes('ark:image-generations')) return 'ark'
  if (protocols.includes('openai:image-generations')) return 'openai'
  return undefined
}

/** Every catalog model that can produce an image, with its route spelled out. */
export function imageModels(catalog) {
  return (Array.isArray(catalog) ? catalog : [])
    .map((model) => ({ model, protocol: imageProtocolOf(model) }))
    .filter((entry) => entry.protocol !== undefined)
    .map((entry) => ({ id: entry.model.id, name: entry.model.name, protocol: entry.protocol }))
}

/** Translate a friendly size into the Ark vocabulary. */
function arkSize(value) {
  if (typeof value === 'string' && /^\d+[KM]$/i.test(value)) return value.toUpperCase()
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(String(value ?? ''))
  if (match === undefined) return '2K'
  const longest = Math.max(Number(match[1]), Number(match[2]))
  return longest >= 1536 ? '4K' : '2K'
}

/**
 * Generate one image.
 *
 * @param {object} options
 * @param {string} options.baseURL
 * @param {string} options.key
 * @param {string} options.model
 * @param {string} options.prompt
 * @param {'openai' | 'ark'} [options.protocol] - inferred from the model when omitted
 * @param {number} [options.n]
 * @param {string} [options.size] - `1024x1024` (OpenAI) or `2K`/`4K` (Ark)
 * @param {string[]} [options.referenceImages] - public image URLs, Ark only
 * @param {string} [options.appUrl]
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ok: boolean, status: number, images?: Array<{url?: string, b64?: string}>, error?: string}>}
 */
export async function generateImage(options) {
  const protocol = options.protocol ?? 'openai'
  const { gateway, v1 } = endpoints(options.baseURL)
  const headers = options.appUrl === undefined ? {} : { 'x-app-url': options.appUrl }

  if (protocol === 'ark') {
    const image = options.referenceImages?.length === 1
      ? options.referenceImages[0]
      : options.referenceImages
    const result = await request(`${gateway}/ark/v3/images/generations`, {
      method: 'POST',
      key: options.key,
      headers,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      body: {
        model: options.model,
        prompt: options.prompt,
        size: arkSize(options.size),
        output_format: 'png',
        response_format: 'url',
        watermark: false,
        ...(image === undefined ? {} : { image }),
      },
    })
    return result.ok ? { ...result, images: collectArk(result.data) } : result
  }

  const result = await request(`${v1}/images/generations`, {
    method: 'POST',
    key: options.key,
    headers,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    body: {
      model: options.model,
      prompt: options.prompt,
      n: options.n ?? 1,
      size: options.size ?? '1024x1024',
    },
  })
  return result.ok ? { ...result, images: collectOpenai(result.data) } : result
}

function collectOpenai(data) {
  const list = Array.isArray(data?.data) ? data.data : []
  return list
    .map((item) => ({
      ...(typeof item?.url === 'string' ? { url: item.url } : {}),
      ...(typeof item?.b64_json === 'string' ? { b64: item.b64_json } : {}),
    }))
    .filter((image) => image.url !== undefined || image.b64 !== undefined)
}

function collectArk(data) {
  const list = Array.isArray(data?.data) ? data.data : []
  return list
    .map((item) => ({
      ...(typeof item?.url === 'string' ? { url: item.url } : {}),
      ...(typeof item?.b64_json === 'string' ? { b64: item.b64_json } : {}),
    }))
    .filter((image) => image.url !== undefined || image.b64 !== undefined)
}