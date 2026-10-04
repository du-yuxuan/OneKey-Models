/**
 * OneKey-Models — Host half.
 *
 * Three jobs, in this order:
 *
 * 1. **Authorise.** Open TokenDance's OAuth page, receive the one-shot code,
 *    exchange it and store the key in the harness credential store. The key
 *    never enters plugin state, a log line or a browser response.
 * 2. **Register models.** Fetch the live catalog, enrich it from models.dev,
 *    and write `{apiKeyEnv, api, baseURL, models}` into the settings namespace
 *    that owns the model router. This is how models appear in the picker — the
 *    harness has no other door.
 * 3. **Expose the rest.** A same-origin `/api/onekey-models` route for the
 *    settings page, and four agent tools for the models whose protocol is not
 *    one the router speaks.
 *
 * `inject` is deliberately empty. Cordis hides any service not named in
 * `inject`, and a fiber waiting on a missing service never activates — which is
 * exactly the bug that pinned dsh-our-free-model v1.2.1 on compositions without
 * an HTTP server. Everything is reached through nested `ctx.inject`, so a
 * missing service degrades this plugin instead of disabling it.
 *
 * @module index
 */
import { Config, imageInputOverrides, resolveSettings, visibleSetOf } from './src/config.js'
import { clearApiKey, describeApiKey, resolveApiKey, storeApiKey } from './src/credentials.js'
import { buildEnrichment, mergeCatalog, toProviderProfile } from './src/catalog.js'
import { exchangeCode, fetchModels } from './src/http.js'
import { generateImage, imageModels, imageProtocolOf } from './src/image.js'
import { jevModels } from './src/jev.js'
import { authorizationUrl, createPkce, openCallback } from './src/oauth.js'
import { findOwnNamespace, findRouterNamespace, readProvider, writeProvider } from './src/pi-ai.js'
import { patchFrom } from './src/patch.js'
import { createTools } from './src/tools.js'
import { rejectionFor } from './src/trust.js'

export { Config }

/** The row id in cordis.patch.yml. The settings namespace mirrors it. */
export const name = 'onekey-models'

/**
 * Catalog staleness window. The live directory changes as TokenDance ships
 * models; re-fetching on every render would be rude, and serving a week-old
 * list to someone who just clicked "refresh" would be worse.
 */
const CATALOG_TTL_MS = 5 * 60_000

/** models.dev is a 5 MB download; one fetch per TTL window, not per request. */
const ENRICHMENT_TTL_MS = 24 * 60 * 60_000

/**
 * @param {object} ctx - the plugin context
 * @param {object} entry - the composition entry (its `config` carries the row's
 *   values; `ctx.fiber.config` is the live, volatile-updated view of the same)
 * @returns {void}
 */
export function apply(ctx, entry) {
  // Volatile updates are committed into `fiber.config` in place, so re-reading
  // it per call is how "the settings page changed" reaches the tools without a
  // restart or a subscription.
  const settings = () => resolveSettings(ctx.fiber?.config ?? entry)

  const state = {
    /** Cached merged catalog. */
    catalog: [],
    catalogAt: 0,
    enrichment: new Map(),
    enrichmentAt: 0,
    inflight: undefined,
    /** Pending OAuth attempt: verifier plus how it was started. */
    pending: undefined,
  }

  ctx.effect(() => {
    ctx.logger?.info(
      `[${name}] mounted (provider route "${settings().providerRoute}", key ref "${settings().apiKeyEnv}").`,
    )
  })

  // ── catalog ─────────────────────────────────────────────────────────────────

  const readEnrichment = async (current, signal) => {
    if (Date.now() - state.enrichmentAt < ENRICHMENT_TTL_MS) return state.enrichment
    const { modelsDevUrl } = current
    try {
      const response = await fetch(modelsDevUrl, { signal, headers: { accept: 'application/json' } })
      if (!response.ok) return state.enrichment
      const built = buildEnrichment(await response.json())
      state.enrichment = built
      state.enrichmentAt = Date.now()
    } catch (error) {
      // Enrichment is decoration: modalities, limits, pricing. Losing it must
      // never block the directory itself, so this is logged and swallowed.
      ctx.logger?.warn(`[${name}] models.dev enrichment unavailable: ${messageOf(error)}`)
    }
    return state.enrichment
  }

  const readCatalog = async (current, { force = false, signal } = {}) => {
    if (!force && Date.now() - state.catalogAt < CATALOG_TTL_MS) {
      return { ok: true, models: state.catalog }
    }
    if (state.inflight !== undefined) return state.inflight
    state.inflight = (async () => {
      const [listing, enrichment] = await Promise.all([
        fetchModels(current.baseURL, { signal, timeoutMs: current.toolTimeoutMs }),
        readEnrichment(current, signal),
      ])
      if (!listing.ok) return listing
      state.catalog = mergeCatalog(listing.models, enrichment)
      state.catalogAt = Date.now()
      return { ok: true, models: state.catalog }
    })()
    try {
      return await state.inflight
    } finally {
      state.inflight = undefined
    }
  }

  // ── applying the profile ────────────────────────────────────────────────────

  /**
   * Turn the catalog into a router profile and write it.
   *
   * @param {object} deps
   * @param {object | undefined} deps.settingsService
   * @param {object | undefined} deps.credentialsService
   * @param {object[]} deps.models
   * @param {string | undefined} deps.key
   * @returns {Promise<object>}
   */
  const applyProfile = async ({ settingsService, credentialsService, models, key }) => {
    const current = settings()
    const built = toProviderProfile(models, {
      api: models.find((model) => typeof model.piAiProtocol === 'string')?.piAiProtocol ?? 'openai-completions',
      apiKeyEnv: current.apiKeyEnv,
      baseURL: current.baseURL,
      displayName: current.displayName,
      visible: visibleSetOf(current),
      modalities: imageInputOverrides(current),
    })
    if (built.provider.models.length === 0) {
      return { ok: false, problem: 'no-models', message: 'No chat-capable model matched the current selection.' }
    }
    if (settingsService === undefined) return { ok: false, problem: 'no-service', message: 'settings service unavailable' }
    const target = findRouterNamespace(settingsService, current.providerRoute)
    if ('error' in target) return { ok: false, problem: 'no-service', message: target.error }
    const written = await writeProvider(settingsService, {
      ns: target.ns,
      expectedRevision: target.revision,
      provider: built.provider,
      route: current.providerRoute,
    })
    if (!written.ok) return { ok: false, problem: 'rejected', message: written.error }
    return {
      ok: true,
      ns: target.ns,
      modelCount: built.provider.models.length,
      hidden: built.hidden.length,
      keyConfigured: key !== undefined,
    }
  }

  const applyNow = async (deps) => {
    const current = settings()
    if (!current.autoConfigure) {
      return { ok: false, problem: 'auto-off', message: 'Auto-apply is off; enable it or press Apply now.' }
    }
    const catalog = await readCatalog(current, { force: true })
    if (!catalog.ok) return { ok: false, problem: 'network', message: catalog.error }
    return applyProfile({ ...deps, models: catalog.models })
  }

  // ── OAuth ───────────────────────────────────────────────────────────────────

  const beginAuth = async () => {
    const current = settings()
    const pkce = createPkce()
    const callback = await openCallback()
    state.pending = { pkce, callback }
    return {
      ok: true,
      url: authorizationUrl({
        authOrigin: current.authOrigin,
        challenge: pkce.challenge,
        appUrl: current.appUrl,
        keyName: current.keyName,
        callbackUrl: callback.callbackUrl,
      }),
      callbackUrl: callback.callbackUrl,
      keyName: current.keyName,
    }
  }

  /**
   * Exchange the authorization code for the key and store it.
   *
   * `code` is optional: the loopback listener started by {@link beginAuth} is
   * where the browser lands after sign-in, so the code usually arrives without
   * the user copying anything. A pasted code still wins, because a user holding
   * one (the headless page shows it on screen) should never be second-guessed.
   *
   * @param {{credentialsService: object | undefined}} deps
   * @param {string} [code]
   * @param {number} [waitMs] - how long to wait for the redirect before giving up
   * @returns {Promise<object>}
   */
  const finishAuth = async (deps, code, waitMs = 90_000) => {
    const current = settings()
    const pending = state.pending
    if (pending === undefined) {
      return { ok: false, problem: 'no-attempt', message: 'Start the sign-in first.' }
    }
    let offered = typeof code === 'string' ? code.trim() : ''
    if (offered === '') {
      offered = pending.callback.received() ?? ''
      if (offered === '') offered = (await pending.callback.waitForCode(waitMs)) ?? ''
    }
    if (offered === '') {
      return {
        ok: false,
        problem: 'no-code',
        message: 'No authorization code arrived. Finish the sign-in, or paste the code shown on the page.',
      }
    }
    const exchanged = await exchangeCode(current.authOrigin, {
      code: offered,
      codeVerifier: pending.pkce.verifier,
    })
    // The code is single-use whether or not the exchange succeeded, and the
    // verifier is bound to it — so the attempt is spent either way.
    await pending.callback.close()
    state.pending = undefined
    if (!exchanged.ok) {
      return { ok: false, problem: 'exchange-failed', message: exchanged.error }
    }
    const stored = await storeApiKey(deps.credentialsService, current.apiKeyEnv, exchanged.key)
    if (!stored.ok) {
      return { ok: false, problem: 'no-service', message: stored.error }
    }
return { ok: true, keyName: current.keyName, keyRef: current.apiKeyEnv }
  }

  const abandonAuth = async () => {
    if (state.pending === undefined) return { ok: false }
    await state.pending.callback.close()
    state.pending = undefined
    return { ok: true }
  }

  // ── shared dependencies for tools and routes ────────────────────────────────

  const deps = {
    settings,
    appUrl: () => settings().appUrl,
    resolveKey: async () => resolveApiKey(ctx.get('credentials', false), settings().apiKeyEnv),
    fetchCatalog: async (current, signal) => readCatalog(current, { force: true, signal }),
    imageProtocolOf: (modelId) => imageProtocolOf(state.catalog.find((model) => model.id === modelId)),
    /** Turn gateway images into attachment-backed blocks so they enter the chat. */
    imageBlocks: async (images) => {
      const attachments = ctx.get('attachments', false)
      if (attachments === undefined) return []
      const blocks = []
      for (const image of images) {
        if (typeof image.url !== 'string' || image.url === '') continue
        try {
          const response = await fetch(image.url)
          if (!response.ok) continue
          const bytes = new Uint8Array(await response.arrayBuffer())
          const stored = await attachments.saveImage({ data: bytes, mediaType: mediaTypeOf(response) })
          if (stored === undefined) continue
          blocks.push({ type: 'image', attachment: stored })
        } catch (error) {
          ctx.logger?.warn(`[${name}] could not attach a generated image: ${messageOf(error)}`)
        }
      }
      return blocks
    },
  }

  // ── agent tools ─────────────────────────────────────────────────────────────

  ctx.effect(() => {
    const tools = ctx.get('tools', false)
    if (tools === undefined) return
    const registered = createTools(deps)
    for (const definition of registered) {
      try {
        const dispose = tools.register(definition)
        ctx.effect(dispose, definition.name)
      } catch (error) {
        // One rejected definition must not cost the other three.
        ctx.logger?.warn(`[${name}] tool "${definition.name}" was rejected: ${messageOf(error)}`)
      }
    }
  })

/**
   * Write a settings-page form back into this bundle's own settings namespace.
   *
   * `patchFrom` is the gate: it drops anything off the allow-list and coerces
   * the rest, so a crafted body cannot repoint `baseURL`, rename the provider
   * route with an illegal value, or set a field the schema does not declare.
   * The revision is re-read inside the write so a form left open while the user
   * edits the same row elsewhere loses the race instead of clobbering it.
   *
   * @param {object} payload
   * @returns {Promise<object>}
   */
  const saveConfig = async (payload) => {
    const settingsService = ctx.get('settings', false)
    if (settingsService === undefined) {
      return { ok: false, problem: 'no-service', message: 'settings service unavailable' }
    }
    const { ops, rejected } = patchFrom(payload, settings())
    if (ops.length === 0) {
      return {
        ok: false,
        problem: 'nothing-to-write',
        message: rejected.length === 0 ? 'No settings were supplied.' : `Unsupported field(s): ${rejected.join(', ')}.`,
      }
    }
    const target = findOwnNamespace(settingsService, name)
    if ('error' in target) return { ok: false, problem: 'no-service', message: target.error }
    try {
      await settingsService.mutate(target.ns, ops, target.revision)
    } catch (error) {
      return { ok: false, problem: 'rejected', message: messageOf(error) }
    }
    return {
      ok: true,
      saved: ops.map((op) => op.path[0]),
      rejected,
      settings: settings(),
    }
  }

  // ── the settings page's API ─────────────────────────────────────────────────

  const status = async () => {
    const current = settings()
    const key = await resolveApiKey(ctx.get('credentials', false), current.apiKeyEnv)
    const routed = readProvider(ctx.get('settings', false), current.providerRoute)
    const catalog = await readCatalog(current)
    return {
      ok: true,
      route: current.providerRoute,
      baseURL: current.baseURL,
      key: {
        configured: key !== undefined,
        ref: current.apiKeyEnv,
        // The value itself is never part of any response.
      },
      catalog: catalog.ok
        ? { count: catalog.models.length, models: catalog.models }
        : { count: 0, models: [], error: catalog.error },
      routed,
      settings: current,
    }
  }

  const handler = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.replace(/^\/api\/onekey-models/, '').replace(/\/+$/, '') || '/'
    const method = String(req.method ?? 'GET').toUpperCase()

    const send = (payload, init = {}) => {
      const body = JSON.stringify(payload)
      res.writeHead(init.status ?? 200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        ...init.headers,
      })
      res.end(body)
    }

    const rejection = rejectionFor(req, ctx.get('connection', false))
    if (rejection !== undefined) {
      send({ ok: false, error: rejection.reason }, { status: rejection.status })
      return
    }

    /**
     * Read an optional JSON body. A malformed or absent body is not an error
     * here — every POST on this route works with an empty body except
     * `/auth/finish`, whose `code` is optional too.
     *
     * @param {object} req
     * @returns {Promise<object>}
     */
    const body = async () => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      if (chunks.length === 0) return {}
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        return parsed !== null && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }

      try {
        if (method === 'GET' && route === '/status') {
          send(await status())
          return
        }
        if (method === 'POST' && route === '/catalog/refresh') {
          const catalog = await readCatalog(settings(), { force: true })
          send(catalog.ok
            ? { ok: true, count: catalog.models.length, models: catalog.models }
            : { ok: false, error: catalog.error })
          return
        }
        if (method === 'POST' && route === '/auth/start') {
          send(await beginAuth())
          return
        }
        if (method === 'POST' && route === '/auth/finish') {
          const { code, waitMs } = await body()
          const result = await finishAuth(
            { credentialsService: ctx.get('credentials', false) },
            typeof code === 'string' ? code : undefined,
            typeof waitMs === 'number' && Number.isFinite(waitMs) ? waitMs : undefined,
          )
          send(result, { status: result.ok ? 200 : 400 })
          if (result.ok) await publish()
          return
        }
        if (method === 'POST' && route === '/auth/cancel') {
          send(await abandonAuth())
          return
        }
        if (method === 'POST' && route === '/apply') {
          send(await publish())
          return
        }
        if (method === 'POST' && route === '/config') {
          const result = await saveConfig(await body())
          send(result, { status: result.ok ? 200 : 400 })
          if (result.ok) await publish()
          return
        }
        if (method === 'POST' && route === '/key/clear') {
          const result = await clearApiKey(ctx.get('credentials', false), settings().apiKeyEnv)
          send(result, { status: result.ok ? 200 : 400 })
          if (result.ok) await publish()
          return
        }
      if (method === 'GET' && (route === '/image-models' || route === '/jev-models')) {
        const catalog = await readCatalog(settings())
        const models = catalog.ok ? (route === '/image-models' ? imageModels(catalog.models) : jevModels(catalog.models)) : []
        send({ ok: catalog.ok, models, error: catalog.error })
        return
      }
      send({ ok: false, error: 'unknown route' }, { status: 404 })
    } catch (error) {
      send({ ok: false, error: messageOf(error) }, { status: 500 })
    }
  }

  ctx.inject(['webServer'], (scoped) => {
    const server = scoped.webServer
    scoped.effect(() => server.register({
      kind: 'prefix',
      path: '/api/onekey-models',
      handler,
    }), 'onekey-models api')
  })

  // A settings change must reach the router without a restart. The key itself
  // is published at the two moments it can change — right after a successful
  // exchange and right after it is cleared — because no event fires for either.
  const publish = async () => {
    const settingsService = ctx.get('settings', false)
    const credentialsService = ctx.get('credentials', false)
    const key = await resolveApiKey(credentialsService, settings().apiKeyEnv)
    if (key === undefined) {
      const target = findRouterNamespace(settingsService, settings().providerRoute)
      if ('error' in target) return
      await writeProvider(settingsService, { ns: target.ns, provider: undefined, route: settings().providerRoute })
      return
    }
    await applyNow({ settingsService, credentialsService, key })
  }

  ctx.on('loader/volatile-update', () => {
    void publish()
  })
}

/**
 * @param {Response} response
 * @returns {'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'}
 */
function mediaTypeOf(response) {
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim()
  return type === 'image/jpeg' || type === 'image/webp' || type === 'image/gif' ? type : 'image/png'
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}