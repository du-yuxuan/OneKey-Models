/**
 * Video generation.
 *
 * Video on TokenDance is never one request: every protocol family submits an
 * async task and answers "when is it done" only through its own poll endpoint
 * with its own status vocabulary. This module carries all of that so callers
 * see one shape — submit (optionally resuming a task id), poll until terminal
 * or deadline, return `{ok, video: {url}}` or a refusal.
 *
 * The protocol decides the endpoint and the body, exactly as in image.js.
 * Nothing here guesses from the model name: the catalog's advertised
 * `supported_protocols` is the only input, and a protocol without a handler
 * here fails loudly with the documentation link instead of a wrong POST.
 *
 * Documented shapes (TokenDance docs, 2026-10):
 *   seedance:generations    POST /ark/v3/generations/tasks      GET /ark/v3/generations/tasks/{id}
 *                           body {model, content[], resolution, ratio, duration}
 *                           done → status 'succeeded', content.video_url
 *   kling:text2video        POST /kling/v1/text2video           GET /kling/v1/text2video/{id}
 *                           body {model_name, prompt, settings{resolution,duration,aspect_ratio}}
 *   kling:image2video       POST /kling/v1/image2video          contents [{type:'prompt'|'first_frame', ...}]
 *   kling:omni-video        POST /kling/v1/omni-video           contents [{type:'prompt', ...}] (prompt-only here)
 *                           kling done → data[0].outputs[] item type 'video'; failure via task_status
 *   minimax:video_generation_v2 POST /minimax/v2/video_generation
 *                           GET /minimax/v2/query/video_generation/{id}
 *                           done → task.status 'succeeded', task.content.url
 *   wan3:video-synthesis    POST /alibaba/wan3/v1/video-synthesis
 *                           GET /alibaba/wan3/v1/tasks/{id}
 *                           done → output.task_status 'SUCCEEDED', output.video_url
 *                           NOTE: no idempotency key — a timed-out POST must NOT be retried
 *   happyhorse:video-synthesis POST /alibaba/happyhorse/v1/video-synthesis
 *                           GET /alibaba/happyhorse/v1/tasks/{id}
 *                           done → output.video_url
 *
 * Every result URL is valid for 24 hours — say so to the caller, not here.
 *
 * @module src/video.js
 */
import { endpoints, request } from './http.js'

/** Documentation home for every video protocol, quoted in refusals. */
const PROTOCOL_DOCS = 'https://tokendance.space/docs/multi-protocol.md'

/** Video protocols this module implements, in preference order. */
const HANDLED = [
  'seedance:generations',
  'kling:text2video',
  'kling:image2video',
  'kling:omni-video',
  'minimax:video_generation_v2',
  'wan3:video-synthesis',
  'happyhorse:video-synthesis',
]

/**
 * Which video protocol a catalog model speaks.
 *
 * Preference order matters only when a model advertises several: text-to-video
 * first (always safe), image-to-video only when the caller actually has an
 * image, omni last because this module does not yet pass images to it.
 *
 * @param {{id: string, protocols?: string[]}} model
 * @param {{withImage?: boolean}} [options]
 * @returns {string | undefined}
 */
export function videoProtocolOf(model, options = {}) {
  const protocols = Array.isArray(model?.protocols) ? model.protocols : []
  const video = HANDLED.filter((protocol) => protocols.includes(protocol))
  if (video.length === 0) return undefined
  if (options.withImage === true) {
    // A kling t2v endpoint rejects image payloads; the i2v one is the answer.
    const imageCapable = video.filter((protocol) => protocol !== 'kling:text2video')
    const pick = imageCapable.find((protocol) => protocol !== 'kling:omni-video') ?? imageCapable[0]
    return pick
  }
  return video.find((protocol) => protocol !== 'kling:image2video') ?? video[0]
}

/** Frame roles shared by the content-array protocols. */
function frameRoles(count) {
  if (count <= 1) return ['first_frame']
  if (count === 2) return ['first_frame', 'last_frame']
  return Array.from({ length: count }, () => 'reference_image')
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}

const FAILED = /^(failed|fail|cancelled|canceled|expired|error)/i

/**
 * Submit one video task and poll it to completion.
 *
 * @param {object} options
 * @param {string} options.baseURL
 * @param {string} options.key
 * @param {string} options.model
 * @param {string} [options.prompt] - required on submit, ignored on resume
 * @param {string} options.protocol - from videoProtocolOf; also selects the poll route on resume
 * @param {string[]} [options.imageUrls] - public URLs (first/last frame, then reference)
 * @param {number} [options.duration] - seconds
 * @param {string} [options.resolution] - protocol vocabulary: 480p/720p/1080p or 768P/720P
 * @param {string} [options.ratio] - e.g. 16:9 / adaptive
 * @param {string} [options.taskId] - resume: skip submit, poll only
 * @param {string} [options.appUrl]
 * @param {number} [options.timeoutMs] - overall deadline for submit + polling (default 180s)
 * @param {number} [options.pollIntervalMs] - gap between polls (default 5s)
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ok: boolean, status: number, taskId?: string, video?: {url: string}, error?: string, recovery?: string, pending?: boolean}>}
 */
export async function generateVideo(options) {
  const { gateway } = endpoints(options.baseURL)
  const headers = options.appUrl === undefined ? {} : { 'x-app-url': options.appUrl }
  const signal = options.signal
  const timeoutMs = options.timeoutMs ?? 180_000
  const deadline = Date.now() + timeoutMs
  const images = options.imageUrls ?? []

  let taskId = options.taskId
  if (taskId === undefined) {
    if (options.prompt === undefined || options.prompt === '') {
      return { ok: false, status: 0, error: 'prompt is required to submit a video task' }
    }
    const submitted = await submit(options, { gateway, headers, images })
    if (!submitted.ok) return submitted
    taskId = submitted.taskId
    if (submitted.video !== undefined) return submitted // some routes answer synchronously
  }

  const requestTimeout = () => Math.max(10_000, Math.min(60_000, deadline - Date.now()))
  while (Date.now() < deadline) {
    const polled = await pollOnce(options, { gateway, headers, taskId, timeoutMs: requestTimeout() })
    if (polled.done === true) {
      if (polled.video !== undefined) return { ok: true, status: 200, taskId, video: polled.video }
      if (polled.failed === true) {
        return { ok: false, status: 200, taskId, error: polled.error ?? 'video task failed' }
      }
    }
    await sleep(options.pollIntervalMs ?? 5_000, signal)
    if (signal?.aborted === true) {
      return { ok: false, status: 0, taskId, pending: true, error: 'aborted while polling; the task keeps running — resume with taskId' }
    }
  }
  return { ok: false, status: 0, taskId, pending: true, error: `not finished within ${timeoutMs}ms — resume with taskId ${taskId}` }
}

/** POST the task. A transport-level failure is reported, never retried (wan3 warns about double billing). */
async function submit(options, ctx) {
  const { gateway, headers, images } = ctx
  const base = {
    key: options.key,
    headers,
    timeoutMs: Math.max(30_000, options.timeoutMs ?? 180_000),
    signal: options.signal,
  }

  switch (options.protocol) {
    case 'seedance:generations': {
      const roles = frameRoles(images.length)
      const content = [{ type: 'text', text: options.prompt }]
      images.forEach((url, index) => content.push({ type: 'image_url', image_url: { url }, role: roles[index] }))
      const reference = images.length > 2
      const result = await request(`${gateway}/ark/v3/generations/tasks`, {
        ...base,
        method: 'POST',
        body: {
          model: options.model,
          content,
          resolution: options.resolution ?? '720p',
          ratio: options.ratio ?? (reference ? 'adaptive' : '16:9'),
          duration: options.duration ?? (reference ? -1 : 5),
          ...(reference ? { omni_reference_task_type: 'reference' } : {}),
        },
      })
      if (!result.ok) return result
      return { ok: true, status: 200, taskId: String(result.data?.id ?? '') }
    }

    case 'kling:text2video': {
      const result = await request(`${gateway}/kling/v1/text2video`, {
        ...base,
        method: 'POST',
        body: {
          model_name: options.model,
          prompt: options.prompt,
          settings: {
            resolution: options.resolution ?? '720p',
            duration: options.duration ?? 5,
            aspect_ratio: options.ratio ?? '16:9',
          },
        },
      })
      if (!result.ok) return result
      return { ok: true, status: 200, taskId: String(result.data?.data?.id ?? result.data?.id ?? '') }
    }

    case 'kling:image2video': {
      if (images.length === 0) return { ok: false, status: 0, error: 'kling:image2video needs an image URL' }
      const contents = [{ type: 'prompt', text: options.prompt }, { type: 'first_frame', url: images[0] }]
      if (images[1] !== undefined) contents.push({ type: 'last_frame', url: images[1] })
      const result = await request(`${gateway}/kling/v1/image2video`, {
        ...base,
        method: 'POST',
        body: {
          model_name: options.model,
          contents,
          settings: {
            resolution: options.resolution ?? '720p',
            duration: options.duration ?? 5,
            ...(options.ratio === undefined ? {} : { aspect_ratio: options.ratio }),
          },
        },
      })
      if (!result.ok) return result
      return { ok: true, status: 200, taskId: String(result.data?.data?.id ?? result.data?.id ?? '') }
    }

    case 'kling:omni-video': {
      if (images.length > 0) {
        // No documented image content type for omni here — refuse rather than guess.
        return { ok: false, status: 0, error: 'kling:omni-video is prompt-only in this plugin; pick kling:text2video / kling:image2video for this model, or drop the image' }
      }
      const result = await request(`${gateway}/kling/v1/omni-video`, {
        ...base,
        method: 'POST',
        body: {
          model_name: options.model,
          contents: [{ type: 'prompt', text: options.prompt }],
          settings: {
            resolution: options.resolution ?? '720p',
            duration: options.duration ?? 5,
            ...(options.ratio === undefined ? {} : { aspect_ratio: options.ratio }),
          },
        },
      })
      if (!result.ok) return result
      return { ok: true, status: 200, taskId: String(result.data?.data?.id ?? result.data?.id ?? '') }
    }

    case 'minimax:video_generation_v2': {
      const roles = frameRoles(images.length)
      const content = [{ type: 'text', text: options.prompt }]
      images.forEach((url, index) => content.push({ type: 'image_url', image_url: { url }, role: roles[index] }))
      const result = await request(`${gateway}/minimax/v2/video_generation`, {
        ...base,
        method: 'POST',
        body: {
          model: options.model,
          content,
          resolution: options.resolution ?? '768P',
          duration: options.duration ?? 6,
          // Text-to-video requires a concrete ratio; with images the frame decides it.
          ...(images.length === 0 ? { ratio: options.ratio ?? '16:9' } : {}),
        },
      })
      if (!result.ok) return result
      return { ok: true, status: 200, taskId: String(result.data?.task?.task_id ?? result.data?.task_id ?? '') }
    }

    case 'wan3:video-synthesis':
    case 'happyhorse:video-synthesis': {
      const alibaba = options.protocol === 'wan3:video-synthesis'
      const roles = frameRoles(images.length)
      const media = images.map((url, index) => ({ type: roles[index], url }))
      const reference = images.length > 2
      const result = await request(`${gateway}/${alibaba ? 'alibaba/wan3/v1' : 'alibaba/happyhorse/v1'}/video-synthesis`, {
        ...base,
        method: 'POST',
        ...alibaba ? {} : { headers: { ...headers, 'x-dashscope-async': 'enable' } },
        body: {
          model: options.model,
          input: { prompt: options.prompt, ...(media.length === 0 ? {} : { media }) },
          parameters: {
            resolution: options.resolution ?? '720P',
            duration: options.duration ?? 5,
            ...(images.length === 0 ? { ratio: options.ratio ?? '16:9' } : {}),
            ...(alibaba ? { audio: false, watermark: false } : {}),
            ...(reference ? { prompt_extend: true } : {}),
          },
        },
      })
      if (!result.ok) return result
      const data = result.data ?? {}
      const taskId = data.output?.task_id ?? data.data?.output?.task_id ?? data.task_id ?? data.data?.task_id
      if (taskId === undefined) return { ok: false, status: result.status, error: 'TokenDance returned no task id' }
      return { ok: true, status: 200, taskId: String(taskId) }
    }

    default:
      return { ok: false, status: 0, error: `No handler for video protocol ${options.protocol} — see ${PROTOCOL_DOCS}` }
  }
}

/** One poll against the protocol's own endpoint. `done` false means still running. */
async function pollOnce(options, ctx) {
  const { gateway, headers, taskId, timeoutMs } = ctx
  const base = { key: options.key, headers, timeoutMs, signal: options.signal }

  switch (options.protocol) {
    case 'seedance:generations': {
      const result = await request(`${gateway}/ark/v3/generations/tasks/${taskId}`, base)
      if (!result.ok) return { done: false }
      // {status, content} directly, or the same fields one level down inside an array.
      const payload = Array.isArray(result.data) ? result.data[0] : result.data
      const status = String(payload?.status ?? '')
      const url = payload?.content?.video_url
      if (typeof url === 'string' && url !== '') return { done: true, video: { url } }
      if (FAILED.test(status)) return { done: true, failed: true, error: `seedance task ${status}` }
      return { done: false }
    }

    case 'kling:text2video':
    case 'kling:image2video':
    case 'kling:omni-video': {
      const route = { 'kling:text2video': 'text2video', 'kling:image2video': 'image2video', 'kling:omni-video': 'omni-video' }[options.protocol]
      const result = await request(`${gateway}/kling/v1/${route}/${taskId}`, base)
      if (!result.ok) return { done: false }
      // {data: [...]} per the docs, but the gateway also answers a bare array.
      const entry = Array.isArray(result.data)
        ? result.data[0]
        : Array.isArray(result.data?.data) ? result.data.data[0] : undefined
      const video = entry?.outputs?.find?.((output) => output?.type === 'video' && typeof output.url === 'string')
      if (video !== undefined) return { done: true, video: { url: video.url } }
      const status = String(entry?.task_status ?? '')
      if (FAILED.test(status)) return { done: true, failed: true, error: `kling task ${status}` }
      return { done: false }
    }

    case 'minimax:video_generation_v2': {
      const result = await request(`${gateway}/minimax/v2/query/video_generation/${taskId}`, base)
      if (!result.ok) return { done: false }
      const status = String(result.data?.task?.status ?? '')
      const url = result.data?.task?.content?.url
      if (typeof url === 'string' && url !== '') return { done: true, video: { url } }
      if (FAILED.test(status)) return { done: true, failed: true, error: `minimax task ${status}` }
      return { done: false }
    }

    case 'wan3:video-synthesis':
    case 'happyhorse:video-synthesis': {
      const alibaba = options.protocol === 'wan3:video-synthesis'
      const result = await request(`${gateway}/${alibaba ? 'alibaba/wan3/v1' : 'alibaba/happyhorse/v1'}/tasks/${taskId}`, base)
      if (!result.ok) return { done: false }
      const output = result.data?.output ?? {}
      const url = output.video_url
      if (typeof url === 'string' && url !== '') return { done: true, video: { url } }
      const status = String(output.task_status ?? '')
      if (FAILED.test(status)) return { done: true, failed: true, error: `task ${status}` }
      return { done: false }
    }

    default:
      return { done: true, failed: true, error: `No handler for video protocol ${options.protocol}` }
  }
}
