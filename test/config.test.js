import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Config, plainConfig, resolveSettings, visibleSetOf, imageInputOverrides } from '../src/config.js'

test('defaults point at the TokenDance gateway', () => {
  const s = resolveSettings({})
  assert.equal(s.providerRoute, 'tokendance')
  assert.equal(s.baseURL, 'https://tokendance.space/gateway/v1')
  assert.equal(s.authOrigin, 'https://tokendance.space')
  assert.equal(s.apiKeyEnv, 'TOKENDANCE_API_KEY')
  // Attribution is fixed in code and overrides are ignored by design.
  assert.equal(s.appUrl, 'plugin://oneKey-models')
  assert.equal(s.modelsDevUrl, 'https://models.dev/api.json?type=all')
  assert.equal(s.autoConfigure, false)
  assert.equal(s.toolTimeoutMs, 180_000)
  assert.deepEqual(s.visibleModels, [])
  assert.deepEqual(s.imageInputModels, [])
  assert.equal(s.enableImageTool, true)
  assert.equal(s.enableJevTool, true)
  assert.equal(s.enableCatalogTool, true)
})

test('Config is a schema object', () => {
  assert.equal(typeof Config, 'function')
})

test('providerRoute falls back to the default when malformed', () => {
  assert.equal(resolveSettings({ providerRoute: 'BAD Route!' }).providerRoute, 'tokendance')
  assert.equal(resolveSettings({ providerRoute: '' }).providerRoute, 'tokendance')
  assert.equal(resolveSettings({ providerRoute: 'my-route_2' }).providerRoute, 'my-route_2')
})

test('attribution appUrl is fixed: overrides are ignored, custom scheme survives', () => {
  assert.equal(resolveSettings({ appUrl: 'not a url' }).appUrl, 'plugin://oneKey-models')
  assert.equal(resolveSettings({ appUrl: 'https://evil.example.com' }).appUrl, 'plugin://oneKey-models')
  assert.equal(resolveSettings({ appUrl: '' }).appUrl, 'plugin://oneKey-models')
  // http(s) fields stay strict — only appUrl is special.
  assert.equal(resolveSettings({ baseURL: 'https://x.example/v1///' }).baseURL, 'https://x.example/v1')
  assert.equal(resolveSettings({ baseURL: 'ftp://x.example' }).baseURL,
    'https://tokendance.space/gateway/v1')
})

test('id lists are deduplicated and emptied of blanks', () => {
  const s = resolveSettings({ visibleModels: [' a ', 'a', '', 'b'] })
  assert.deepEqual(s.visibleModels, ['a', 'b'])
  assert.equal(resolveSettings({ visibleModels: 'nope' }).visibleModels.length, 0)
})

test('toolTimeoutMs must be a positive finite number and is truncated', () => {
  assert.equal(resolveSettings({ toolTimeoutMs: 2500.7 }).toolTimeoutMs, 2500)
  assert.equal(resolveSettings({ toolTimeoutMs: 0 }).toolTimeoutMs, 180_000)
  assert.equal(resolveSettings({ toolTimeoutMs: 'fast' }).toolTimeoutMs, 180_000)
})

test('visibleSetOf: empty array means no filter, non-empty means a set', () => {
  assert.equal(visibleSetOf(resolveSettings({})), undefined)
  assert.deepEqual([...visibleSetOf(resolveSettings({ visibleModels: ['a', 'b'] }))], ['a', 'b'])
})

test('imageInputOverrides maps each chosen id to text+image', () => {
  const map = imageInputOverrides(resolveSettings({ imageInputModels: ['seedream-5.0-pro'] }))
  assert.deepEqual([...map], [['seedream-5.0-pro', ['text', 'image']]])
})

test('plainConfig passes ordinary values through untouched', () => {
  assert.deepEqual(plainConfig({ a: { b: [1, { c: 2 }] } }), { a: { b: [1, { c: 2 }] } })
  assert.equal(plainConfig('x'), 'x')
})
