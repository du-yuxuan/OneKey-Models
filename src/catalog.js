/**
 * Catalog assembly: TokenDance's live directory joined with models.dev.
 *
 * TokenDance is not a models.dev provider, so enrichment cannot be a keyed
 * lookup — it is a reverse search across all 226 providers by normalized model
 * id. That is why the normalization exists and why it strips a vendor prefix
 * (`tencent/Hy3` and `hy3` are the same model).
 *
 * Each model carries an explicit capability classification derived from
 * `supported_protocols` rather than from its name. TokenDance's own docs warn
 * that a name is not a capability: only the advertised protocol is.
 *
 * @module src/catalog.js
 */

/** Protocols the pi-ai router accepts. Everything else needs the plugin's own
 *  HTTP client, so the classification has to know this exact set. */
export const PI_AI_PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages']

/** TokenDance protocol identifier → pi-ai wire protocol. */
const PI_AI_BY_TOKEN = new Map([
  ['openai:chat-completions', 'openai-completions'],
  ['openai:responses', 'openai-responses'],
  ['anthropic:messages', 'anthropic-messages'],
])

/** What a model is for, decided by the protocols it advertises. */
export const CAPABILITY_RULES = [
  ['jev', ['typesafe:systemone']],
  ['image', ['openai:image-generations', 'ark:image-generations', 'zai:layout-parsing']],
  ['video', [
    'seedance:generations',
    'minimax:video_generation_v2',
    'kling:text2video',
    'kling:image2video',
    'kling:motion-control',
    'kling:omni-video',
    'wan3:video-synthesis',
    'happyhorse:video-synthesis',
  ]],
  ['embedding', ['openai:embeddings']],
  ['rerank', ['qwen:text-rerank']],
  ['speech', ['minimax:t2a_v2', 'minimax:t2a_v2_ws', 'ark:tts', 'ark:tts_ws', 'minimax:voice_clone']],
  ['audio', ['qwen:audio-asr', 'qwen:audio-asr-streaming']],
  ['music', ['yinchao:song', 'yinchao:lyric-generate']],
  ['search', ['bocha:web-search', 'unifuncs:web-search', 'unifuncs:web-reader']],
]

/**
 * Fold a model id into a comparable key.
 *
 * @param {string} id
 * @returns {string}
 */
export function normalizeModelId(id) {
  const tail = String(id).split('/').pop() ?? ''
  return tail.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Build the id → enrichment index from a models.dev `api.json` payload.
 *
 * When several providers describe the same model the richest record wins: a
 * known context window beats a missing one, a dated release beats none.
 *
 * @param {Record<string, {id?: string, name?: string, models?: Record<string, object>}>} api
 * @returns {Map<string, object>}
 */
export function buildEnrichment(api) {
  const index = new Map()
  if (api === null || typeof api !== 'object') return index
  for (const [providerId, provider] of Object.entries(api)) {
    const models = provider?.models
    if (models === null || typeof models !== 'object') continue
    for (const [modelId, model] of Object.entries(models)) {
      const key = normalizeModelId(modelId)
      if (key === '') continue
      const candidate = { ...model, provider: providerId, providerName: provider?.name }
      const incumbent = index.get(key)
      if (incumbent === undefined || score(candidate) > score(incumbent)) index.set(key, candidate)
    }
  }
  return index
}

function score(model) {
  let value = 0
  if (typeof model?.limit?.context === 'number') value += 4
  if (typeof model?.cost?.input === 'number') value += 2
  if (typeof model?.release_date === 'string') value += 1
  if (Array.isArray(model?.modalities?.input) && model.modalities.input.length > 0) value += 1
  return value
}

/**
 * Classify one catalog entry.
 *
 * @param {{id?: string, name?: string, description?: string, context_length?: number,
 *   created?: number, supported_protocols?: string[]}} entry
 * @returns {{id: string, name: string, description: string, contextWindow?: number,
 *   created?: number, protocols: string[], piAiProtocol?: string,
 *   capabilities: string[], routeable: boolean}}
 */
export function describeModel(entry) {
  const id = typeof entry?.id === 'string' ? entry.id : ''
  const rawProtocols = Array.isArray(entry?.supported_protocols)
    ? entry.supported_protocols
    : Array.isArray(entry?.protocols)
      ? entry.protocols
      : []
  const protocols = rawProtocols.filter((value) => typeof value === 'string')
  const capabilities = CAPABILITY_RULES
    .filter(([, tokens]) => protocols.some((protocol) => tokens.includes(protocol)))
    .map(([capability]) => capability)
  const piAiProtocol = protocols.map((protocol) => PI_AI_BY_TOKEN.get(protocol)).find(Boolean)
  return {
    id,
    name: typeof entry?.name === 'string' && entry.name !== '' ? entry.name : id,
    description: typeof entry?.description === 'string' ? entry.description : '',
    ...((typeof entry?.context_length === 'number' || typeof entry?.contextWindow === 'number')
      ? { contextWindow: entry.context_length ?? entry.contextWindow }
      : {}),
    ...(typeof entry?.created === 'number' ? { created: entry.created } : {}),
    protocols,
    ...(piAiProtocol === undefined ? {} : { piAiProtocol }),
    capabilities,
    routeable: piAiProtocol !== undefined,
  }
}

/**
 * Join the TokenDance directory with models.dev metadata.
 *
 * @param {unknown[]} entries - raw `/gateway/v1/models` data array
 * @param {Map<string, object>} [enrichment] - from {@link buildEnrichment}
 * @returns {Array<object & {extra?: object}>} chat-capable models first, then by id
 */
export function mergeCatalog(entries, enrichment = new Map()) {
  const models = (Array.isArray(entries) ? entries : [])
    .map(describeModel)
    .filter((model) => model.id !== '')
    .map((model) => {
      const extra = enrichment.get(normalizeModelId(model.id))
      if (extra === undefined) return model
      return {
        ...model,
        extra: {
          provider: extra.provider,
          providerName: extra.providerName,
          releaseDate: extra.release_date,
          lastUpdated: extra.last_updated,
          modalities: extra.modalities,
          contextWindow: extra.limit?.context,
          maxInputTokens: extra.limit?.input,
          maxOutputTokens: extra.limit?.output,
          cost: extra.cost,
          reasoning: extra.reasoning,
          toolCall: extra.tool_call,
          attachment: extra.attachment,
          openWeights: extra.open_weights,
          ...(extra.provider === undefined
            ? {}
            : { logoUrl: `https://models.dev/logos/${extra.provider}.svg` }),
        },
      }
    })
  models.sort((a, b) => {
    // Chat models first: those are the ones a newcomer actually picks.
    const chatA = a.piAiProtocol === undefined ? 1 : 0
    const chatB = b.piAiProtocol === undefined ? 1 : 0
    return chatA - chatB || a.id.localeCompare(b.id)
  })
  return models
}

/**
 * Fold a catalog into a pi-ai provider profile.
 *
 * Only routeable models are emitted — pi-ai rejects a profile it cannot serve,
 * and a non-chat model on a chat route is exactly that rejection at the worst
 * possible moment (when the user picks it).
 *
 * The official warning is respected: image input is declared only for a model
 * whose models.dev record explicitly reports `attachment: true` or an `image`
 * input modality, or for one the user overrode by hand. A name like `-vl-` or
 * `-v-` is not evidence.
 *
 * @param {Array<object>} models
 * @param {{api: string, apiKeyEnv: string, baseURL: string, displayName: string,
 *   visible?: Set<string> | undefined, modalities?: Map<string, string[]>}} options
 * @returns {{provider: object, hidden: string[]}}
 */
export function toProviderProfile(models, options) {
  const provider = {
    apiKeyEnv: options.apiKeyEnv,
    displayName: options.displayName,
    api: options.api,
    baseURL: options.baseURL,
    models: [],
  }
  const hidden = []
  for (const model of models) {
    if (model.routeable !== true) continue
    if (options.visible !== undefined && !options.visible.has(model.id)) {
      hidden.push(model.id)
      continue
    }
    const profile = { id: model.id, name: model.name }
    const contextWindow = model.extra?.contextWindow ?? model.contextWindow
    if (typeof contextWindow === 'number') profile.contextWindow = contextWindow
    const input = inputModalities(model, options.modalities)
    if (input !== undefined) profile.input = input
    provider.models.push(profile)
  }
  return { provider, hidden }
}

function inputModalities(model, overrides) {
  const override = overrides?.get(model.id)
  if (Array.isArray(override)) return override
  const extra = model.extra
  const input = extra?.modalities?.input
  if (Array.isArray(input) && input.includes('image')) return ['text', 'image']
  if (extra?.attachment === true) return ['text', 'image']
  // Text-only is pi-ai's own default; declaring it keeps the profile explicit.
  return undefined
}