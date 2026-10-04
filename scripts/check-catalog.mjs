#!/usr/bin/env node
/**
 * Live-catalog sanity check (npm run check:catalog).
 *
 * Verifies the assumptions every other module bakes in, against the real
 * TokenDance endpoint:
 *   1. /gateway/v1/models answers anonymously with a {data: [...]} envelope.
 *   2. Every entry has a unique, non-empty id and a supported_protocols list.
 *   3. The chat/image/jev specials the docs and tests reference still exist
 *      with the exact ids and protocols the code expects.
 *   4. Capability rules classify at least one model per documented category
 *      that TokenDance actually advertises (categories absent upstream are a
 *      warning, not a failure — the gateway's mix moves over time).
 *   5. Every routable model maps onto one of pi-ai's three wire protocols.
 *
 * Network failures are failures here: this script exists to be run before a
 * release with live connectivity, and a silent pass on "fetch is down" would
 * defeat its purpose. Set TOKENDANCE_BASE_URL to point it elsewhere.
 */
import { fetchModels, endpoints } from '../src/http.js'
import {
  CAPABILITY_RULES, PI_AI_PROTOCOLS, describeModel, mergeCatalog,
} from '../src/catalog.js'

const baseURL = process.env.TOKENDANCE_BASE_URL ?? 'https://tokendance.space/gateway/v1'

/** Ids the plugin's own docs, tests and UI copy name explicitly. */
const REQUIRED = {
  image: [
    ['seedream-5.0-lite', 'openai:image-generations'],
    ['seedream-5.0-pro', 'ark:image-generations'],
  ],
  jev: [
    ['ateve-jev-v1', 'typesafe:systemone'],
    ['bocha-jev-v1', 'typesafe:systemone'],
  ],
}

const failures = []
const warnings = []
const fail = (message) => failures.push(message)
const warn = (message) => warnings.push(message)

const result = await fetchModels(baseURL, { timeoutMs: 30_000 })
if (!result.ok) {
  console.error(`✗ catalog fetch failed: HTTP ${result.status} ${result.error ?? ''}`.trim())
  process.exit(1)
}

const models = mergeCatalog(result.models)
console.log(`catalog: ${models.length} models from ${endpoints(baseURL).v1}/models`)

if (models.length === 0) {
  fail('catalog is empty')
}

const seen = new Set()
for (const model of models) {
  if (seen.has(model.id)) fail(`duplicate model id: ${model.id}`)
  seen.add(model.id)
  if (!Array.isArray(model.protocols) || model.protocols.length === 0) {
    fail(`${model.id}: missing supported_protocols`)
    continue
  }
  const described = describeModel(model)
  if (described.routeable && !PI_AI_PROTOCOLS.includes(described.piAiProtocol)) {
    fail(`${model.id}: piAiProtocol ${described.piAiProtocol} not in PI_AI_PROTOCOLS`)
  }
}

for (const [kind, entries] of Object.entries(REQUIRED)) {
  for (const [id, protocol] of entries) {
    const model = models.find((candidate) => candidate.id === id)
    if (!model) {
      fail(`${kind} special missing from live catalog: ${id}`)
    } else if (!model.protocols.includes(protocol)) {
      fail(`${id}: expected protocol ${protocol}, got [${model.protocols.join(', ')}]`)
    }
  }
}

const describedAll = models.map(describeModel)
let routeable = 0
for (const described of describedAll) if (described.routeable) routeable += 1
if (routeable === 0) fail('no model maps onto a pi-ai wire protocol')

for (const [category] of CAPABILITY_RULES) {
  const hits = describedAll.filter((described) => described.capabilities.includes(category)).length
  if (hits === 0) warn(`capability "${category}": no live model advertises it`)
  else console.log(`  ${category.padEnd(9)} ${hits} models`)
}
console.log(`  routable  ${routeable} models`)

for (const message of warnings) console.warn(`⚠ ${message}`)
if (failures.length > 0) {
  for (const message of failures) console.error(`✗ ${message}`)
  process.exit(1)
}
console.log(`✓ catalog check passed (${models.length} models, ${routeable} routable)`)
