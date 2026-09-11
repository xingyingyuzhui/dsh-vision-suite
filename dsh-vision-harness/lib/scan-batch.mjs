// @ts-check

/**
 * Snapshot a loader entry list once, then group by plugin name so a batch of
 * dirty names does not walk the whole tree D times.
 *
 * @param {Iterable<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>} entries
 * @returns {Map<string, Array<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>>}
 */
export function snapshotEntriesByName(entries) {
  /** @type {Map<string, Array<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>>} */
  const byName = new Map()
  for (const entry of entries) {
    const name = entry?.options ? String(entry.options.name || '') : ''
    if (!name) continue
    const list = byName.get(name)
    if (list) list.push(entry)
    else byName.set(name, [entry])
  }
  return byName
}

/**
 * @param {Set<string> | Iterable<string>} dirty
 * @param {Map<string, Array<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>>} snapshot
 * @param {(entryName: string, matches: Array<{ options?: { name?: string }, fiber?: unknown, disabled?: boolean }>) => boolean | void} processName
 * @param {(error: Error) => void} [onError]
 * @returns {boolean}
 */
export function flushDirtyNames(dirty, snapshot, processName, onError) {
  let changed = false
  const names = dirty instanceof Set ? [...dirty] : [...dirty]
  if (dirty instanceof Set) dirty.clear()
  for (const entryName of names) {
    try {
      const matches = snapshot.get(entryName) || []
      if (processName(entryName, matches)) changed = true
    } catch (error) {
      if (onError) onError(error instanceof Error ? error : new Error(String(error)))
      else throw error
    }
  }
  return changed
}

/**
 * Bounded cache for package discovery. Negative results expire; install /
 * unlink / generation bumps drop the whole table.
 *
 * @param {{ max?: number, now?: () => number, ttlMs?: number }} [opts]
 */
export function createPackageResolveCache(opts = {}) {
  const max = opts.max || 256
  const now = opts.now || (() => Date.now())
  const ttlMs = opts.ttlMs || 30_000
  /** @type {Map<string, { value: unknown, at: number, hits: number }>} */
  const table = new Map()
  let generation = 0

  /**
   * @param {string} root
   * @param {string} name
   */
  function keyOf(root, name) {
    return `${root}::${name}`
  }

  /**
   * @param {string} root
   * @param {string} name
   * @param {() => unknown} compute
   */
  function lookup(root, name, compute) {
    const key = keyOf(root, name)
    const hit = table.get(key)
    const ts = now()
    if (hit && ts - hit.at < ttlMs) {
      hit.hits += 1
      return hit.value
    }
    const value = compute()
    if (table.size >= max) {
      const first = table.keys().next().value
      if (first !== undefined) table.delete(first)
    }
    table.set(key, { value, at: ts, hits: 0 })
    return value
  }

  function invalidate() {
    table.clear()
    generation += 1
  }

  return {
    lookup,
    invalidate,
    stats: () => ({ size: table.size, generation }),
  }
}
