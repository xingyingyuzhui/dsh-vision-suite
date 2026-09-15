// @ts-check
import { snapshotEntriesByName } from './lib/scan-batch.mjs'

export const name = 'dsh-vision-scan-guard'
export const inject = ['clientModules']

/**
 * @typedef {{
 *   flush: Function & { __dshVisionScanGuard?: boolean },
 *   processOne: Function,
 *   ctx?: { loader?: { entries: Function } },
 * }} ClientModulesRegistry
 */

/**
 * @param {{
 *   clientModules?: Partial<ClientModulesRegistry>,
 *   loader?: { entries: Function },
 *   effect: (factory: () => () => void) => unknown,
 * }} ctx
 */
export function apply(ctx) {
  if (
    !ctx.clientModules ||
    typeof ctx.clientModules.flush !== 'function' ||
    typeof ctx.clientModules.processOne !== 'function'
  ) {
    return
  }
  /** @type {ClientModulesRegistry} */
  const registry = /** @type {ClientModulesRegistry} */ (ctx.clientModules)
  if (registry.flush.__dshVisionScanGuard) return
  const origFlush = registry.flush.bind(registry)
  const origProcessOne = registry.processOne.bind(registry)

  /**
   * @param {(error: Error) => void} [onError]
   */
  function flushWithTreeSnapshot(onError) {
    const loader = registry.ctx?.loader || ctx.loader
    if (!loader || typeof loader.entries !== 'function') {
      return origFlush(onError)
    }
    const snapshot = snapshotEntriesByName(loader.entries())
    const origEntries = loader.entries.bind(loader)
    /**
     * @param {string} entryName
     * @param {(error: Error) => void} [onErr]
     */
    registry.processOne = function processOneFromSnapshot(entryName, onErr) {
      loader.entries = function* snapshotEntries() {
        for (const entry of snapshot.get(entryName) || []) yield entry
      }
      try {
        return origProcessOne(entryName, onErr)
      } finally {
        loader.entries = origEntries
      }
    }
    try {
      return origFlush(onError)
    } finally {
      registry.processOne = origProcessOne
      loader.entries = origEntries
    }
  }
  flushWithTreeSnapshot.__dshVisionScanGuard = true
  registry.flush = flushWithTreeSnapshot

  ctx.effect(() => () => {
    if (registry.flush === flushWithTreeSnapshot) registry.flush = origFlush
    registry.processOne = origProcessOne
  })
}
