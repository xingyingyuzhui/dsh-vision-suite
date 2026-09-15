import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply } from '../../standing-guard.js'
import { createGuardContext } from '../helpers/guard-context.mjs'

/**
 * @param {(preset: unknown, options?: unknown) => Promise<unknown>} ensureStanding
 */
function makeService(ensureStanding) {
  return { ensureStanding }
}

/**
 * @param {import('node:test').TestContext} t
 * @returns {string}
 */
function withTempHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'dsh-standing-'))
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  t.after(() => {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
    rmSync(home, { recursive: true, force: true })
  })
  return home
}

test('missing agentPresets.ensureStanding throws a clear error', () => {
  assert.throws(
    () => apply(createGuardContext({ agentPresets: {} })),
    /dsh-vision-standing-guard: requires agentPresets\.ensureStanding/,
  )
  assert.throws(
    () => apply(createGuardContext({})),
    /dsh-vision-standing-guard: requires agentPresets\.ensureStanding/,
  )
})

test('repeat apply does not double-wrap ensureStanding', async (t) => {
  const home = withTempHome(t)
  let calls = 0
  const service = makeService(async () => {
    calls += 1
    return { key: 'ok' }
  })
  const ctx = createGuardContext({ agentPresets: service })
  apply(ctx)
  const firstWrap = service.ensureStanding
  assert.equal(firstWrap.__dshVisionStandingGuard, true)
  apply(ctx)
  apply(ctx)
  assert.equal(service.ensureStanding, firstWrap)

  const presetPath = join(home, 'agent.yml')
  writeFileSync(presetPath, 'prefix: x\n')
  await service.ensureStanding({ id: 'vision-bench', path: presetPath, depVersion: '1' })
  assert.equal(calls, 1)
})

test('dispose restores original method and closes the log', async (t) => {
  const home = withTempHome(t)
  let calls = 0
  async function origEnsure() {
    calls += 1
    throw Object.assign(new Error('$.prefix missing required value'), { code: 'agent-preset/invalid' })
  }
  const service = makeService(origEnsure)
  const ctx = createGuardContext({ agentPresets: service })
  apply(ctx)
  assert.notEqual(service.ensureStanding, origEnsure)
  assert.equal(typeof service.retryStanding, 'function')

  const presetPath = join(home, 'bad.yml')
  writeFileSync(presetPath, 'broken\n')
  await assert.rejects(() => service.ensureStanding({ id: 'vision-bench', path: presetPath, depVersion: '1' }))
  assert.equal(calls, 1)
  await new Promise((r) => setImmediate(r))
  const logPath = join(home, 'vision-harness', 'standing-guard.jsonl')
  assert.equal(existsSync(logPath), true)

  ctx.dispose()
  assert.equal(service.retryStanding, undefined)
  assert.equal(service.ensureStanding.__dshVisionStandingGuard, undefined)
  // Restored method is the bound original; calling it bypasses the guard cache.
  await assert.rejects(() => service.ensureStanding({ id: 'vision-bench', path: presetPath, depVersion: '1' }))
  assert.equal(calls, 2)
})

test('retryStanding only affects the current wrap; unload leaves no residual method', async (t) => {
  const home = withTempHome(t)
  let mounts = 0
  const service = makeService(async () => {
    mounts += 1
    throw Object.assign(new Error('$.prefix missing required value'), { code: 'agent-preset/invalid' })
  })
  const ctx = createGuardContext({ agentPresets: service })
  apply(ctx)

  const presetPath = join(home, 'agent.yml')
  writeFileSync(presetPath, 'bad\n')
  const preset = { id: 'vision-bench', path: presetPath, depVersion: '1' }
  await assert.rejects(() => service.ensureStanding(preset))
  assert.equal(mounts, 1)
  await assert.rejects(() => service.retryStanding(preset))
  assert.equal(mounts, 2)

  ctx.dispose()
  assert.equal(service.retryStanding, undefined)
  assert.equal(Object.hasOwn(service, 'retryStanding') ? service.retryStanding : undefined, undefined)
  assert.equal(service.ensureStanding.__dshVisionStandingGuard, undefined)

  await assert.rejects(() => service.ensureStanding(preset))
  assert.equal(mounts, 3)

  // Re-apply installs a fresh wrap; previous retryStanding does not linger.
  apply(ctx)
  assert.equal(typeof service.retryStanding, 'function')
  await assert.rejects(() => service.retryStanding(preset))
  assert.equal(mounts, 4)
  ctx.dispose()
  assert.equal(service.retryStanding, undefined)
})
