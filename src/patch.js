/**
 * Turning a settings-page form into `settings.mutate` operations.
 *
 * The browser half of this plugin cannot call the settings service directly: the
 * remote facade only accepts generated strict-codec endpoints, and a third-party
 * plugin cannot hand-write one. So the form posts here and this module is the
 * gate: it decides which keys a request is allowed to touch, coerces each value
 * to the type the schema declares, and drops everything else.
 *
 * That gate is the whole point. `providerRoute` and `baseURL` are read by the
 * Host on every call — a browser that could rewrite them unchecked could point
 * every subsequent inference call at a host of its choosing. Anything not on the
 * allow-list is not merely ignored, it never reaches the settings service.
 *
 * @module src/patch.js
 */

/**
 * Every editable field, with the coercion each one needs. Adding a field to the
 * Config schema without adding it here is not a bug: the field simply stays
 * non-editable from the settings page, which is the safe default.
 *
 * @type {Record<string, {coerce: (value: unknown) => unknown, hint?: string}>}
 */
const FIELDS = {
  providerRoute: { coerce: route, hint: 'lower-case identifier' },
  displayName: { coerce: text },
  baseURL: { coerce: httpUrl },
  keyName: { coerce: text },
  // appUrl is deliberately absent: attribution is fixed in code (http://tokendance-plugin.com/)
  authOrigin: { coerce: httpUrl },
  modelsDevUrl: { coerce: httpUrl },
  autoConfigure: { coerce: bool },
  visibleModels: { coerce: idList },
  imageInputModels: { coerce: idList },
  toolTimeoutMs: { coerce: timeout },
  enableImageTool: { coerce: bool },
  enableJevTool: { coerce: bool },
  enableCatalogTool: { coerce: bool },
}

/** The field names a settings-page form may write. */
export function editableFields() {
  return Object.keys(FIELDS)
}

/**
 * Coerce a form payload into settings operations.
 *
 * Unknown keys are dropped, a wrong-typed key is dropped, and only the surviving
 * ones come back as `{op:'set'}` operations. Returning no operations is a normal
 * outcome — it means the form carried nothing this plugin is willing to write.
 *
 * @param {unknown} payload - the parsed request body
 * @param {object} current - the currently resolved settings, used as the fallback
 * @returns {{ops: Array<{op: 'set', path: string[], value: unknown}>, rejected: string[]}}
 */
export function patchFrom(payload, current) {
  const source = payload !== null && typeof payload === 'object' ? payload : {}
  const ops = []
  const rejected = []
  for (const [key, value] of Object.entries(source)) {
    const field = FIELDS[key]
    if (field === undefined) {
      rejected.push(key)
      continue
    }
    const coerced = field.coerce(value, current)
    if (coerced === undefined) {
      rejected.push(key)
      continue
    }
    ops.push({ op: 'set', path: [key], value: coerced })
  }
  return { ops, rejected }
}

/**
 * Coerce a raw settings value against the same rules.
 *
 * Used for the `ns`-scoped write path, where the settings service has already
 * narrowed the namespace but not the individual field types.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {unknown}
 */
export function coerceField(key, value) {
  const field = FIELDS[key]
  return field === undefined ? undefined : field.coerce(value)
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function route(value) {
  const text_ = text(value)
  return text_ !== undefined && /^[a-z][a-z0-9_-]*$/.test(text_) ? text_ : undefined
}

function httpUrl(value) {
  const text_ = text(value)
  if (text_ === undefined) return undefined
  try {
    const parsed = new URL(text_)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? text_.replace(/\/+$/, '')
      : undefined
  } catch {
    return undefined
  }
}

function bool(value) {
  return typeof value === 'boolean' ? value : undefined
}

function idList(value) {
  if (!Array.isArray(value)) return undefined
  const ids = value.filter((entry) => typeof entry === 'string' && entry.trim() !== '')
  return [...new Set(ids.map((entry) => entry.trim()))]
}

function timeout(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), 600_000) : undefined
}