import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coerceField, editableFields, patchFrom } from '../src/patch.js'

const current = {}

test('editableFields matches the Config schema', () => {
  assert.deepEqual([...editableFields()].sort(), [
    // appUrl is absent on purpose: attribution is fixed in code.
    'authOrigin', 'autoConfigure', 'baseURL', 'displayName', 'enableCatalogTool',
    'enableImageTool', 'enableJevTool', 'imageInputModels', 'keyName', 'modelsDevUrl',
    'providerRoute', 'toolTimeoutMs', 'visibleModels',
  ])
  assert.ok(!editableFields().includes('appUrl'))
})

test('patchFrom drops an appUrl override (fixed attribution)', () => {
  const { ops, rejected } = patchFrom({ appUrl: 'https://evil.example.com' }, current)
  assert.deepEqual(ops, [])
  assert.deepEqual(rejected, ['appUrl'])
})

test('patchFrom keeps known keys and rejects everything else', () => {
  const { ops, rejected } = patchFrom({
    displayName: 'My Gateway',
    sneaky: 'drop me',
    providerRoute: 'myroute',
  }, current)
  assert.deepEqual(ops, [
    { op: 'set', path: ['displayName'], value: 'My Gateway' },
    { op: 'set', path: ['providerRoute'], value: 'myroute' },
  ])
  assert.deepEqual(rejected, ['sneaky'])
})

test('patchFrom rejects wrong-typed values instead of coercing them', () => {
  const { ops, rejected } = patchFrom({
    autoConfigure: 'yes',
    toolTimeoutMs: -5,
    visibleModels: 'not-an-array',
    baseURL: 'javascript:alert(1)',
    providerRoute: 'Bad Route',
  }, current)
  assert.deepEqual(ops, [])
  assert.deepEqual(rejected.sort(), ['autoConfigure', 'baseURL', 'providerRoute', 'toolTimeoutMs', 'visibleModels'])
})

test('patchFrom on a non-object payload is a normal empty result', () => {
  for (const payload of [null, 'text', 42, undefined]) {
    assert.deepEqual(patchFrom(payload, current), { ops: [], rejected: [] })
  }
})

test('coerceField applies the same gate field by field', () => {
  assert.equal(coerceField('unknownField', 'x'), undefined)
  assert.equal(coerceField('displayName', '  hi  '), 'hi')
  assert.equal(coerceField('displayName', '   '), undefined)
  assert.equal(coerceField('baseURL', 'https://a.example///'), 'https://a.example')
  assert.equal(coerceField('toolTimeoutMs', 1_000_000), 600_000)
  assert.deepEqual(coerceField('visibleModels', [' a', 'a', 'b']), ['a', 'b'])
  assert.equal(coerceField('autoConfigure', false), false)
})
