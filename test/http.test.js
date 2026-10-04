import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import {
  RECOVERY_HEADER, chatCompletion, endpoints, exchangeCode, fetchModels, request,
} from '../src/http.js'

test('endpoints splits the v1 root from the gateway root, tolerating slashes', () => {
  assert.deepEqual(endpoints('https://tokendance.space/gateway/v1'), {
    gateway: 'https://tokendance.space/gateway',
    v1: 'https://tokendance.space/gateway/v1',
  })
  assert.deepEqual(endpoints('https://tokendance.space/gateway/v1///'), {
    gateway: 'https://tokendance.space/gateway',
    v1: 'https://tokendance.space/gateway/v1',
  })
  // Anthropic-native endpoints live off the gateway root.
  const { gateway } = endpoints('https://x.example/gateway/v1')
  assert.equal(gateway, 'https://x.example/gateway')
})

test('RECOVERY_HEADER is the exact header TokenDance advertises', () => {
  assert.equal(RECOVERY_HEADER, 'tokendance-recovery-action')
})

// A local stand-in gateway: no external network, no key, full assertions.
const withServer = async (handler, fn) => {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(base)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('request carries the bearer key per call and normalizes the shape', async () => {
  await withServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      authorization: req.headers.authorization ?? null,
      contentType: req.headers['content-type'] ?? null,
      method: req.method,
    }))
  }, async (base) => {
    const withKey = await request(`${base}/ping`, { key: 'sk-test', method: 'POST', body: { a: 1 } })
    assert.equal(withKey.ok, true)
    assert.equal(withKey.status, 200)
    assert.equal(withKey.data.authorization, 'Bearer sk-test')
    assert.equal(withKey.data.contentType, 'application/json')
    assert.equal(withKey.data.method, 'POST')

    const anonymous = await request(`${base}/ping`)
    assert.equal(anonymous.ok, true)
    assert.equal(anonymous.data.authorization, null)
  })
})

test('request surfaces the recovery header on a rejected call', async () => {
  await withServer((req, res) => {
    res.statusCode = 401
    res.setHeader(RECOVERY_HEADER, 'reauthorize_api_key')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: { message: 'key rejected' } }))
  }, async (base) => {
    const result = await request(`${base}/v1/chat`, { key: 'sk-bad' })
    assert.equal(result.ok, false)
    assert.equal(result.status, 401)
    assert.equal(result.error, 'key rejected')
    assert.equal(result.recovery, 'reauthorize_api_key')
  })
})

test('a network failure normalizes to status 0, never throws', async () => {
  const result = await request('http://127.0.0.1:1/nope', { timeoutMs: 2000 })
  assert.equal(result.ok, false)
  assert.equal(result.status, 0)
  assert.equal(typeof result.error, 'string')
})

test('fetchModels reads the data envelope anonymously', async () => {
  await withServer((req, res) => {
    assert.equal(req.headers.authorization, undefined)
    assert.equal(req.url, '/gateway/v1/models')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }] }))
  }, async (base) => {
    const result = await fetchModels(`${base}/gateway/v1`)
    assert.equal(result.ok, true)
    assert.deepEqual(result.models.map((m) => m.id), ['m1', 'm2'])
  })
})

test('fetchModels also accepts a bare array body', async () => {
  await withServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify([{ id: 'only' }]))
  }, async (base) => {
    const result = await fetchModels(base)
    assert.equal(result.ok, true)
    assert.equal(result.models.length, 1)
  })
})

test('exchangeCode posts the verifier and returns the one-shot key', async () => {
  await withServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const body = JSON.parse(raw)
      res.setHeader('content-type', 'application/json')
      if (body.code !== 'good' || body.code_challenge_method !== 'S256') {
        res.statusCode = 400
        res.end(JSON.stringify({ message: 'bad exchange' }))
        return
      }
      res.end(JSON.stringify({ key: 'sk-from-oauth' }))
    })
  }, async (base) => {
    const ok = await exchangeCode(`${base}/`, { code: 'good', codeVerifier: 'verifier' })
    assert.deepEqual(ok, { ok: true, status: 200, key: 'sk-from-oauth' })

    const rejected = await exchangeCode(base, { code: 'bad', codeVerifier: 'verifier' })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error, 'bad exchange')

    // Success without a key is a failure, not a silent undefined key.
    const noKey = await withServerSecond(base)
    assert.equal(noKey.ok, false)
    assert.equal(noKey.error, 'authorization response carried no key')
  })
})

// Tiny helper: exchange endpoint that answers 200 with no key at all.
const withServerSecond = async (base) => {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end('{}')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    return await exchangeCode(`http://127.0.0.1:${server.address().port}`, { code: 'c', codeVerifier: 'v' })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('chatCompletion extracts the first message and passes max_tokens', async () => {
  await withServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const body = JSON.parse(raw)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        choices: [{ message: { content: `echo:${body.model}:${body.max_tokens}` } }],
      }))
    })
  }, async (base) => {
    const result = await chatCompletion(`${base}/gateway/v1`, {
      key: 'sk-test',
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 128,
    })
    assert.equal(result.ok, true)
    assert.equal(result.text, 'echo:deepseek-v4-pro:128')
  })
})

test('chatCompletion with a malformed body yields text undefined, not a throw', async () => {
  await withServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ choices: [] }))
  }, async (base) => {
    const result = await chatCompletion(base, { key: 'k', model: 'm', messages: [] })
    assert.equal(result.ok, true)
    assert.equal(result.text, undefined)
  })
})
