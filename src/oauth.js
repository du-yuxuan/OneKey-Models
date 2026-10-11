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
export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const trimmed = value.trim()
  // The desktop panel runs on dsh-app://, an origin no browser can navigate
  // back to. The shell registers exactly one deep link — dsh://open, which
  // focuses its primary window — so that is the whole allow-list here; exact
  // match, no prefix tricks, nothing else can ride along.
  if (trimmed === 'dsh://open' || trimmed === 'dsh://open/') return 'dsh://open'
  try {
    const url = new URL(value.trim())
    const host = url.hostname
    const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]'
    if (!loopback) return ''
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    // Origin only: the callback page is a redirector, never a deep link, so a
    // crafted returnTo cannot bounce the user anywhere but the local host.
    return url.origin
  } catch {
    return ''
  }
}

/**
 * The page the browser lands on after TokenDance redirects it back.
 *
 * Plain text used to be enough, but it left a dead tab sitting there with
 * "you can close this tab" while the panel behind it did nothing. Now the page
 * hands focus to the panel that opened it and closes itself, and falls back to
 * navigating back to the host when there is no opener to return to.
 *
 * No gradients, no dark surface: this must read the same in either theme.
 *
 * @param {string} returnTo - loopback origin of the host, the dsh://open deep
 *   link, or ''
 * @param {boolean} ok
 * @returns {string}
 */
function callbackPage(returnTo, ok) {
  const title = ok ? '授权成功' : '未收到授权码'
  const deep = returnTo.startsWith('dsh:')
  const line = ok
    ? (deep ? '授权完成，点击下方按钮打开 DeepSeek Harness。' : '正在返回 DeepSeek Harness…')
    : '请回到 TokenDance 授权页重新授权。'
  const back = returnTo
    ? `<a class="btn" id="back" href="${returnTo}">${deep ? '打开' : '返回'} DeepSeek Harness</a>`
    : ''
  const script = ok
    ? `<script>
const TO = ${JSON.stringify(returnTo)};
const hint = document.getElementById('hint');
let opener = null;
try { opener = window.opener; } catch (e) {}
if (opener && !opener.closed) {
  try { opener.focus(); } catch (e) {}
  setTimeout(function () { window.close(); }, 150);
  setTimeout(function () {
    if (hint) hint.textContent = '授权完成，已回到 DeepSeek Harness，可以关闭此标签页。';
  }, 700);
} else if (TO && !/^dsh:/.test(TO)) {
  // Deep links need a user gesture — browsers silently block scheme navigation
  // without one, so the 打开 button below carries that case instead.
  setTimeout(function () { location.replace(TO); }, 350);
}
<\/script>`
    : ''
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OneKey-Models · ${title}</title>
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; background: #fff; color: #0f1115; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
      Arial, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .card { max-width: 32em; padding: 36px 28px; text-align: center; }
  .tick { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%;
    background: ${ok ? '#0f1115' : '#e5e7eb'}; color: #fff; font-size: 26px; line-height: 56px; }
  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
  p { margin: 6px 0; }
  .hint { color: #6b7280; font-size: 13px; }
  .btn { display: inline-block; margin-top: 18px; padding: 10px 18px; border-radius: 8px;
    background: #0f1115; color: #fff; text-decoration: none; font-size: 14px; }
  .btn:hover { background: #000; }
</style></head>
<body><div class="card">
  <div class="tick">${ok ? '&#10003;' : '!'}</div>
  <h1>${title}</h1>
  <p id="hint">${line}</p>
  ${ok ? '<p class="hint">授权码已由本机自动换取并保存，无需手动复制。</p>' : ''}
  ${back}
  <noscript>OneKey-Models: authorization received. You can close this tab.</noscript>
</div>${script}</body></html>`
}

export async function openCallback(options = {}) {
  const onCode = typeof options.onCode === 'function' ? options.onCode : undefined
  const returnTo = safeReturnTo(options.returnTo)
  const { createServer } = await import('node:http')
  let code
  let settle
  let notify
  const arrived = new Promise((resolve) => { settle = resolve })
  const server = createServer((req, res) => {
    const found = codeFromRequest(req?.url)
    if (found !== undefined && code === undefined) {
      code = found
      settle(found)
      notify = found
    }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(callbackPage(returnTo, code !== undefined))
    if (notify !== undefined) {
      const value = notify
      notify = undefined
      // The response flushes first: onCode exchanges the code, and that exchange
      // closes this listener, so handing it over in the same tick would race the
      // page the user is still looking at.
      setTimeout(() => {
        try { onCode?.(value) } catch { /* the panel's own finish path still works */ }
      }, 25)
    }
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