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
