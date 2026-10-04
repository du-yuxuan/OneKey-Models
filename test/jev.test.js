import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUESTION_TYPES, validateQuestions } from '../src/jev.js'

test('QUESTION_TYPES matches SystemOne', () => {
  assert.deepEqual(QUESTION_TYPES, ['noul', 'choice', 'score'])
})

test('a valid question set passes', () => {
  const result = validateQuestions({
    flag: { type: 'noul', instructions: 'Is this true?' },
    pick: { type: 'choice', instructions: 'Choose one', criteria: ['a', 'b'] },
    grade: { type: 'score', instructions: 'Score it', criteria: ['low', 'high'] },
  })
  assert.deepEqual(result, { ok: true })
})

test('malformed question sets are rejected with an actionable message', () => {
  assert.equal(validateQuestions(null).ok, false)
  assert.equal(validateQuestions('nope').ok, false)
  assert.match(validateQuestions({}).error, /at least one question/)
  assert.match(validateQuestions({ 'bad name': { type: 'noul', instructions: 'x' } }).error, /POSIX identifier/)
  assert.match(validateQuestions({ q: { type: 'noul' } }).error, /non-empty instructions/)
  assert.deepEqual(validateQuestions({ q: { type: 'noul', instructions: 'x' } }), { ok: true })
  assert.match(validateQuestions({ q: { type: 'mystery', instructions: 'x' } }).error, /unsupported type "mystery"/)
  assert.match(validateQuestions({ q: { type: 'choice', instructions: 'x' } }).error, /needs criteria/)
  assert.match(validateQuestions({ q: { type: 'score', instructions: 'x', criteria: 'high' } }).error, /ordered criteria/)
})

test('askTyped sends a non-null state so the gateway never 422s', async () => {
  const { createServer } = await import('node:http')
  const seen = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      seen.push({ url: req.url, body: JSON.parse(raw) })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ answers: { q1: { type: 'noul', noul: 0.9 } } }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    const { askTyped } = await import('../src/jev.js')
    const out = await askTyped({
      baseURL: `http://127.0.0.1:${port}/v1`,
      key: 'sk-test',
      model: 'ateve-jev-v1',
      questions: { q1: { type: 'noul', instructions: 'Is the sky blue?' } },
      timeoutMs: 5_000,
    })
    assert.equal(out.ok, true)
    assert.deepEqual(out.answers, { q1: { type: 'noul', noul: 0.9 } })
    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, '/typesafe/v1/systemone')
    assert.deepEqual(seen[0].body.state, {})

    // an explicit state is passed through untouched
    await askTyped({
      baseURL: `http://127.0.0.1:${port}/v1`,
      key: 'sk-test',
      model: 'ateve-jev-v1',
      questions: { q1: { type: 'noul', instructions: 'Is the sky blue?' } },
      state: 'conversation-7',
      timeoutMs: 5_000,
    })
    assert.equal(seen[1].body.state, 'conversation-7')
  } finally {
    server.close()
  }
})
