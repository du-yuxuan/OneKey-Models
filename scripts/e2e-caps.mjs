// E2E capability test: chat / multimodal / image / Jev against the live gateway.
// The API key is read from the key file and NEVER printed or logged.
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchModels, chatCompletion } from '../src/http.js'
import { buildEnrichment, mergeCatalog } from '../src/catalog.js'
import { generateImage, imageModels } from '../src/image.js'
import { askTyped, jevModels } from '../src/jev.js'

const KEY_FILE = process.env.TOKENDANCE_KEY_FILE
  ?? '/var/folders/yp/xr9bq8lj50s6bsh23lp8qnh40000gn/T/tokendance-e2e.key'
const BASE = process.env.TOKENDANCE_BASE_URL ?? 'https://tokendance.space/gateway/v1'
const APP_URL = 'https://github.com/du-yuxuan/OneKey-Models'
const key = readFileSync(KEY_FILE, 'utf8').trim()
if (!key.startsWith('sk-')) throw new Error('key file missing or invalid')

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${detail}`)
}

// ---- catalog ----------------------------------------------------------------
const fetched = await fetchModels(BASE, { timeoutMs: 30_000 })
if (!fetched.ok) throw new Error(`catalog fetch failed: ${fetched.status} ${fetched.error}`)
let api = null
try {
  api = await (await fetch('https://models.dev/api.json?type=all')).json()
} catch { api = null }
const catalog = mergeCatalog(fetched.models, buildEnrichment(api))
const routeable = catalog.filter((m) => m.routeable)

const pickChat = routeable.find((m) => /deepseek/i.test(m.id))
  ?? routeable.find((m) => m.piAiProtocol === 'openai-completions')
const pickVl = routeable.find((m) => m.piAiProtocol === 'openai-completions'
  && Array.isArray(m.extra?.modalities?.input) && m.extra.modalities.input.includes('image'))
  ?? routeable.find((m) => m.piAiProtocol === 'openai-completions' && /vl|vision|4o|gemini/i.test(m.id))
const imgs = imageModels(catalog)
const jevs = jevModels(catalog)
console.log(`catalog=${catalog.length} routeable=${routeable.length} chat=${pickChat?.id} vl=${pickVl?.id} image=${imgs.length} jev=${jevs.length}`)

// ---- 1) plain chat ----------------------------------------------------------
try {
  const r = await chatCompletion(BASE, {
    key,
    model: pickChat.id,
    messages: [{ role: 'user', content: 'Reply with exactly: PONG' }],
    maxTokens: 64,
    timeoutMs: 60_000,
    appUrl: APP_URL,
  })
  record('chat', r.ok && (r.text ?? '').length > 0,
    `model=${pickChat.id} http=${r.status} reply="${(r.text ?? '').slice(0, 60)}"`)
} catch (e) {
  record('chat', false, String(e?.message ?? e))
}

// ---- 2) multimodal input (1x1 red PNG as image_url) -------------------------
if (pickVl) {
  try {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    const r = await chatCompletion(BASE, {
      key,
      model: pickVl.id,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What color is this 1x1 pixel? One word.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
        ],
      }],
      maxTokens: 64,
      timeoutMs: 60_000,
      appUrl: APP_URL,
    })
    record('multimodal', r.ok && (r.text ?? '').length > 0,
      `model=${pickVl.id} http=${r.status} reply="${(r.text ?? '').slice(0, 60)}"`)
  } catch (e) {
    record('multimodal', false, String(e?.message ?? e))
  }
} else {
  record('multimodal', false, 'no vision-capable openai-completions model in catalog')
}

// ---- 3) image generation ----------------------------------------------------
const img = imgs.find((m) => /seedream-5\.0-lite/.test(m.id)) ?? imgs[0]
if (img) {
  try {
    const out = await generateImage({
      baseURL: BASE, key,
      model: img.id,
      protocol: img.protocol,
      prompt: 'A tiny blue circle centered on a plain white background, minimal flat style',
      size: img.protocol === 'ark' ? '2K' : '1024x1024',
      n: 1,
      appUrl: APP_URL,
      timeoutMs: 120_000,
    })
    const images = out.images ?? []
    record('image', out.ok && images.length > 0,
      `model=${img.id} proto=${img.protocol} http=${out.status} images=${images.length} first=${String(images[0]?.url ?? images[0]?.b64 ?? '').slice(0, 50)}`)
  } catch (e) {
    record('image', false, String(e?.message ?? e))
  }
} else {
  record('image', false, 'no image model in catalog')
}

// ---- 4) Jev typed judgment --------------------------------------------------
const jev = jevs.find((m) => /ateve/.test(m.id)) ?? jevs[0]
if (jev) {
  try {
    const r = await askTyped({
      baseURL: BASE, key,
      model: jev.id,
      questions: { q1: { type: 'noul', instructions: 'Is the sky blue during a clear day?' } },
      appUrl: APP_URL,
      timeoutMs: 60_000,
    })
    record('jev', r.ok && r.answers !== undefined,
      `model=${jev.id} http=${r.status} answers=${JSON.stringify(r.answers ?? r.error).slice(0, 120)}`)
  } catch (e) {
    record('jev', false, String(e?.message ?? e))
  }
} else {
  record('jev', false, 'no jev model in catalog')
}

// ---- summary ----------------------------------------------------------------
const failed = results.filter((r) => !r.ok)
console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} passed`)
writeFileSync('/tmp/e2e-results.json', JSON.stringify(results, null, 2))
process.exit(failed.length ? 1 : 0)
