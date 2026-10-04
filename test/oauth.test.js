import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createPkce, authorizationUrl, openCallback } from '../src/oauth.js'

test('createPkce verifier is 72 chars of the RFC 7636 alphabet', () => {
  const { verifier, challenge, challengeMethod } = createPkce()
  assert.equal(verifier.length, 72)
  assert.match(verifier, /^[A-Za-z0-9\-._~]+$/)
  assert.equal(challengeMethod, 'S256')
  const recomputed = createHash('sha256').update(verifier, 'ascii').digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  assert.equal(challenge, recomputed)
})

test('two PKCEs never share a verifier', () => {
  assert.notEqual(createPkce().verifier, createPkce().verifier)
})

test('authorizationUrl is S256, stable-app-attributed, and headless by default', () => {
  const url = new URL(authorizationUrl({
    authOrigin: 'https://tokendance.space/',
    challenge: 'CHALLENGE',
    appUrl: 'https://github.com/du-yuxuan/OneKey-Models',
    keyName: 'DeepSeek Harness (OneKey-Models)',
  }))
  assert.equal(url.origin + url.pathname, 'https://tokendance.space/auth')
  assert.equal(url.searchParams.get('code_challenge'), 'CHALLENGE')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('app_url'), 'https://github.com/du-yuxuan/OneKey-Models')
  assert.equal(url.searchParams.get('key_name'), 'DeepSeek Harness (OneKey-Models)')
  assert.equal(url.searchParams.get('callback_url'), null)
})

test('authorizationUrl includes callback_url only when supplied', () => {
  const url = new URL(authorizationUrl({
    authOrigin: 'https://tokendance.space',
    challenge: 'C',
    appUrl: 'https://app.example',
    keyName: 'k',
    callbackUrl: 'http://127.0.0.1:5555/callback',
  }))
  assert.equal(url.searchParams.get('callback_url'), 'http://127.0.0.1:5555/callback')
})

test('openCallback captures the code from the redirect and reports a loopback origin', async () => {
  const cb = await openCallback()
  try {
    assert.match(cb.origin, /^http:\/\/127\.0\.0\.1:\d+$/)
    assert.equal(cb.callbackUrl, `${cb.origin}/callback`)
    assert.equal(cb.received(), undefined)

    const response = await fetch(`${cb.callbackUrl}?code=the-code`, { redirect: 'manual' })
    const body = await response.text()
    assert.match(body, /authorization received/)
    assert.equal(await cb.waitForCode(1000), 'the-code')
    assert.equal(cb.received(), 'the-code')

    // A second request does not overwrite the first code.
    await fetch(`${cb.callbackUrl}?code=second`, { redirect: 'manual' })
    assert.equal(cb.received(), 'the-code')
  } finally {
    await cb.close()
  }
})

test('waitForCode times out to undefined instead of hanging', async () => {
  const cb = await openCallback()
  try {
    assert.equal(await cb.waitForCode(50), undefined)
  } finally {
    await cb.close()
  }
})
