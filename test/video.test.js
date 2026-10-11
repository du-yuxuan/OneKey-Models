import test from 'node:test'
import assert from 'node:assert/strict'

import { videoProtocolOf, generateVideo } from '../src/video.js'

const BASE = 'https://tokendance.space/gateway/v1'

/** Answer one request with a JSON text body, the way the real gateway does. */
function jsonResponse(body, { ok = true, status = 200, headers = {} } = {}) {
  return { ok, status, headers: new Map(Object.entries(headers)), text: async () => JSON.stringify(body) }
}

/** Capture every call and answer from a handler, returning the log. */
function stubFetch(handler) {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const entry = { url: String(url), method: options.method ?? 'GET', body: JSON.parse(options.body ?? 'null'), headers: options.headers ?? {} }
    calls.push(entry)
    return handler(entry)
  }
  return calls
}

test('videoProtocolOf prefers text-to-video, then image-to-video only with an image', () => {
  const model = { id: 'k', protocols: ['kling:text2video', 'kling:image2video'] }
  assert.equal(videoProtocolOf(model), 'kling:text2video')
  assert.equal(videoProtocolOf(model, { withImage: true }), 'kling:image2video')
})

test('videoProtocolOf never answers omni-video when an image is present', () => {
  // No documented image content type for omni here, so the i2v route wins.
  const model = { id: 'k', protocols: ['kling:omni-video', 'kling:image2video'] }
  assert.equal(videoProtocolOf(model, { withImage: true }), 'kling:image2video')
})

test('videoProtocolOf is undefined for a model without a video protocol', () => {
  assert.equal(videoProtocolOf({ id: 'x', protocols: ['openai:chat-completions'] }), undefined)
  assert.equal(videoProtocolOf(undefined), undefined)
})

test('generateVideo submits and polls the minimax route', async () => {
  const calls = stubFetch((entry) => (entry.method === 'POST'
    ? jsonResponse({ task: { task_id: 'tk-1' } })
    : jsonResponse({ task: { status: 'Running' } })))
  const first = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'minimax-video-01', prompt: 'a whale', protocol: 'minimax:video_generation_v2',
    timeoutMs: 20, pollIntervalMs: 1,
  })
  assert.equal(first.ok, false)
  assert.equal(first.pending, true)
  assert.equal(first.taskId, 'tk-1')

  const resumed = stubFetch((entry) => (entry.method === 'POST'
    ? jsonResponse({ task: { task_id: 'should-not-be-used' } })
    : jsonResponse({ task: { status: 'Succeed', content: { url: 'https://cdn/v.mp4' } } })))
  const second = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'minimax-video-01', protocol: 'minimax:video_generation_v2',
    taskId: 'tk-1', timeoutMs: 5_000, pollIntervalMs: 1,
  })
  assert.equal(second.ok, true)
  assert.equal(second.video.url, 'https://cdn/v.mp4')
  assert.equal(resumed.length, 1)
  assert.equal(resumed[0].method, 'GET')
})

test('generateVideo maps the kling routes onto their own endpoints', async () => {
  const posts = []
  stubFetch((entry) => {
    posts.push(entry)
    if (entry.method === 'POST') return jsonResponse({ data: { id: 'kl-9' } })
    return jsonResponse({ data: [{ task_status: 'succeed', outputs: [{ type: 'video', url: 'https://cdn/kl.mp4' }] }] })
  })
  const result = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'kling-v1', prompt: 'a whale', protocol: 'kling:image2video',
    imageUrls: ['https://x/first.png'], timeoutMs: 5_000, pollIntervalMs: 1,
  })
  assert.equal(result.ok, true)
  assert.equal(result.video.url, 'https://cdn/kl.mp4')
  assert.equal(posts.length, 2)
  assert.match(posts[0].url, /\/gateway\/kling\/v1\/image2video$/)
  assert.deepEqual(posts[0].body.contents[1], { type: 'first_frame', url: 'https://x/first.png' })
  assert.match(posts[1].url, /\/gateway\/kling\/v1\/image2video\/kl-9$/)
})

test('generateVideo answers a seedance task with a bare array poll body too', async () => {
  stubFetch((entry) => {
    if (entry.method === 'POST') return jsonResponse({ id: 'sd-1' })
    // Some gateway answers drop the {data: [...]} wrapper.
    return jsonResponse([{ status: 'succeeded', content: { video_url: 'https://cdn/sd.mp4' } }])
  })
  const result = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'seedance-1', prompt: 'a whale', protocol: 'seedance:generations',
    timeoutMs: 5_000, pollIntervalMs: 1,
  })
  assert.equal(result.ok, true)
  assert.equal(result.video.url, 'https://cdn/sd.mp4')
})

test('generateVideo sends the DashScope async header on the happyhorse route only', async () => {
  const calls = []
  stubFetch((entry) => {
    calls.push(entry)
    if (entry.method === 'POST') return jsonResponse({ output: { task_id: 'hh-1' } })
    return jsonResponse({ output: { task_status: 'SUCCEEDED', video_url: 'https://cdn/hh.mp4' } })
  })
  const ok = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'hh-1', prompt: 'a whale', protocol: 'happyhorse:video-synthesis',
    timeoutMs: 5_000, pollIntervalMs: 1,
  })
  assert.equal(ok.ok, true)
  const post = calls.find((entry) => entry.method === 'POST')
  assert.equal(post.headers['x-dashscope-async'], 'enable')

  const wanCalls = stubFetch((entry) => {
    if (entry.method === 'POST') return jsonResponse({ output: { task_id: 'w3-1' } })
    return jsonResponse({ output: { task_status: 'SUCCEEDED', video_url: 'https://cdn/w3.mp4' } })
  })
  await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'w3-1', prompt: 'a whale', protocol: 'wan3:video-synthesis',
    timeoutMs: 5_000, pollIntervalMs: 1,
  })
  const wanPost = wanCalls.find((entry) => entry.method === 'POST')
  assert.equal(wanPost.headers['x-dashscope-async'], undefined)
})

test('generateVideo reports a failed task instead of polling forever', async () => {
  stubFetch((entry) => (entry.method === 'POST'
    ? jsonResponse({ id: 'sd-2' })
    : jsonResponse({ status: 'failed' })))
  const result = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'seedance-1', prompt: 'a whale', protocol: 'seedance:generations',
    timeoutMs: 5_000, pollIntervalMs: 1,
  })
  assert.equal(result.ok, false)
  assert.equal(result.pending, undefined)
  assert.match(result.error, /failed/)
})

test('generateVideo refuses an unknown protocol instead of guessing an endpoint', async () => {
  const result = await generateVideo({
    baseURL: BASE, key: 'sk-test', model: 'x', prompt: 'a whale', protocol: 'some-future:protocol',
    timeoutMs: 5_000,
  })
  assert.equal(result.ok, false)
  assert.match(result.error, /No handler for video protocol/)
})

test('generateVideo requires a prompt when there is no task id', async () => {
  const result = await generateVideo({ baseURL: BASE, key: 'sk-test', model: 'x', protocol: 'seedance:generations' })
  assert.equal(result.ok, false)
  assert.match(result.error, /prompt is required/)
})
