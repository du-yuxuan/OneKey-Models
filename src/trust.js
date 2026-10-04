/**
 * Trust fence for the plugin's own `/api/onekey-models` routes.
 *
 * The kernel registers shorter prefixes under `/api`; ours is longer, so
 * longest-prefix wins and the kernel's own fence no longer guards these routes.
 * That makes this file mandatory rather than decorative: without it any web page
 * could drive the user's TokenDance key.
 *
 * Two layers, in the same order dsh-our-free-model uses them: prefer the
 * connection service's own admission verdict, and when it is absent fall back to
 * a structural check (loopback host, no cross-site fetch, origin/referer matching
 * the Host header).
 *
 * @module src/trust.js
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Is this Host header value a loopback authority?
 *
 * @param {string | undefined} value
 * @returns {boolean}
 */
export function isLoopbackHost(value) {
  if (typeof value !== 'string' || value === '') return false
  const authority = authorityOf(value, 'http')
  if (authority === undefined) return false
  return LOOPBACK_HOSTS.has(authority.hostname.toLowerCase())
}

/**
 * Decide whether a request may be served.
 *
 * @param {{headers?: Record<string, string | string[] | undefined>, method?: string, url?: string}} req
 * @param {{admit?: (req: unknown) => {rejection?: {status: number, reason?: string}} | undefined} | undefined} [connection]
 * @returns {{status: number, reason: string} | undefined} `undefined` means admitted
 */
export function rejectionFor(req, connection) {
  // Layer 1: the harness connection service knows the real admission state.
  try {
    const admission = connection?.admit?.(req)
    const rejection = admission?.rejection
    if (rejection !== undefined && rejection !== null) {
      return {
        status: Number(rejection.status) || 403,
        reason: rejection.reason ?? 'forbidden by connection policy',
      }
    }
  } catch {
    // An absent or throwing connection service is not a rejection; fall through
    // to the structural check rather than failing open without one.
  }
  // Layer 2: structural reconstruction.
  return structuralRejection(req)
}

function structuralRejection(req) {
  const headers = req?.headers ?? {}
  const host = header(headers, 'host')
  if (!isLoopbackHost(host)) return { status: 403, reason: 'non-loopback host' }
  if (header(headers, 'sec-fetch-site') === 'cross-site') {
    return { status: 403, reason: 'cross-site request' }
  }
  const authority = authorityOf(host, 'http')
  for (const field of ['origin', 'referer']) {
    const value = header(headers, field)
    if (value === undefined || value === '') continue
    const other = authorityOf(value, authority?.protocol ?? 'http')
    if (other === undefined || authority === undefined) return { status: 403, reason: `bad ${field}` }
    if (other.origin !== authority.origin) return { status: 403, reason: `${field} does not match host` }
  }
  return undefined
}

function header(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : undefined
}

/** Parse an authority or URL into a comparable `{origin, hostname, protocol}`. */
function authorityOf(value, defaultScheme) {
  try {
    const url = new URL(value.includes('://') ? value : `${defaultScheme}://${value}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return { origin: url.origin, hostname: url.hostname, protocol: url.protocol }
  } catch {
    // A bare `::1` fails the prefix form (`http://::1`); bracket it and retry once.
    if (value.includes('://')) return undefined
    try {
      const url = new URL(`${defaultScheme}://[${value}]`)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
      return { origin: url.origin, hostname: url.hostname, protocol: url.protocol }
    } catch {
      return undefined
    }
  }
}