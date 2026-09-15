import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyStandingError,
  createStandingFailureCache,
  standingBackoffMs,
  standingGenerationFromContents,
} from '../../lib/standing-failure-cache.mjs'

test('deterministic schema failure mounts once across 100 requests', async () => {
  const cache = createStandingFailureCache()
  const generation = standingGenerationFromContents('prefix missing', { mtimeMs: 1, size: 10 }, '1')
  let mounts = 0
  const mount = async () => {
    mounts += 1
    const err = new Error('$.prefix missing required value')
    err.code = 'agent-preset/invalid'
    throw err
  }
  const preset = { id: 'vision-bench', path: '/tmp/agent.cordis.yml' }
  await assert.rejects(() => cache.ensure(preset, generation, mount), /prefix missing/)
  for (let i = 0; i < 99; i++) {
    await assert.rejects(() => cache.ensure(preset, generation, mount, { source: 'standingKeyFor' }), /prefix missing/)
  }
  assert.equal(mounts, 1)
  assert.equal(cache.stats().mounts, 1)
})

test('file generation change and explicit retry remount', async () => {
  const cache = createStandingFailureCache()
  const first = standingGenerationFromContents('bad', { size: 3 }, '1')
  const preset = { id: 'vision-bench', path: '/tmp/a.yml' }
  let mounts = 0
  const mount = async () => {
    mounts += 1
    throw new Error('$.prefix missing required value')
  }
  await assert.rejects(() => cache.ensure(preset, first, mount))
  await assert.rejects(() => cache.ensure(preset, first, mount, { retry: true }))
  assert.equal(mounts, 2)
  const second = standingGenerationFromContents('fixed prefix: x', { size: 16 }, '1')
  const ok = await cache.ensure(preset, second, async () => ({ key: 'ok' }))
  assert.equal(ok.key, 'ok')
  assert.equal(mounts, 2)
})

test('transient errors back off then retry', async () => {
  let now = 1_000
  const cache = createStandingFailureCache({ now: () => now })
  const generation = standingGenerationFromContents('io', { size: 1 }, '1')
  const preset = { id: 'vision-bench', path: '/tmp/io.yml' }
  let mounts = 0
  const mount = async () => {
    mounts += 1
    const err = new Error('EAGAIN')
    err.code = 'EAGAIN'
    throw err
  }
  await assert.rejects(() => cache.ensure(preset, generation, mount))
  await assert.rejects(() => cache.ensure(preset, generation, mount))
  assert.equal(mounts, 1)
  now += standingBackoffMs(1) + 1
  await assert.rejects(() => cache.ensure(preset, generation, mount))
  assert.equal(mounts, 2)
  assert.equal(classifyStandingError({ code: 'EAGAIN', message: 'EAGAIN' }), 'transient')
})

test('old in-flight failure does not delete a newer mount record', async () => {
  const cache = createStandingFailureCache({ now: () => 1 })
  const generation = standingGenerationFromContents('x', { size: 1 }, '1')
  const preset = { id: 'vision-bench', path: '/tmp/x.yml' }
  let resumeFirst
  const first = cache.ensure(
    preset,
    generation,
    () =>
      new Promise((_, reject) => {
        resumeFirst = () => reject(new Error('$.prefix missing required value'))
      }),
  )
  const secondGen = standingGenerationFromContents('y', { size: 2 }, '1')
  await Promise.resolve()
  resumeFirst()
  await assert.rejects(() => first)
  const ok = await cache.ensure(preset, secondGen, async () => ({ key: 'new' }))
  assert.equal(ok.key, 'new')
})
