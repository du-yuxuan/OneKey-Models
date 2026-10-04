#!/usr/bin/env node
/**
 * One-shot interactive OAuth test (mirrors index.js beginAuth/finishAuth).
 *
 * Prints the authorization URL for a browser to open, waits for the loopback
 * redirect, exchanges the code, and stores the resulting key in a 0600 temp
 * file that capability tests read from `TOKENDANCE_KEY_FILE`. The key itself is
 * never printed, never logged, and never written into the repository.
 *
 * Usage: node scripts/oauth-once.mjs   (Ctrl-C / SIGTERM abandons cleanly)
 */
import { chmodSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authorizationUrl, createPkce, openCallback } from '../src/oauth.js'
import { exchangeCode } from '../src/http.js'

const AUTH_ORIGIN = process.env.TOKENDANCE_AUTH_ORIGIN ?? 'https://tokendance.space'
const APP_URL = process.env.TOKENDANCE_APP_URL ?? 'https://github.com/du-yuxuan/OneKey-Models'
const KEY_NAME = process.env.TOKENDANCE_KEY_NAME ?? 'DeepSeek Harness (OneKey-Models)'
const KEY_FILE = process.env.TOKENDANCE_KEY_FILE ?? join(tmpdir(), 'tokendance-e2e.key')

const pkce = createPkce()
const callback = await openCallback()
const url = authorizationUrl({
  authOrigin: AUTH_ORIGIN,
  challenge: pkce.challenge,
  appUrl: APP_URL,
  keyName: KEY_NAME,
  callbackUrl: callback.callbackUrl,
})

// The URL carries only the public challenge — safe to show.
console.log(`AUTH_URL=${url}`)
console.log(`CALLBACK=${callback.callbackUrl}`)

let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  await callback.close()
}
process.on('SIGTERM', () => { void shutdown().then(() => process.exit(1)) })
process.on('SIGINT', () => { void shutdown().then(() => process.exit(1)) })

const code = await callback.waitForCode(300_000)
await shutdown()
if (code === undefined || code === '') {
  console.error('FAIL=no-code (300s timeout or empty code)')
  process.exit(2)
}
console.log(`CODE_ARRIVED=yes (len=${code.length})`)

const exchanged = await exchangeCode(AUTH_ORIGIN, { code, codeVerifier: pkce.verifier })
if (!exchanged.ok || typeof exchanged.key !== 'string' || exchanged.key === '') {
  console.error(`FAIL=exchange status=${exchanged.status} error=${exchanged.error ?? ''}`)
  process.exit(3)
}
writeFileSync(KEY_FILE, exchanged.key, { mode: 0o600 })
chmodSync(KEY_FILE, 0o600)
// Only a masked fingerprint — the key itself never reaches the terminal.
console.log(`KEY_STORED=${KEY_FILE} prefix=${exchanged.key.slice(0, 6)}… len=${exposedLength(exchanged.key)}`)

function exposedLength(key) {
  return key.length
}
