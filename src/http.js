/**
 * TokenDance HTTP client.
 *
 * One place that knows the wire: every endpoint is derived from the configured
 * `baseURL` so a proxy or a self-hosted gateway moves all of them at once, and
 * every response is normalized into one `{ok, status, data}` shape so callers
 * never branch on transport details.
 *
 * Two rules encoded here rather than left to callers:
 *   - the key is passed per call and never retained on the instance;
 *   - a non-2xx answer carries TokenDance's `TokenDance-Recovery-Action` header
 *     through to the caller, because "top up" and "re-authorize" are different
 *     user actions and swallowing that header makes both look like "an error".
 *
 * @module src/http.js
 */

/** TokenDance advertises the remedy for a rejected key in this header. */
export const RECOVERY_HEADER = 'tokendance-recovery-action'

/**
 * @typedef {object} ApiResult
 * @property {boolean} ok
 * @property {number} status
 * @property {unknown} [data] parsed JSON body on success
 * @property {string} [error] human-readable reason on failure
 * @property {string} [recovery] `top_up_balance` | `reauthorize_api_key` | `api_key_quota`
 */

/**
 * Split `https://host/gateway/v1` into the gateway root and the v1 root.
 *
 * The Anthropic-native and the Ark/TypeSafe endpoints live off the gateway root
 * with their own prefixes, so both are needed.
 *
 * @param {string} baseURL
 * @returns {{gateway: string, v1: string}}
 */
export function endpoints(baseURL) {
  const v1 = baseURL.replace(/\/+$/, '')
  const gateway = v1.replace(/\/v1$/, '')
  return { gateway, v1 }
}

/**
 * Perform one TokenDance request.
 *
 * @param {string} url - absolute endpoint URL
 * @param {object} options
 * @param {string} [options.key] - bearer key; omit for the anonymous catalog
 * @param {string} [options.method]
 * @param {unknown} [options.body] - JSON-serialized unless `raw` is set
 * @param {Record<string, string>} [options.headers]
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<ApiResult>}
 */
export async function request(url, options = {}) {
  const { key, method = 'GET', body, headers = {}, timeoutMs = 180_000, signal, appUrl } = options
  const requestHeaders = { accept: 'application/json', ...headers }
  if (body !== undefined) requestHeaders['content-type'] = 'application/json'
  if (key !== undefined && key !== '') requestHeaders.authorization = `Bearer ${key}`
  // Request-dimension attribution (docs/app-attribution.md): every model call
  // carries X-App-URL so attribution never depends on what the key inherits.
  if (appUrl !== undefined && appUrl !== '') requestHeaders['x-app-url'] = appUrl
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    const recovery = response.headers.get(RECOVERY_HEADER) ?? undefined
    let data
    try {
      data = text === '' ? undefined : JSON.parse(text)
    } catch {
      data = undefined
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: messageOf(data) ?? `HTTP ${response.status}`,
        ...(recovery === undefined ? {} : { recovery }),
      }
    }
    return { ok: true, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 0, error: error?.message ?? 'network failure' }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Fetch the live model catalog. Anonymous by design: TokenDance serves
 * `/gateway/v1/models` without a key, which is what lets the plugin enumerate
 * models before the user has authorized anything.
 *
 * @param {string} baseURL
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, models?: unknown[], error?: string}>}
 */
export async function fetchModels(baseURL, options = {}) {
  const { v1 } = endpoints(baseURL)
  const result = await request(`${v1}/models`, { ...options, method: 'GET' })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  const data = result.data
  const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
  return { ok: true, status: result.status, models: list }
}

/**
 * Exchange a one-shot OAuth code for the API key.
 *
 * The full key appears in exactly one response and can never be recovered
 * afterwards, which is why the caller stores it immediately and this function
 * never logs or caches it.
 *
 * @param {string} authOrigin
 * @param {{code: string, codeVerifier: string}} params
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, key?: string, error?: string}>}
 */
export async function exchangeCode(authOrigin, params, options = {}) {
  const result = await request(`${authOrigin.replace(/\/+$/, '')}/portal/api/v1/auth/keys`, {
    ...options,
    method: 'POST',
    body: {
      code: params.code,
      code_verifier: params.codeVerifier,
      code_challenge_method: 'S256',
    },
  })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  const key = typeof result.data?.key === 'string' ? result.data.key : undefined
  if (key === undefined || key === '') {
    return { ok: false, status: result.status, error: 'authorization response carried no key' }
  }
  return { ok: true, status: result.status, key }
}

/**
 * One chat completion, non-streaming.
 *
 * @param {string} baseURL
 * @param {object} options
 * @param {string} options.key
 * @param {unknown[]} options.messages
 * @param {string} options.model
 * @param {number} [options.maxTokens]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<ApiResult & {text?: string}>}
 */
export async function chatCompletion(baseURL, options) {
  const { v1 } = endpoints(baseURL)
  const result = await request(`${v1}/chat/completions`, {
    method: 'POST',
    key: options.key,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    headers: options.appUrl === undefined ? {} : { 'x-app-url': options.appUrl },
    body: {
      model: options.model,
      messages: options.messages,
      ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
    },
  })
  if (!result.ok) return result
  const choice = result.data?.choices?.[0]
  const text = choice?.message?.content
  if (typeof text !== 'string') return { ...result, text: undefined }
  return { ...result, text }
}

function messageOf(data) {
  if (typeof data?.error?.message === 'string') return data.error.message
  if (typeof data?.message === 'string') return data.message
  return undefined
}