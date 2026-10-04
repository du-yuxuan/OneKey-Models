/**
 * OAuth authorization with PKCE.
 *
 * TokenDance's flow is the standard public-client one: the browser authorizes,
 * a short-lived single-use code comes back, and the code is exchanged for the
 * key. Headless is the interesting case — omit `callback_url` and the page
 * renders the code itself, valid for 10 minutes, instead of redirecting.
 *
 * This module owns only the *cryptographic* half: verifier generation, the S256
 * challenge, the authorization URL and the loopback listener. Deciding when to
 * navigate a browser, and typing the code in, is the caller's business — that is
 * how the same code serves the in-app flow and a headless one.
 *
 * Nothing here logs the verifier, the code or the key.
 *
 * @module src/oauth.js
 */
import { createHash, randomUUID } from 'node:crypto'

/**
 * Create a PKCE verifier and its S256 challenge.
 *
 * Two UUIDs give 72 characters of randomness, comfortably inside RFC 7636's
 * 43–128 window, and the alphabet (`0-9a-f-`) is within the permitted set.
 *
 * @returns {{verifier: string, challenge: string, challengeMethod: 'S256'}}
 */
export function createPkce() {
  const verifier = `${randomUUID()}${randomUUID()}`
  return {
    verifier,
    challenge: base64url(createHash('sha256').update(verifier, 'ascii').digest()),
    challengeMethod: 'S256',
  }
}

/**
 * Build the authorization URL.
 *
 * @param {object} params
 * @param {string} params.authOrigin - e.g. `https://tokendance.space`
 * @param {string} params.challenge - the S256 challenge
 * @param {string} params.appUrl - **stable** app URL for call attribution
 * @param {string} params.keyName - label shown on the authorization screen
 * @param {string} [params.callbackUrl] - omit for the headless, code-on-page flow
 * @returns {string}
 */
export function authorizationUrl(params) {
  const url = new URL(`${params.authOrigin.replace(/\/+$/, '')}/auth`)
  if (params.callbackUrl !== undefined && params.callbackUrl !== '') {
    url.searchParams.set('callback_url', params.callbackUrl)
  }
  url.searchParams.set('code_challenge', params.challenge)
  // S256 only: a plaintext challenge is rejected with 400, and a headless
  // request without a challenge is rejected outright.
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('app_url', params.appUrl)
  if (params.keyName !== undefined) url.searchParams.set('key_name', params.keyName)
  return url.toString()
}

/**
 * Reserve a loopback port, and a matching callback URL that also captures code.
 *
 * Any port is accepted, so the listener binds port 0 and reports back the port
 * the OS actually granted — there is no port to guess and none to collide.
 *
 * The captured code is what makes the flow one click: the browser signs in, the
 * redirect lands here, and the caller can exchange without the user ever copying
 * a string. `waitForCode` is what turns that redirect into a promise.
 *
 * @returns {Promise<{origin: string, callbackUrl: string, received: () => string | undefined,
 *   waitForCode: (timeoutMs?: number) => Promise<string | undefined>,
 *   close: () => Promise<void>}>}
 */
export async function openCallback() {
  const { createServer } = await import('node:http')
  let code
  let settle
  const arrived = new Promise((resolve) => { settle = resolve })
  const server = createServer((req, res) => {
    const found = codeFromRequest(req?.url)
    if (found !== undefined && code === undefined) {
      code = found
      settle(found)
    }
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(code === undefined
      ? 'OneKey-Models: no authorization code in this request.'
      : 'OneKey-Models: authorization received. You can close this tab.')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  const origin = `http://127.0.0.1:${port}`
  return {
    origin,
    callbackUrl: `${origin}/callback`,
    received: () => code,
    waitForCode: (timeoutMs = 600_000) => Promise.race([
      arrived,
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve(undefined), timeoutMs)
        timer.unref?.()
      }),
    ]),
    close: () => new Promise((resolve) => { settle(undefined); server.close(() => resolve(undefined)) }),
  }
}

function codeFromRequest(url) {
  try {
    return new URL(url ?? '/', 'http://127.0.0.1').searchParams.get('code') ?? undefined
  } catch {
    return undefined
  }
}

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}