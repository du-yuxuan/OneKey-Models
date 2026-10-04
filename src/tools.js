/**
 * The four agent-facing tools.
 *
 * Built here rather than imported: `@deepseek-ai/dsh-tools` is not resolvable
 * from a plugin bundle (the published packages lag the running harness badly —
 * `dsh-settings` on npm is `0.0.1-rc.1` against a deployed `0.1.6-alpha.2`),
 * and dsh-jev-tools sets the precedent for addressing host structures by
 * service key plus structural type instead.
 *
 * A registry-ready definition is only a plain object: `ctx.tools.register`
 * requires `output.render` to be a function, an object-rooted supported output
 * schema and a positive finite `timeoutMs`. Argument validation the registry
 * does for itself is reproduced in `validateArgs` — a model that sends
 * `{"n": "three"}` deserves a message naming the field, not an opaque throw.
 *
 * Every tool returns a structured value instead of throwing: `jev-tools`
 * established that a model can act on `{ok: false, problem, message}` and
 * cannot act on a rejected promise.
 *
 * @module src/tools.js
 */
import { chatCompletion } from './http.js'
import { generateImage } from './image.js'
import { askTyped } from './jev.js'

/** Every refusal uses one vocabulary, so the model learns it once. */
const PROBLEMS = {
  disabled: 'the corresponding feature switch is off in the plugin settings',
  'no-service': 'the credential service is not available in this composition',
  'no-key': 'no API key is stored yet',
  'bad-request': 'the arguments do not describe a callable request',
  'upstream': 'TokenDance rejected the request',
  'network': 'the gateway could not be reached',
}

export { PROBLEMS }

/**
 * Reject an object-rooted parameter schema with path-qualified messages.
 *
 * A deliberately small subset — type, enum, required, properties, items — is
 * enough for four tools with flat string arguments, and being smaller than the
 * registry's own validator means it can only ever be *more* permissive, never
 * reject something the registry would accept.
 *
 * @param {object | undefined} schema
 * @param {unknown} value
 * @param {string} [path]
 * @returns {string[]} violations; empty means valid
 */
export function validateArgs(schema, value, path = '') {
  const at = (key) => (path === '' ? key : `${path}.${key}`)
  if (schema?.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return [`${path === '' ? 'value' : path} must be an object`]
    }
    const violations = []
    const properties = schema.properties ?? {}
    for (const name of schema.required ?? []) {
      if (value[name] === undefined) violations.push(`${at(name)} is required`)
    }
    for (const [name, child] of Object.entries(value)) {
      const childSchema = properties[name]
      if (childSchema === undefined) {
        if (schema.additionalProperties === false) violations.push(`${at(name)} is not a parameter`)
        continue
      }
      violations.push(...validateArgs(childSchema, child, at(name)))
    }
    return violations
  }
  if (schema?.type === 'string' && typeof value !== 'string') {
    return [`${path === '' ? 'value' : path} must be a string`]
  }
  if (schema?.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    return [`${path === '' ? 'value' : path} must be a finite number`]
  }
  if (schema?.type === 'boolean' && typeof value !== 'boolean') {
    return [`${path === '' ? 'value' : path} must be a boolean`]
  }
  if (Array.isArray(schema?.enum) && !schema.enum.includes(value)) {
    return [`${path === '' ? 'value' : path} must be one of ${schema.enum.join(', ')}`]
  }
  return []
}

/**
 * Assemble a registry-ready tool definition.
 *
 * @param {object} options
 * @param {string} options.name
 * @param {string} options.description
 * @param {object} options.parameters - raw JSON Schema
 * @param {object} options.output.schema - raw JSON Schema
 * @param {(args: object, value: object) => unknown[]} options.output.render
 * @param {number} [options.timeoutMs]
 * @param {(args: object, exec: object) => Promise<object>} options.execute
 * @returns {object}
 */
export function defineTool(options) {
  const parameters = options.parameters
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`)
  }
  return {
    name: options.name,
    description: options.description,
    parameters,
    output: { schema: options.output.schema, render: options.output.render },
    ...options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs },
    isConcurrencySafe: () => true,
    async execute(rawArgs, exec) {
      const args = rawArgs ?? {}
      const violations = validateArgs(parameters, args)
      if (violations.length > 0) {
        return { ok: false, problem: 'bad-request', message: violations.join('; '), report: violations.join('; ') }
      }
      return options.execute(args, exec)
    },
  }
}

const OK_ONLY = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: true }

function textOf(value) {
  return [{ type: 'text', text: typeof value?.report === 'string' ? value.report : '(no output)' }]
}

function refusal(problem, extra = {}) {
  const message = typeof extra.message === 'string' && extra.message !== ''
    ? extra.message
    : `Cannot run this: ${PROBLEMS[problem] ?? problem}.`
  return { ok: false, problem, message, report: message, ...extra }
}

/**
 * Build all four definitions against one dependency bundle.
 *
 * `deps.resolveKey()` re-reads the credential store per call, so a key fixed in
 * another window takes effect immediately; `deps.settings()` returns the live
 * plain config; `deps.appUrl` is a thunk rather than a string because the
 * attribution URL is user-editable and must not be frozen at registration.
 *
 * @param {object} deps
 * @param {() => Promise<string | undefined>} deps.resolveKey
 * @param {() => object} deps.settings
 * @param {() => string} deps.appUrl
 * @param {(settings: object, signal?: AbortSignal) => Promise<{ok: boolean, models?: object[], error?: string}>} deps.fetchCatalog
 * @param {(modelId: string) => 'openai' | 'ark' | undefined} deps.imageProtocolOf
 * @param {(images: Array<{url?: string}>) => Promise<unknown[]>} deps.imageBlocks - image blocks for the conversation
 * @returns {object[]} definitions, in registration order
 */
export function createTools(deps) {
  return [
    catalogTool(deps),
    chatTool(deps),
    imageTool(deps),
    jevTool(deps),
  ]
}

function catalogTool(deps) {
  return defineTool({
    name: 'tokendance_models',
    description:
      'List the models TokenDance currently offers, with each one\'s context window, what it can do '
      + '(chat, image, video, speech, embedding, typed decisions) and which wire protocol reaches it. '
      + 'Use it to find the exact model id before calling another TokenDance tool, or to answer "which '
      + 'models can I use" — the ids are the live directory, so never guess one.',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional case-insensitive substring matched against the model id or name.',
        },
        capability: {
          type: 'string',
          enum: ['chat', 'image', 'jev', 'video', 'speech', 'embedding', 'audio', 'music', 'search'],
          description: 'Restrict the list to one kind of model.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          count: { type: 'number' },
          report: { type: 'string' },
        },
        required: ['ok'],
        additionalProperties: true,
      },
      render: (_args, value) => textOf(value),
    },
    timeoutMs: deps.settings().toolTimeoutMs,
    async execute(args, exec) {
      const settings = deps.settings()
      if (settings.enableCatalogTool === false) return refusal('disabled')
      const fetched = await deps.fetchCatalog(settings, exec?.signal)
      if (!fetched.ok) return refusal('network', { message: `Could not read the TokenDance catalog: ${fetched.error}` })
      const catalog = fetched.models
      const filtered = catalog.filter((model) => {
        if (args.capability !== undefined) {
          if (args.capability === 'chat') return model.routeable === true
          return (model.capabilities ?? []).includes(args.capability)
        }
        if (args.filter === undefined) return true
        const needle = args.filter.toLowerCase()
        return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle)
      })
      const report = filtered.length === 0
        ? `No TokenDance model matches ${JSON.stringify(args.filter ?? args.capability ?? 'the filter')}.`
        : filtered.map((model) => `${model.id} — ${model.name}${describeModel(model)}`).join('\n')
      return { ok: true, count: filtered.length, report, models: filtered.map((model) => model.id) }
    },
  })
}

function chatTool(deps) {
  return defineTool({
    name: 'tokendance_chat',
    description:
      'Send one message to one TokenDance model and return its reply. Use it for a one-off call or to '
      + 'compare models side by side; for an ongoing conversation pick the model in the model selector '
      + 'instead, which streams into the chat. Accepts text and images, so a screenshot can be sent with '
      + 'the prompt — but only to a model that actually reads images.',
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Exact model id from tokendance_models.' },
        prompt: { type: 'string', description: 'The user message.' },
        system: { type: 'string', description: 'Optional system instruction.' },
        imageUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Public image URLs to attach. Only for models that accept image input.',
        },
        maxTokens: { type: 'number', description: 'Optional cap on the reply length.' },
      },
      required: ['model', 'prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          model: { type: 'string' },
          report: { type: 'string' },
        },
        required: ['ok'],
        additionalProperties: true,
      },
      render: (_args, value) => textOf(value),
    },
    timeoutMs: deps.settings().toolTimeoutMs,
    async execute(args, exec) {
      const settings = deps.settings()
      const key = await deps.resolveKey()
      if (key === undefined) return refusal('no-key')
      const content = [{ type: 'text', text: args.prompt }]
      for (const url of args.imageUrls ?? []) {
        content.push({ type: 'image_url', image_url: { url } })
      }
      const messages = [
        ...args.system === undefined ? [] : [{ role: 'system', content: args.system }],
        { role: 'user', content: content.length === 1 ? args.prompt : content },
      ]
      const result = await chatCompletion(settings.baseURL, {
        key,
        model: args.model,
        messages,
        appUrl: deps.appUrl,
        timeoutMs: settings.toolTimeoutMs,
        signal: exec?.signal,
        ...args.maxTokens === undefined ? {} : { maxTokens: args.maxTokens },
      })
      if (!result.ok) return upstreamRefusal(result, args.model)
      return { ok: true, model: args.model, report: result.text ?? '(empty reply)', text: result.text ?? '' }
    },
  })
}

function imageTool(deps) {
  return defineTool({
    name: 'tokendance_image',
    description:
      'Generate an image with a TokenDance image model and return it into the conversation. Use it when '
      + 'the user asks for a picture, an illustration, a poster or a diagram. Pick a model from '
      + 'tokendance_models with the image capability; models that accept reference images can take URLs '
      + 'in referenceImages.',
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Exact image model id from tokendance_models.' },
        prompt: { type: 'string', description: 'What the image should show, in plain language.' },
        size: {
          type: 'string',
          description: 'Pixel size such as "1024x1024", or an Ark size token "2K" / "4K". Defaults to 1024x1024.',
        },
        n: { type: 'number', description: 'How many images to generate. Defaults to 1.' },
        referenceImages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Public image URLs to follow. Ark-protocol models only.',
        },
      },
      required: ['model', 'prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          report: { type: 'string' },
          images: { type: 'array' },
        },
        required: ['ok'],
        additionalProperties: true,
      },
      render: (_args, value) => value.content ?? textOf(value),
    },
    timeoutMs: deps.settings().toolTimeoutMs,
    async execute(args, exec) {
      const settings = deps.settings()
      if (settings.enableImageTool === false) return refusal('disabled')
      const key = await deps.resolveKey()
      if (key === undefined) return refusal('no-key')
      const protocol = deps.imageProtocolOf(args.model) ?? 'openai'
      const result = await generateImage({
        baseURL: settings.baseURL,
        key,
        model: args.model,
        prompt: args.prompt,
        protocol,
        appUrl: deps.appUrl,
        timeoutMs: settings.toolTimeoutMs,
        signal: exec?.signal,
        ...args.size === undefined ? {} : { size: args.size },
        ...args.n === undefined ? {} : { n: args.n },
        ...args.referenceImages === undefined ? {} : { referenceImages: args.referenceImages },
      })
      if (!result.ok) return upstreamRefusal(result, args.model)
      const images = result.images ?? []
      if (images.length === 0) return { ok: false, problem: 'upstream', message: 'TokenDance returned no image.', report: 'TokenDance returned no image.' }
      const blocks = await deps.imageBlocks(images)
      const urls = images.map((image) => image.url ?? '(inline)')
      return {
        ok: true,
        report: `Generated ${images.length} image(s) with ${args.model}: ${urls.join(', ')}`,
        images: urls,
        content: [...blocks, { type: 'text', text: urls.join('\n') }],
      }
    },
  })
}

function jevTool(deps) {
  return defineTool({
    name: 'tokendance_jev',
    description:
      'Ask a TokenDance Jev model for typed decisions over a piece of content: a yes/no with a '
      + 'probability, one choice from a defined set, or a score on an ordered scale. Every question is '
      + 'answered in one pass. Use it when the same judgment must be made many times (classify, route, '
      + 'triage, rank), never for text generation, counting, arithmetic or date comparison. Probabilities '
      + 'are uncalibrated and may saturate on easy inputs: rank with them, never read them as an accuracy '
      + 'figure or route on a fixed confidence threshold.',
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Exact Jev model id from tokendance_models, e.g. bocha-jev-v1.' },
        state: {
          type: 'object',
          description: 'The material to judge. Keep it minimal — unrelated content measurably degrades accuracy.',
        },
        questions: {
          type: 'object',
          description: 'Map of your own question id to a question. Ids are echoed back verbatim and never sent to '
            + 'the model, so each must be self-describing in `instructions`. Shape: '
            + '{ type: "noul", instructions, criteria?: { true, false } } | '
            + '{ type: "choice", instructions, criteria: { option: rubric } } (at most 255 options) | '
            + '{ type: "score", instructions, criteria: [level0, level1, ...] } (2 to 10 levels).',
        },
      },
      required: ['model', 'state', 'questions'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          report: { type: 'string' },
        },
        required: ['ok'],
        additionalProperties: true,
      },
      render: (_args, value) => textOf(value),
    },
    timeoutMs: deps.settings().toolTimeoutMs,
    async execute(args, exec) {
      const settings = deps.settings()
      if (settings.enableJevTool === false) return refusal('disabled')
      const key = await deps.resolveKey()
      if (key === undefined) return refusal('no-key')
      const result = await askTyped({
        baseURL: settings.baseURL,
        key,
        model: args.model,
        questions: args.questions,
        appUrl: deps.appUrl,
        timeoutMs: settings.toolTimeoutMs,
        signal: exec?.signal,
        state: typeof args.state === 'string' ? args.state : JSON.stringify(args.state),
      })
      if (!result.ok) return upstreamRefusal(result, args.model)
      const answers = result.answers ?? {}
      const report = Object.entries(answers)
        .map(([id, answer]) => `${id}: ${JSON.stringify(answer)}`)
        .join('\n')
      return { ok: true, model: args.model, report: report === '' ? '(no answer)' : report, answers }
    },
  })
}

/** Turn an upstream failure into the same refusal vocabulary, keeping the remedy. */
function upstreamRefusal(result, model) {
  const remedy = {
    top_up_balance: 'The TokenDance balance is exhausted — top it up and retry.',
    reauthorize_api_key: 'The stored key is disabled or expired — re-authorize and retry.',
    api_key_quota: 'The key hit its quota window — wait for the reset or re-authorize.',
  }[result.recovery ?? '']
  const message = `TokenDance rejected the request${model === undefined ? '' : ` to ${model}`}: ${result.error}`
  return {
    ok: false,
    problem: result.status === 0 ? 'network' : 'upstream',
    message: remedy === undefined ? message : `${remedy} (${message})`,
    report: remedy === undefined ? message : `${remedy}\n${message}`,
    status: result.status,
  }
}

function describeModel(model) {
  const bits = []
  if (typeof model.contextWindow === 'number') bits.push(`${model.contextWindow} ctx`)
  const capabilities = model.capabilities ?? []
  if (capabilities.length > 0) bits.push(capabilities.join('/'))
  if (model.routeable !== true) bits.push('not chat-routable')
  return bits.length === 0 ? '' : ` [${bits.join(', ')}]`
}

