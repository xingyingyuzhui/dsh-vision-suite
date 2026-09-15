import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPackageResolveCache,
  flushDirtyNames,
  snapshotEntriesByName,
} from '../../lib/scan-batch.mjs'

test('scan batch snapshots the tree once and groups by name', () => {
  const entries = [
    { options: { name: 'a' }, fiber: {}, disabled: false },
    { options: { name: 'b' }, fiber: {}, disabled: false },
    { options: { name: 'a' }, fiber: {}, disabled: false },
  ]
  const snapshot = snapshotEntriesByName(entries)
  assert.equal(snapshot.get('a').length, 2)
  const dirty = new Set(['a', 'b'])
  const seen = []
  flushDirtyNames(dirty, snapshot, (name, matches) => {
    seen.push([name, matches.length])
  })
  assert.deepEqual(seen, [
    ['a', 2],
    ['b', 1],
  ])
  assert.equal(dirty.size, 0)
})

test('flushDirtyNames isolates a single plugin failure from other dirty names', () => {
  const snapshot = snapshotEntriesByName([
    { options: { name: 'ok' }, fiber: {}, disabled: false },
    { options: { name: 'boom' }, fiber: {}, disabled: false },
    { options: { name: 'later' }, fiber: {}, disabled: false },
  ])
  const dirty = new Set(['ok', 'boom', 'later'])
  const seen = []
  const errors = []
  flushDirtyNames(
    dirty,
    snapshot,
    (name) => {
      seen.push(name)
      if (name === 'boom') throw new Error(`failed:${name}`)
      return true
    },
    (error) => errors.push(error.message),
  )
  assert.deepEqual(seen, ['ok', 'boom', 'later'])
  assert.deepEqual(errors, ['failed:boom'])
  assert.equal(dirty.size, 0)
})

test('package resolve cache expires negatives and invalidates', () => {
  let now = 0
  const cache = createPackageResolveCache({ now: () => now, ttlMs: 10, max: 8 })
  let calls = 0
  const compute = () => {
    calls += 1
    return false
  }
  assert.equal(cache.lookup('/root', 'pkg', compute), false)
  assert.equal(cache.lookup('/root', 'pkg', compute), false)
  assert.equal(calls, 1)
  now = 11
  assert.equal(cache.lookup('/root', 'pkg', compute), false)
  assert.equal(calls, 2)
  cache.invalidate()
  assert.equal(cache.stats().size, 0)
})
