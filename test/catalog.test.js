import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  CAPABILITY_RULES, PI_AI_PROTOCOLS, buildEnrichment, describeModel,
  mergeCatalog, normalizeModelId, toProviderProfile,
} from '../src/catalog.js'

test('normalizeModelId folds vendor prefixes and odd characters', () => {
  assert.equal(normalizeModelId('tencent/Hy3'), 'hy3')
  assert.equal(normalizeModelId('Seedream 5.0 Lite'), 'seedream-5-0-lite')
  assert.equal(normalizeModelId('gpt-4o--mini!!'), 'gpt-4o-mini')
  assert.equal(normalizeModelId('---'), '')
  assert.equal(normalizeModelId(''), '')
})

test('describeModel maps chat protocols onto pi-ai wire protocols', () => {
  const openai = describeModel({ id: 'a', supported_protocols: ['openai:chat-completions'] })
  assert.equal(openai.routeable, true)
  assert.equal(openai.piAiProtocol, 'openai-completions')
  assert.ok(PI_AI_PROTOCOLS.includes(openai.piAiProtocol))

  const anthropic = describeModel({ id: 'b', supported_protocols: ['anthropic:messages'] })
  assert.equal(anthropic.piAiProtocol, 'anthropic-messages')

  const responses = describeModel({ id: 'c', supported_protocols: ['openai:responses'] })
  assert.equal(responses.piAiProtocol, 'openai-responses')
})

test('describeModel classifies capabilities from protocols, not names', () => {
  const image = describeModel({ id: 'seedream-5.0-lite', supported_protocols: ['openai:image-generations'] })
  assert.deepEqual(image.capabilities, ['image'])
  assert.equal(image.routeable, false)
  assert.equal(image.piAiProtocol, undefined)

  const jev = describeModel({ id: 'bocha-jev-v1', supported_protocols: ['typesafe:systemone'] })
  assert.deepEqual(jev.capabilities, ['jev'])
  assert.equal(jev.routeable, false)

  // A model can be both: chat-routable AND image-capable.
  const both = describeModel({ id: 'x', supported_protocols: ['openai:chat-completions', 'ark:image-generations'] })
  assert.equal(both.routeable, true)
  assert.deepEqual(both.capabilities, ['image'])

  const unknown = describeModel({ id: 'y', supported_protocols: ['vendor:whatever'] })
  assert.deepEqual(unknown.capabilities, [])
  assert.equal(unknown.routeable, false)

  const none = describeModel({ id: 'z' })
  assert.deepEqual(none.protocols, [])
  assert.equal(none.name, 'z')
  assert.equal(none.contextWindow, undefined)
})

test('describeModel picks piAiProtocol in advertised order', () => {
  const m = describeModel({ id: 'x', supported_protocols: ['ark:image-generations', 'anthropic:messages'] })
  assert.equal(m.piAiProtocol, 'anthropic-messages')
  assert.deepEqual(m.capabilities, ['image'])
})

test('mergeCatalog drops empty ids and sorts chat models first, then by id', () => {
  const models = mergeCatalog([
    { id: 'zzz', supported_protocols: ['openai:chat-completions'] },
    { id: '', supported_protocols: ['openai:chat-completions'] },
    { id: 'mmm', supported_protocols: ['openai:image-generations'] },
    { id: 'aaa', supported_protocols: ['openai:chat-completions'] },
  ])
  assert.deepEqual(models.map((m) => m.id), ['aaa', 'zzz', 'mmm'])
})

test('buildEnrichment keeps the richer record per normalized id', () => {
  const index = buildEnrichment({
    alpha: { name: 'Alpha', models: { 'hy3': { release_date: '2025-01-01' } } },
    beta: { name: 'Beta', models: { 'tencent/Hy3': { limit: { context: 2048 }, cost: { input: 1 } } } },
  })
  assert.equal(index.get('hy3').provider, 'beta')
  assert.equal(index.size, 1)
  assert.deepEqual(buildEnrichment(null), new Map())
})

test('mergeCatalog attaches models.dev enrichment with a logo URL', () => {
  const index = buildEnrichment({
    p: { name: 'P', models: { hy3: { limit: { context: 1000 }, release_date: '2025-06-01' } } },
  })
  const [m] = mergeCatalog([{ id: 'tencent/Hy3', context_length: 512 }], index)
  assert.equal(m.extra.contextWindow, 1000)
  assert.equal(m.extra.releaseDate, '2025-06-01')
  assert.equal(m.extra.logoUrl, 'https://models.dev/logos/p.svg')
})

test('toProviderProfile emits only routeable models and honours visibility', () => {
  const models = mergeCatalog([
    { id: 'chat-1', name: 'Chat', supported_protocols: ['openai:chat-completions'], context_length: 4096 },
    { id: 'img-1', name: 'Img', supported_protocols: ['openai:image-generations'] },
    { id: 'chat-2', name: 'Chat2', supported_protocols: ['anthropic:messages'] },
  ])
  const { provider, hidden } = toProviderProfile(models, {
    api: 'openai-completions',
    apiKeyEnv: 'TOKENDANCE_API_KEY',
    baseURL: 'https://tokendance.space/gateway/v1',
    displayName: 'TokenDance',
    visible: new Set(['chat-1']),
  })
  assert.equal(provider.api, 'openai-completions')
  assert.deepEqual(provider.models.map((m) => m.id), ['chat-1'])
  assert.equal(provider.models[0].contextWindow, 4096)
  assert.deepEqual(hidden, ['chat-2'])
})

test('image input is declared only with evidence or a manual override', () => {
  const entry = { id: 'vl-1', name: 'VL', routeable: true, protocols: [] }
  const base = { api: 'openai-completions', apiKeyEnv: 'K', baseURL: 'https://x/v1', displayName: 'D' }

  // Name suggests vision, but there is no evidence: no input field.
  const plain = toProviderProfile([entry], base)
  assert.equal(plain.provider.models[0].input, undefined)

  // Evidence via models.dev attachment flag.
  const evidenced = toProviderProfile([{ ...entry, extra: { attachment: true } }], base)
  assert.deepEqual(evidenced.provider.models[0].input, ['text', 'image'])

  // Manual override wins.
  const over = toProviderProfile([entry], { ...base, modalities: new Map([['vl-1', ['text', 'image']]]) })
  assert.deepEqual(over.provider.models[0].input, ['text', 'image'])
})

test('every capability category has a badge label in both client locales', async () => {
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  const badgesOf = (langBlock) => new Set([...langBlock.matchAll(/'badge\.([a-z]+)':/g)].map((m) => m[1]))
  const dictStart = client.indexOf('const DICT')
  const zhStart = client.indexOf('zh: {', dictStart)
  const enStart = client.indexOf('en: {', zhStart)
  const zh = client.slice(zhStart, enStart)
  const en = client.slice(enStart)
  const categories = CAPABILITY_RULES.map(([capability]) => capability)
  for (const [name, set] of [['zh', badgesOf(zh)], ['en', badgesOf(en)]]) {
    for (const capability of categories) {
      assert.ok(set.has(capability), `locale ${name} is missing badge.${capability}`)
    }
  }
  assert.deepEqual([...badgesOf(zh)].sort(), [...badgesOf(en)].sort())
})
