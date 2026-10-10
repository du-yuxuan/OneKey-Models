/**
 * Plugin configuration.
 *
 * Schemastery schema, read exactly the way dsh-jev-tools reads it: the declared
 * fields are `volatile()` so they land in the settings namespace of this bundle's
 * mount row, and the resolved value is wrapped in marker objects — `plainConfig()`
 * unwraps them recursively. Reading `config.apiKeyEnv` directly would hand back a
 * marker, not a string.
 *
 * Everything the user can change lives in this schema and nowhere else: the
 * settings service persists it, so it survives upgrades without this plugin
 * inventing a second store.
 *
 * @module src/config.js
 */
import Schema from '@deepseek-ai/schemastery'
import { isVolatile } from '@deepseek-ai/cosmokit'

/** The public TokenDance gateway root. Never hardcode an endpoint: a self-hosted
 *  or proxied deployment must be able to move every call in one setting. */
const DEFAULT_BASE_URL = 'https://tokendance.space/gateway/v1'
const DEFAULT_AUTH_ORIGIN = 'https://tokendance.space'
const DEFAULT_MODELS_DEV = 'https://models.dev/api.json?type=all'
const DEFAULT_KEY_REF = 'TOKENDANCE_API_KEY'
const DEFAULT_ROUTE = 'tokendance'
const DEFAULT_APP_URL = 'http://tokendance-plugin.com/'
export const Config = Schema.object({
  /** Credential reference (POSIX identifier), never the key itself. */
  apiKeyEnv: Schema.string().default(DEFAULT_KEY_REF),
  /** pi-ai provider route. Created once and never renamed — it keys the
   *  settings path `providers.<route>`, so changing it orphans the models. */
  providerRoute: Schema.string().default(DEFAULT_ROUTE),
  displayName: Schema.string().default('TokenDance'),
  baseURL: Schema.string().default(DEFAULT_BASE_URL),
  /** App attribution URL, fixed in code per the TokenDance integration spec
   *  (app `DSHPlugin`, App URL `http://tokendance-plugin.com/`). The docs require
   *  OAuth `app_url` and the per-request `X-App-URL` header to carry this
   *  IDENTICAL value, and the schema deliberately does NOT expose it as
   *  editable, so neither a stale setting nor a crafted form payload can
   *  re-point attribution. */
  appUrl: Schema.string().default(DEFAULT_APP_URL),
  keyName: Schema.string().default('DSHPlugin'),
  /** Where the OAuth authorization page and the code exchange live. */
  authOrigin: Schema.string().default(DEFAULT_AUTH_ORIGIN),
  /** models.dev catalog used to enrich each model with modalities, limits and
   *  pricing. Matching is by model id across all 226 providers, because
   *  TokenDance is not itself a models.dev provider. */
  modelsDevUrl: Schema.string().default(DEFAULT_MODELS_DEV),
  /** Publish the provider profile into the router as soon as a key exists. */
  autoConfigure: Schema.boolean().default(true),
  /** Model ids to expose in the picker. Empty means "every chat-capable model". */
  visibleModels: Schema.array(Schema.string()).default([]),
  /** Model ids the user asserts accept image input. models.dev is the default
   *  source; a name like `-vl-` is not evidence, so this is an explicit opt-in. */
  imageInputModels: Schema.array(Schema.string()).default([]),
  /** Enumeration windows for the plugin's own tools. */
  toolTimeoutMs: Schema.natural().max(600_000).default(180_000),
  enableImageTool: Schema.boolean().default(true),
  enableJevTool: Schema.boolean().default(true),
  enableCatalogTool: Schema.boolean().default(true),
}).volatile()

/**
 * Recursively unwrap schemastery volatile markers into plain JSON values.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function plainConfig(value) {
  if (isVolatile(value)) return plainConfig(value.get())
  if (Array.isArray(value)) return value.map(plainConfig)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [key, child] of Object.entries(value)) out[key] = plainConfig(child)
    return out
  }
  return value
}

/**
 * Normalize the entry config into the plain object every module reads.
 *
 * @param {unknown} entry - the composition entry config, possibly `undefined`
 * @returns {{apiKeyEnv: string, providerRoute: string, displayName: string,
 *   baseURL: string, appUrl: string, keyName: string, authOrigin: string,
 *   modelsDevUrl: string, autoConfigure: boolean, visibleModels: string[],
 *   imageInputModels: string[], toolTimeoutMs: number, enableImageTool: boolean,
 *   enableJevTool: boolean, enableCatalogTool: boolean}}
 */
export function resolveSettings(entry) {
  const plain = plainConfig(entry ?? {})
  return {
    apiKeyEnv: str(plain.apiKeyEnv, DEFAULT_KEY_REF),
    providerRoute: route(plain.providerRoute, DEFAULT_ROUTE),
    displayName: str(plain.displayName, 'TokenDance'),
    baseURL: url(str(plain.baseURL, DEFAULT_BASE_URL), DEFAULT_BASE_URL),
    // Written attribution (user requirement): the value is fixed and every
    // stored override is ignored, so neither a stale setting nor a crafted form
    // payload can re-point attribution.
    appUrl: DEFAULT_APP_URL,
    keyName: str(plain.keyName, 'DSHPlugin'),
    authOrigin: url(str(plain.authOrigin, DEFAULT_AUTH_ORIGIN), DEFAULT_AUTH_ORIGIN),
    modelsDevUrl: url(str(plain.modelsDevUrl, DEFAULT_MODELS_DEV), DEFAULT_MODELS_DEV),
    autoConfigure: plain.autoConfigure !== false,
    visibleModels: strings(plain.visibleModels),
    imageInputModels: strings(plain.imageInputModels),
    toolTimeoutMs: num(plain.toolTimeoutMs, 180_000),
    enableImageTool: plain.enableImageTool !== false,
    enableJevTool: plain.enableJevTool !== false,
    enableCatalogTool: plain.enableCatalogTool !== false,
  }
}

/**
 * The visibility set for `toProviderProfile`. `undefined` means "no filter",
 * which is a different thing from an empty set — that would hide every model.
 *
 * @param {{visibleModels: string[]}} settings
 * @returns {Set<string> | undefined}
 */
export function visibleSetOf(settings) {
  return settings.visibleModels.length === 0 ? undefined : new Set(settings.visibleModels)
}

/**
 * Model id → forced input modalities, for models the user declares by hand.
 *
 * @param {{imageInputModels: string[]}} settings
 * @returns {Map<string, string[]>}
 */
export function imageInputOverrides(settings) {
  return new Map(settings.imageInputModels.map((id) => [id, ['text', 'image']]))
}

/** A provider route is a settings path segment and a credential-scope segment. */
function route(value, fallback) {
  const text = str(value, fallback)
  return /^[a-z][a-z0-9_-]*$/.test(text) ? text : fallback
}

function str(value, fallback) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

function strings(value) {
  if (!Array.isArray(value)) return []
  const trimmed = value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  return [...new Set(trimmed)]
}

function num(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

function url(value, fallback) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
    return value.replace(/\/+$/, '')
  } catch {
    return fallback
  }
}