/**
 * Jev typed decisions over TokenDance's TypeSafe SystemOne protocol.
 *
 * Jev is not a chat protocol and cannot be routed through pi-ai: SystemOne
 * takes a structured question set and returns typed answers (a boolean with a
 * probability, one choice from a set, a score on an ordered scale). That is why
 * this plugin ships its own client instead of a model profile — a chat adapter
 * would have to invent a protocol it does not have.
 *
 * The request shape is fixed by the endpoint: `{model, state, questions}` where
 * each question is `{type, instructions, criteria?}` keyed by a name the model
 * answers under.
 *
 * @module src/jev.js
 */
import { endpoints, request } from './http.js'

/** Question kinds SystemOne accepts. */
export const QUESTION_TYPES = ['noul', 'choice', 'score']

/**
 * Validate a question set before it leaves the process.
 *
 * A malformed question is rejected by the gateway with an opaque error, which
 * for the agent looks like a broken tool. Catching it here turns that into a
 * message the caller can act on.
 *
 * @param {Record<string, {type: string, instructions: string}>} questions
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateQuestions(questions) {
  if (questions === null || typeof questions !== 'object') return { ok: false, error: 'questions must be an object' }
  const entries = Object.entries(questions)
  if (entries.length === 0) return { ok: false, error: 'at least one question is required' }
  for (const [name, question] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return { ok: false, error: `question name "${name}" is not a POSIX identifier` }
    }
    if (typeof question?.instructions !== 'string' || question.instructions === '') {
      return { ok: false, error: `question "${name}" needs non-empty instructions` }
    }
    if (!QUESTION_TYPES.includes(question?.type)) {
      return { ok: false, error: `question "${name}" has unsupported type "${question?.type}"` }
    }
    if (question.type === 'choice' && (question.criteria === undefined || question.criteria === null)) {
      return { ok: false, error: `question "${name}" is a choice and needs criteria options` }
    }
    if (question.type === 'score' && !Array.isArray(question.criteria)) {
      return { ok: false, error: `question "${name}" is a score and needs an ordered criteria list` }
    }
  }
  return { ok: true }
}

/**
 * Ask one model a set of typed questions.
 *
 * @param {object} options
 * @param {string} options.baseURL
 * @param {string} options.key
 * @param {string} options.model - e.g. `bocha-jev-v1`
 * @param {Record<string, object>} options.questions
 * @param {string|object} [options.state] - opaque context (server requires a string/dict/list, never null); defaults to `{}`
 * @param {string} [options.appUrl]
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ok: boolean, status: number, answers?: object, error?: string}>}
 */
export async function askTyped(options) {
  const valid = validateQuestions(options.questions)
  if (!valid.ok) return { ok: false, status: 0, error: valid.error }
  const { gateway } = endpoints(options.baseURL)
  const headers = options.appUrl === undefined ? {} : { 'x-app-url': options.appUrl }
  const result = await request(`${gateway}/typesafe/v1/systemone`, {
    method: 'POST',
    key: options.key,
    headers,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    body: {
      model: options.model,
      ...(options.state === undefined || options.state === null ? { state: {} } : { state: options.state }),
      questions: options.questions,
    },
  })
  if (!result.ok) return result
  const answers = result.data?.answers ?? result.data?.result ?? result.data?.data
  return { ...result, answers: isObject(answers) ? answers : undefined }
}

/** Catalog models that speak SystemOne, for the UI to offer them. */
export function jevModels(catalog) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter((model) => Array.isArray(model?.capabilities) && model.capabilities.includes('jev'))
    .map((model) => ({ id: model.id, name: model.name }))
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}