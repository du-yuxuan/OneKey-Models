/**
 * Writing the TokenDance provider into the model router.
 *
 * The harness has no "register a model provider" API. Models appear because
 * `llm-pi-ai` reads a provider profile out of its settings namespace — which is
 * exactly how the user's own OpenRouter routes got in. So this module speaks to
 * the settings service and writes the shape the official TokenDance guide
 * documents: `{ apiKeyEnv, api, baseURL, models }` under `providers.<route>`.
 *
 * Two shapes of `describe()` exist in this codebase and confusing them breaks
 * the plugin silently: the **Host** service (`ctx.settings`) returns a flat
 * array of descriptors, while the **remote** controller
 * (`ctx.remote.settings.describe()`) returns `{ writable, hasDocument,
 * namespaces }`. This module is Host-side and reads the array.
 *
 * The namespace id is discovered rather than assumed: the row that mounts
 * `dsh-llm-pi-ai` is not necessarily called `llm-pi-ai`, and the plugin has no
 * business hardcoding a composition detail it can verify at runtime.
 *
 * @module src/pi-ai.js
 */

/** Settings path of one provider profile inside the pi-ai namespace. */
export function providerPath(route) {
  return ['providers', route]
}

/**
 * Find the settings namespace that owns the model router.
 *
 * @param {{describe: () => Array<object>}} settings - the Host settings service
 * @param {string} route - the provider route we intend to write
 * @returns {{ns: string, revision: number} | {error: string}}
 */
export function findRouterNamespace(settings, route) {
  if (settings === undefined) return { error: 'settings service unavailable' }
  let descriptors
  try {
    descriptors = settings.describe()
  } catch (error) {
    return { error: messageOf(error) ?? 'settings.describe() failed' }
  }
  const namespaces = Array.isArray(descriptors) ? descriptors : []
  const withProviders = namespaces.filter((entry) => providersOf(entry) !== undefined)
  // An existing profile for our route is the strongest signal: that namespace
  // is provably ours, even if several namespaces expose a `providers` map.
  const owning = withProviders.find((entry) => providersOf(entry)[route] !== undefined)
  const target = owning ?? withProviders[0]
  if (target === undefined) return { error: 'no settings namespace exposes a `providers` map' }
  return { ns: String(target.ns), revision: Number(target.revision) }
}

/**
 * The namespace schema must accept a provider profile before we can write one.
 * `assertServiceable` rejects unserviceable profiles at the write site, so a
 * namespace without `providers` in its schema is not ours to fill.
 *
 * @param {unknown} entry - one descriptor from `settings.describe()`
 * @returns {Record<string, unknown> | undefined}
 */
function providersOf(entry) {
  const value = entry?.value
  if (value === null || typeof value !== 'object') return undefined
  const providers = value.providers
  if (providers === null || typeof providers !== 'object') return undefined
  return /** @type {Record<string, unknown>} */ (providers)
}

/**
 * Find the settings namespace this bundle's own mount row owns.
 *
 * The row id comes from `cordis.patch.yml` and is not user-configurable, so it is
 * looked up rather than assumed: a composition that mounted this bundle under a
 * different id must get writes aimed at its own namespace, not at a guess.
 *
 * @param {{describe: () => Array<object>}} settings - the Host settings service
 * @param {string} ns - the mount row id, i.e. this plugin's `name`
 * @returns {{ns: string, revision: number} | {error: string}}
 */
export function findOwnNamespace(settings, ns) {
  if (settings === undefined) return { error: 'settings service unavailable' }
  let descriptors
  try {
    descriptors = settings.describe()
  } catch (error) {
    return { error: messageOf(error) ?? 'settings.describe() failed' }
  }
  for (const entry of Array.isArray(descriptors) ? descriptors : []) {
    if (String(entry?.ns) !== ns) continue
    return { ns, revision: Number(entry.revision) }
  }
  return { error: `no configurable settings namespace for "${ns}"` }
}

/**
 * Publish (or clear) the TokenDance provider profile.
 *
 * `expectedRevision` is passed through so a concurrent editor loses the race
 * loudly rather than silently overwriting; callers that have just described the
 * namespace should always supply it.
 *
 * @param {{mutate: (ns: string, ops: Array<object>, expectedRevision?: number) => Promise<unknown>}} settings
 * @param {object} options
 * @param {string} options.ns - namespace returned by {@link findRouterNamespace}
 * @param {number} [options.expectedRevision]
 * @param {object | undefined} options.provider - the profile, or `undefined` to unset
 * @param {string} options.route
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function writeProvider(settings, options) {
  if (settings === undefined) return { ok: false, error: 'settings service unavailable' }
  const ops = [options.provider === undefined
    ? { op: 'unset', path: providerPath(options.route) }
    : { op: 'set', path: providerPath(options.route), value: options.provider }]
  try {
    await settings.mutate(options.ns, ops, options.expectedRevision)
    return { ok: true }
  } catch (error) {
    // A rejected write is the harness telling us the profile is not serviceable
    // (unknown `api` value, malformed model list, not a volatile path). Surface
    // that reason verbatim instead of retrying with a guess.
    return { ok: false, error: messageOf(error) ?? 'settings write failed' }
  }
}

/**
 * Read back what the router currently holds for our route.
 *
 * @param {{describe: () => Array<object>}} settings
 * @param {string} route
 * @returns {{present: boolean, modelIds: string[], api?: string, baseURL?: string, apiKeyEnv?: string}}
 */
export function readProvider(settings, route) {
  if (settings === undefined) return { present: false, modelIds: [] }
  let descriptors
  try {
    descriptors = settings.describe()
  } catch {
    return { present: false, modelIds: [] }
  }
  for (const entry of Array.isArray(descriptors) ? descriptors : []) {
    const provider = providersOf(entry)?.[route]
    if (provider === null || typeof provider !== 'object') continue
    const profile = /** @type {Record<string, unknown>} */ (provider)
    const models = Array.isArray(profile.models) ? profile.models : []
    return {
      present: true,
      modelIds: models.map((model) => String(model?.id ?? '')).filter((id) => id !== ''),
      ...(typeof profile.api === 'string' ? { api: profile.api } : {}),
      ...(typeof profile.baseURL === 'string' ? { baseURL: profile.baseURL } : {}),
      ...(typeof profile.apiKeyEnv === 'string' ? { apiKeyEnv: profile.apiKeyEnv } : {}),
    }
  }
  return { present: false, modelIds: [] }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}