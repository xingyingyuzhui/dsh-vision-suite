import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { defaultDshHome } from './lib/dsh-home.mjs'
import { createHarnessLog } from './lib/harness-log.mjs'
import {
  createStandingFailureCache,
  standingGenerationFromContents,
} from './lib/standing-failure-cache.mjs'

export const name = 'dsh-vision-standing-guard'
export const inject = ['agentPresets']

function readGeneration(preset) {
  const path = preset?.path
  if (!path) {
    return standingGenerationFromContents('', {}, '')
  }
  const contents = readFileSync(path, 'utf8')
  const st = statSync(path)
  return standingGenerationFromContents(
    contents,
    { mtimeMs: st.mtimeMs, size: st.size },
    String(preset.depVersion || ''),
  )
}

export function apply(ctx) {
  const service = ctx.agentPresets
  if (!service || typeof service.ensureStanding !== 'function') {
    throw new Error('dsh-vision-standing-guard: requires agentPresets.ensureStanding')
  }
  if (service.ensureStanding.__dshVisionStandingGuard) return
  const orig = service.ensureStanding.bind(service)
  const log = createHarnessLog({
    file: join(defaultDshHome(), 'vision-harness', 'standing-guard.jsonl'),
  })
  const cache = createStandingFailureCache({
    onEvent(event) {
      const key = `standing:${event.presetId}:${event.type}`
      log.record(key, event)
    },
  })

  function ensureStandingGuarded(preset, options) {
    const generation = readGeneration(preset)
    return cache.ensure(preset, generation, (next) => orig(next), options)
  }
  ensureStandingGuarded.__dshVisionStandingGuard = true
  service.ensureStanding = ensureStandingGuarded

  service.retryStanding = function retryStanding(preset) {
    return service.ensureStanding(preset, { retry: true, source: 'retryStanding' })
  }

  ctx.effect(() => () => {
    if (service.ensureStanding === ensureStandingGuarded) service.ensureStanding = orig
    if (service.retryStanding) service.retryStanding = undefined
    log.close()
  })
}

export const _internal = { readGeneration }
