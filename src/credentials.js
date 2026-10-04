/**
 * Credential seam.
 *
 * The API key is never held in plugin state, never logged and never returned to
 * the browser. It lives in the harness credential store under the POSIX
 * reference name from `apiKeyEnv` and is re-resolved on **every** operation:
 * `CredentialProvider.resolve()` is async and returns `{value, source}` or
 * `undefined`, which is precisely why fixing a wrong key takes effect on the
 * next call instead of needing a restart (same seam as
 * dsh-jev-tools/lib/credentials.js).
 *
 * @module src/credentials.js
 */

/** The seam's own grammar for a credential reference. */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Is this a syntactically valid credential reference? A name outside the
 * grammar has no reference to miss and must read as "not set", never as a throw.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCredentialRefName(value) {
  return typeof value === 'string' && REF_PATTERN.test(value)
}

/**
 * Resolve the configured key for one operation.
 *
 * @param {object | undefined} credentials - the `ctx.credentials` service
 * @param {string} ref - the POSIX reference name (`apiKeyEnv`)
 * @returns {Promise<string | undefined>} the key, or `undefined` when unconfigured
 */
export async function resolveApiKey(credentials, ref) {
  if (credentials === undefined || !isCredentialRefName(ref)) return undefined
  let resolved
  try {
    resolved = await credentials.resolve(ref)
  } catch {
    return undefined
  }
  const value = resolved?.value
  // An empty stored value counts as unconfigured everywhere by the seam's rule.
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Describe the key's presence without revealing it. The browser and the agent
 * both read this; neither may ever see the value.
 *
 * @param {object | undefined} credentials
 * @param {string} ref
 * @returns {Promise<{configured: boolean, source?: string, writable: boolean}>}
 */
export async function describeApiKey(credentials, ref) {
  if (!isCredentialRefName(ref)) return { configured: false, writable: false }
  let described
  try {
    described = await credentials?.describe?.(ref)
  } catch {
    described = undefined
  }
  const resolved = await resolveApiKey(credentials, ref)
  return {
    configured: resolved !== undefined,
    ...(described?.source === undefined ? {} : { source: described.source }),
    writable: described?.writable !== false,
  }
}

/**
 * Store the key obtained from the OAuth exchange. This is the only moment the
 * full key exists outside the store: the exchange response is not logged and not
 * returned to the browser.
 *
 * @param {object | undefined} credentials
 * @param {string} ref
 * @param {string} key
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function storeApiKey(credentials, ref, key) {
  if (credentials === undefined) return { ok: false, error: 'credential store unavailable' }
  if (!isCredentialRefName(ref)) return { ok: false, error: `invalid credential reference: ${ref}` }
  if (typeof key !== 'string' || key === '') return { ok: false, error: 'empty key' }
  try {
    await credentials.set(ref, key)
  } catch (error) {
    return { ok: false, error: messageOf(error) }
  }
  return { ok: true }
}

/**
 * Remove the stored key.
 *
 * @param {object | undefined} credentials
 * @param {string} ref
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function clearApiKey(credentials, ref) {
  if (credentials === undefined) return { ok: false, error: 'credential store unavailable' }
  if (!isCredentialRefName(ref)) return { ok: false, error: `invalid credential reference: ${ref}` }
  try {
    await credentials.unset(ref)
  } catch (error) {
    return { ok: false, error: messageOf(error) }
  }
  return { ok: true }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}