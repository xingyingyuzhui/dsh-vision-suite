// @ts-check
import { createWriteStream, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_RETAIN = 3
const DEFAULT_QUEUE_CAP = 200
const DEFAULT_MIN_INTERVAL_MS = 1000

/**
 * Rate-limited rotating JSONL log. One full stack per key; later events in
 * the same second collapse to a count. Write-stream errors are recorded
 * once and do not throw into callers.
 *
 * @param {{
 *   file: string,
 *   now?: () => number,
 *   maxBytes?: number,
 *   retain?: number,
 *   queueCap?: number,
 *   minIntervalMs?: number,
 *   writeStream?: { write: Function, end?: Function, on?: Function },
 * }} opts
 */
export function createHarnessLog(opts) {
  const file = opts.file
  const now = opts.now || (() => Date.now())
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES
  const retain = opts.retain || DEFAULT_RETAIN
  const queueCap = opts.queueCap || DEFAULT_QUEUE_CAP
  const minIntervalMs = opts.minIntervalMs || DEFAULT_MIN_INTERVAL_MS

  /** @type {Map<string, { lastAt: number, count: number, firstStack?: string }>} */
  const keys = new Map()
  /** @type {string[]} */
  const queue = []
  let dropped = 0
  let bytes = 0
  let streamError = ''
  let writing = false
  let stream = opts.writeStream || null

  function openStream() {
    if (stream) return stream
    mkdirSync(dirname(file), { recursive: true })
    try {
      bytes = statSync(file).size
    } catch {
      bytes = 0
    }
    stream = createWriteStream(file, { flags: 'a' })
    if (typeof stream.on === 'function') {
      stream.on('error', (error) => {
        streamError = error instanceof Error ? error.message : String(error)
      })
    }
    return stream
  }

  function rotateIfNeeded(chunkSize) {
    if (bytes + chunkSize < maxBytes) return
    try {
      if (stream && typeof stream.end === 'function') stream.end()
    } catch {
      /* ignore */
    }
    stream = null
    for (let i = retain - 1; i >= 1; i--) {
      const from = i === 1 ? file : `${file}.${i}`
      const to = `${file}.${i + 1}`
      try {
        renameSync(from, to)
      } catch {
        /* missing rotation source is fine */
      }
    }
    try {
      renameSync(file, `${file}.1`)
    } catch {
      /* first rotate of a new file */
    }
    bytes = 0
  }

  function flush() {
    if (writing || queue.length === 0 || streamError) return
    writing = true
    try {
      const out = openStream()
      while (queue.length) {
        const line = queue.shift()
        if (!line) continue
        const buf = Buffer.from(line)
        rotateIfNeeded(buf.length)
        const active = stream || openStream()
        active.write(buf)
        bytes += buf.length
      }
    } catch (error) {
      streamError = error instanceof Error ? error.message : String(error)
    } finally {
      writing = false
    }
  }

  /**
   * @param {string} key
   * @param {Record<string, unknown>} event
   * @param {string} [stack]
   */
  function record(key, event, stack) {
    const ts = now()
    const prev = keys.get(key)
    if (prev && ts - prev.lastAt < minIntervalMs) {
      prev.count += 1
      prev.lastAt = ts
      return
    }
    const first = !prev
    keys.set(key, { lastAt: ts, count: (prev?.count || 0) + 1, firstStack: prev?.firstStack || stack })
    const payload = {
      ts,
      key,
      count: keys.get(key)?.count || 1,
      ...event,
    }
    if (first && stack) payload.stack = stack
    if (prev && prev.count > 1) payload.suppressed = prev.count - 1
    const line = `${JSON.stringify(payload)}\n`
    if (queue.length >= queueCap) {
      dropped += 1
      return
    }
    queue.push(line)
    queueMicrotask(() => flush())
  }

  function close() {
    try {
      if (stream && typeof stream.end === 'function') stream.end()
    } catch {
      /* ignore */
    }
    stream = null
  }

  return {
    record,
    close,
    stats: () => ({ dropped, queued: queue.length, bytes, streamError }),
  }
}
