import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearApiKey, describeApiKey, isCredentialRefName, resolveApiKey, storeApiKey,
} from '../src/credentials.js'

const REF = 'TOKENDANCE_API_KEY'

const fakeService = (overrides = {}) => {
  const calls = { set: [], unset: [] }
  return {
    calls,
    resolve: async (ref) => ({ value: 'sk-live-EXAMPLE', source: 'file' }),
    describe: async (ref) => ({ configured: true, source: 'file', writable: true }),
    set: async (ref, value) => { calls.set.push([ref, value]) },
    unset: async (ref) => { calls.unset.push(ref) },
    ...overrides,
  }
}

test('isCredentialRefName enforces the POSIX grammar', () => {
  assert.equal(isCredentialRefName(REF), true)
  assert.equal(isCredentialRefName('a'), true)
  assert.equal(isCredentialRefName('1LEADING'), false)
  assert.equal(isCredentialRefName('has-dash'), false)
  assert.equal(isCredentialRefName('has space'), false)
  assert.equal(isCredentialRefName(''), false)
  assert.equal(isCredentialRefName(undefined), false)
})

test('resolveApiKey returns the stored key, or undefined when absent', async () => {
  assert.equal(await resolveApiKey(fakeService(), REF), 'sk-live-EXAMPLE')
  assert.equal(await resolveApiKey(fakeService({ resolve: async () => undefined }), REF), undefined)
  assert.equal(await resolveApiKey(fakeService({ resolve: async () => ({ value: '' }) }), REF), undefined)
  assert.equal(await resolveApiKey(fakeService({ resolve: async () => { throw new Error('boom') } }), REF), undefined)
  assert.equal(await resolveApiKey(undefined, REF), undefined)
  assert.equal(await resolveApiKey(fakeService(), 'bad ref'), undefined)
})

test('describeApiKey reports presence but never the value', async () => {
  const described = await describeApiKey(fakeService(), REF)
  assert.deepEqual(described, { configured: true, source: 'file', writable: true })
  assert.equal('value' in described, false)

  const missing = await describeApiKey(fakeService({ resolve: async () => ({ value: '' }) }), REF)
  assert.equal(missing.configured, false)

  const invalid = await describeApiKey(fakeService(), 'bad ref')
  assert.deepEqual(invalid, { configured: false, writable: false })

  const readonly = await describeApiKey(fakeService({ describe: async () => ({ writable: false }) }), REF)
  assert.equal(readonly.writable, false)
})

test('storeApiKey writes exactly one credential and reports honestly', async () => {
  const service = fakeService()
  assert.deepEqual(await storeApiKey(service, REF, 'sk-new'), { ok: true })
  assert.deepEqual(service.calls.set, [[REF, 'sk-new']])

  assert.match((await storeApiKey(service, REF, '')).error, /empty key/)
  assert.match((await storeApiKey(service, 'bad ref', 'k')).error, /invalid credential reference/)
  assert.match((await storeApiKey(undefined, REF, 'k')).error, /unavailable/)
  assert.match((await storeApiKey(fakeService({ set: async () => { throw new Error('disk full') } }), REF, 'k').then((r) => r.error)), /disk full/)
})

test('clearApiKey unsets and reports honestly', async () => {
  const service = fakeService()
  assert.deepEqual(await clearApiKey(service, REF), { ok: true })
  assert.deepEqual(service.calls.unset, [REF])

  assert.match((await clearApiKey(service, 'bad ref')).error, /invalid credential reference/)
  assert.match((await clearApiKey(undefined, REF)).error, /unavailable/)
  assert.match((await clearApiKey(fakeService({ unset: async () => { throw new Error('locked') } }), REF).then((r) => r.error)), /locked/)
})
