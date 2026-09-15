import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../../scan-guard.js'
import { createGuardContext } from '../helpers/guard-context.mjs'

/**
 * Fake clientModules registry that walks loader.entries() inside processOne,
 * matching the host contract the scan guard wraps.
 *
 * @param {Array<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>} initialEntries
 * @param {string[]} [dirtyNames]
 */
function createRegistry(initialEntries, dirtyNames = ['alpha', 'beta', 'gamma']) {
  let walkCount = 0
  /** @type {Array<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>} */
  let entries = [...initialEntries]
  const loader = {
    *entries() {
      walkCount += 1
      for (const entry of entries) yield entry
    },
  }
  const registry = {
    ctx: { loader },
    walkCount: () => walkCount,
    setEntries(next) {
      entries = [...next]
    },
    processOne(entryName, onErr) {
      try {
        for (const entry of loader.entries()) {
          if (entry?.options?.name === entryName && entry.disabled) {
            throw new Error(`disabled:${entryName}`)
          }
        }
        return true
      } catch (error) {
        if (onErr) onErr(error instanceof Error ? error : new Error(String(error)))
        else throw error
        return false
      }
    },
    flush(onError) {
      let changed = false
      for (const name of dirtyNames) {
        if (registry.processOne(name, onError)) changed = true
      }
      return changed
    },
  }
  return registry
}

test('batch dirty names scan the loader tree once', () => {
  const registry = createRegistry([
    { options: { name: 'alpha' }, fiber: {}, disabled: false },
    { options: { name: 'beta' }, fiber: {}, disabled: false },
    { options: { name: 'gamma' }, fiber: {}, disabled: false },
  ])
  const ctx = createGuardContext({ clientModules: registry, loader: registry.ctx.loader })
  apply(ctx)

  registry.flush()
  assert.equal(registry.walkCount(), 1)

  // After flush finishes, processOne is restored; direct calls walk again.
  const before = registry.walkCount()
  registry.processOne('alpha')
  registry.processOne('beta')
  registry.processOne('gamma')
  assert.equal(registry.walkCount(), before + 3)
})

test('apply/dispose restores original flush and processOne', () => {
  const registry = createRegistry([{ options: { name: 'alpha' }, fiber: {}, disabled: false }])
  const ctx = createGuardContext({ clientModules: registry, loader: registry.ctx.loader })
  apply(ctx)
  assert.equal(registry.flush.__dshVisionScanGuard, true)

  const walksBeforeFlush = registry.walkCount()
  registry.flush()
  assert.equal(registry.walkCount(), walksBeforeFlush + 1)
  // processOne is restored after flush; subsequent calls walk the live tree again.
  registry.processOne('alpha')
  assert.equal(registry.walkCount(), walksBeforeFlush + 2)

  ctx.dispose()
  assert.equal(registry.flush.__dshVisionScanGuard, undefined)
  const walksAfterDispose = registry.walkCount()
  registry.flush()
  // Unwrapped flush walks once per dirty name (3).
  assert.equal(registry.walkCount(), walksAfterDispose + 3)
})

test('repeat apply does not double-wrap flush', () => {
  const registry = createRegistry([{ options: { name: 'alpha' }, fiber: {}, disabled: false }])
  const ctx = createGuardContext({ clientModules: registry, loader: registry.ctx.loader })
  apply(ctx)
  const wrapped = registry.flush
  apply(ctx)
  apply(ctx)
  assert.equal(registry.flush, wrapped)
})

test('one plugin failure during flush does not break other dirty names', () => {
  const dirtyNames = ['alpha', 'beta', 'gamma']
  const seen = []
  const registry = createRegistry(
    [
      { options: { name: 'alpha' }, fiber: {}, disabled: false },
      { options: { name: 'beta' }, fiber: {}, disabled: true },
      { options: { name: 'gamma' }, fiber: {}, disabled: false },
    ],
    dirtyNames,
  )
  const origProcessOne = registry.processOne.bind(registry)
  registry.processOne = (entryName, onErr) => {
    seen.push(entryName)
    return origProcessOne(entryName, onErr)
  }
  const ctx = createGuardContext({ clientModules: registry, loader: registry.ctx.loader })
  apply(ctx)

  const errors = []
  registry.flush((error) => errors.push(String(error.message || error)))
  assert.deepEqual(seen, ['alpha', 'beta', 'gamma'])
  assert.ok(errors.some((msg) => msg.includes('disabled:beta')))
  assert.equal(registry.walkCount(), 1)
  ctx.dispose()
})

test('missing clientModules methods is a no-op', () => {
  const ctx = createGuardContext({ clientModules: { flush: () => {} } })
  assert.doesNotThrow(() => apply(ctx))
})
