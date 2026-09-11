// @ts-check
import { createHash } from 'node:crypto'

/**
 * Isolate failed standing mounts so the same broken generation is not rebuilt
 * on every subsequent request. Deterministic schema errors stay cached until
 * the composition generation changes or the caller asks to retry. Transient
 * I/O errors use bounded exponential backoff. In-flight work is single-flight
 * and dispose must finish before a replacement mount starts.
 */

/**
 * @typedef {{
 *   mtimeMs: number,
 *   size: number,
 *   digest: string,
 *   depVersion: string,
 * }} StandingGeneration
 *
 * @typedef {'deterministic' | 'transient'} StandingFailureKind
 */

/**
 * @param {unknown} error
 * @returns {StandingFailureKind}
 */
export function classifyStandingError(error) {
  const code = error && typeof error === 'object' ? /** @type {{ code?: unknown }} */ (error).code : ''
  const msg = error instanceof Error ? error.message : String(error || '')
  if (
    code === 'agent-preset/invalid' ||
    /missing required value|invalid yaml|failed to mount: composition|persona 配置无法通过/i.test(msg)
  ) {
    return 'deterministic'
  }
  if (
    code === 'ENOENT' ||
    code === 'EPERM' ||
    code === 'EACCES' ||
    code === 'EMFILE' ||
    code === 'EAGAIN' ||
    /ECONNRESET|ETIMEDOUT|ENOTDIR|temporary|try again/i.test(msg)
  ) {
    return 'transient'
  }
  if (/unreadable|ENOENT|EPERM/i.test(msg)) return 'transient'
  return 'deterministic'
}

/**
 * @param {number} attempt 1-based
 * @param {number} [capMs]
 */
export function standingBackoffMs(attempt, capMs = 30_000) {
  const n = Math.max(1, Number(attempt) || 1)
  return Math.min(capMs, 1000 * 2 ** (n - 1))
}

/**
 * @param {string} contents
 * @param {{ mtimeMs?: number, size?: number }} [stat]
 * @param {string} [depVersion]
 * @returns {StandingGeneration}
 */
export function standingGenerationFromContents(contents, stat = {}, depVersion = '') {
  const text = String(contents || '')
  const digest = createHash('sha256').update(text).digest('hex')
  return {
    mtimeMs: Number(stat.mtimeMs) || 0,
    size: Number(stat.size) || Buffer.byteLength(text),
    digest,
    depVersion: String(depVersion || ''),
  }
}

/**
 * @param {StandingGeneration | null | undefined} a
 * @param {StandingGeneration | null | undefined} b
 */
export function sameStandingGeneration(a, b) {
  if (!a || !b) return false
  return a.digest === b.digest && a.depVersion === b.depVersion && a.size === b.size
}

/**
 * @param {{
 *   now?: () => number,
 *   classify?: (error: unknown) => StandingFailureKind,
 *   backoffMs?: (attempt: number) => number,
 *   onEvent?: (event: Record<string, unknown>) => void,
 * }} [opts]
 */
export function createStandingFailureCache(opts = {}) {
  const now = opts.now || (() => Date.now())
  const classify = opts.classify || classifyStandingError
  const backoff = opts.backoffMs || standingBackoffMs
  const onEvent = opts.onEvent || (() => {})

  /** @type {Map<string, any>} */
  const records = new Map()
  let mounts = 0

  /**
   * @param {{ id: string, path?: string }} preset
   * @param {StandingGeneration} generation
   */
  function recordKey(preset, generation) {
    return `${preset.id}::${preset.path || ''}::${generation.digest}::${generation.depVersion}`
  }

  /**
   * @param {unknown} error
   */
  function cloneError(error) {
    if (error instanceof Error) {
      const copy = new Error(error.message)
      copy.name = error.name
      const code = /** @type {{ code?: unknown }} */ (error).code
      if (code !== undefined) /** @type {{ code?: unknown }} */ (copy).code = code
      return copy
    }
    return new Error(String(error))
  }

  /**
   * @param {string} presetId
   */
  async function waitDispose(presetId) {
    const rec = records.get(presetId)
    if (rec?.disposing) await rec.disposing
  }

  /**
   * @param {{ id: string, path?: string }} preset
   * @param {StandingGeneration} generation
   * @param {(preset: { id: string, path?: string }) => Promise<unknown>} mount
   * @param {{ retry?: boolean, source?: string, correlationId?: string }} [options]
   */
  async function ensure(preset, generation, mount, options = {}) {
    const key = recordKey(preset, generation)
    const existing = records.get(preset.id)

    if (existing && existing.key !== key) {
      await waitDispose(preset.id)
      const current = records.get(preset.id)
      if (current && current.key !== key && current.mountId !== existing.mountId) {
        // a newer task replaced this record while we awaited dispose
      } else if (current && current.key !== key) {
        records.delete(preset.id)
      }
    }

    const rec = records.get(preset.id)
    if (rec?.inflight) return rec.inflight

    if (rec?.status === 'failed' && rec.key === key && !options.retry) {
      if (rec.kind === 'deterministic') {
        onEvent({
          type: 'standing.cache-hit',
          presetId: preset.id,
          kind: rec.kind,
          source: options.source || '',
          correlationId: options.correlationId || '',
          mounts,
        })
        throw cloneError(rec.error)
      }
      if (rec.kind === 'transient' && now() < rec.nextRetryAt) {
        onEvent({
          type: 'standing.backoff',
          presetId: preset.id,
          kind: rec.kind,
          nextRetryAt: rec.nextRetryAt,
          source: options.source || '',
          correlationId: options.correlationId || '',
          mounts,
        })
        throw cloneError(rec.error)
      }
    }

    await waitDispose(preset.id)

    const mountId = `${preset.id}:${key}:${now()}:${Math.random().toString(36).slice(2, 8)}`
    const inflight = (async () => {
      mounts += 1
      onEvent({
        type: 'standing.mount',
        presetId: preset.id,
        source: options.source || '',
        correlationId: options.correlationId || '',
        mounts,
        retry: options.retry === true,
      })
      try {
        const result = await mount(preset)
        const live = records.get(preset.id)
        if (live && live.mountId !== mountId) return result
        records.set(preset.id, { status: 'ok', key, result, mountId, inflight: null, disposing: null })
        return result
      } catch (error) {
        const live = records.get(preset.id)
        if (live && live.mountId !== mountId) throw error
        const kind = classify(error)
        const attempt = (live && live.key === key ? Number(live.attempt) || 0 : 0) + 1
        const disposing = Promise.resolve()
        records.set(preset.id, {
          status: 'failed',
          key,
          error,
          kind,
          attempt,
          nextRetryAt: kind === 'transient' ? now() + backoff(attempt) : Number.POSITIVE_INFINITY,
          mountId,
          inflight: null,
          disposing,
        })
        onEvent({
          type: 'standing.fail',
          presetId: preset.id,
          kind,
          attempt,
          source: options.source || '',
          correlationId: options.correlationId || '',
          message: error instanceof Error ? error.message : String(error),
          mounts,
        })
        throw error
      } finally {
        const live = records.get(preset.id)
        if (live && live.mountId === mountId) live.inflight = null
      }
    })()

    records.set(preset.id, {
      ...(records.get(preset.id) || {}),
      status: 'pending',
      key,
      mountId,
      inflight,
      disposing: null,
    })
    return inflight
  }

  /**
   * @param {string} presetId
   */
  function invalidate(presetId) {
    const rec = records.get(presetId)
    if (!rec) return
    if (rec.inflight) return
    records.delete(presetId)
  }

  function stats() {
    return { mounts, size: records.size }
  }

  return { ensure, invalidate, classify, stats, records }
}
