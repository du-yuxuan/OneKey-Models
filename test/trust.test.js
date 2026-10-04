import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLoopbackHost, rejectionFor } from '../src/trust.js'

test('isLoopbackHost accepts the loopback authorities only', () => {
  for (const good of ['localhost:19387', '127.0.0.1', '127.0.0.1:8080', 'http://127.0.0.1', '[::1]:3000', '::1']) {
    assert.equal(isLoopbackHost(good), true, `expected loopback: ${good}`)
  }
  for (const bad of [undefined, null, '', 'example.com', 'evil.example', 'file://x', 'http://127.0.0.1.evil', '127.0.0.1.evil']) {
    assert.equal(isLoopbackHost(bad), false, `expected rejection: ${String(bad)}`)
  }
})

const loopbackReq = (extra = {}) => ({
  headers: { host: '127.0.0.1:19387', ...extra },
  method: 'GET',
  url: '/api/onekey-models/status',
})

test('a plain loopback page request is admitted', () => {
  assert.equal(rejectionFor(loopbackReq({
    origin: 'http://127.0.0.1:19387',
    'sec-fetch-site': 'same-origin',
  })), undefined)
})

test('non-loopback host is rejected by the structural layer', () => {
  const rejection = rejectionFor({ headers: { host: 'attacker.example' } })
  assert.equal(rejection?.status, 403)
  assert.match(rejection?.reason, /non-loopback host/)
})

test('cross-site fetch is rejected even from a loopback host', () => {
  const rejection = rejectionFor(loopbackReq({ 'sec-fetch-site': 'cross-site' }))
  assert.equal(rejection?.status, 403)
  assert.match(rejection?.reason, /cross-site/)
})

test('origin that does not match the host is rejected', () => {
  const rejection = rejectionFor(loopbackReq({ origin: 'https://evil.example' }))
  assert.equal(rejection?.status, 403)
  assert.match(rejection?.reason, /origin does not match host/)
})

test('the connection service verdict wins when present', () => {
  const rejection = rejectionFor(loopbackReq(), {
    admit: () => ({ rejection: { status: 429, reason: 'slow down' } }),
  })
  assert.deepEqual(rejection, { status: 429, reason: 'slow down' })
})

test('a numeric status of zero falls back to 403, missing reason is named', () => {
  const rejection = rejectionFor(loopbackReq(), {
    admit: () => ({ rejection: { status: 0 } }),
  })
  assert.deepEqual(rejection, { status: 403, reason: 'forbidden by connection policy' })
})

test('a throwing connection service falls through to the structural check', () => {
  const connection = { admit: () => { throw new Error('service down') } }
  assert.equal(rejectionFor(loopbackReq(), connection), undefined)
  assert.equal(rejectionFor({ headers: { host: 'evil.example' } }, connection)?.status, 403)
})

test('a missing connection service falls through to the structural check', () => {
  assert.equal(rejectionFor(loopbackReq(), undefined), undefined)
  assert.equal(rejectionFor(loopbackReq(), {}), undefined)
})
