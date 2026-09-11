import { snapshotEntriesByName } from './lib/scan-batch.mjs'

export const name = 'dsh-vision-scan-guard'
export const inject = ['clientModules']

export function apply(ctx) {
  const registry = ctx.clientModules
  if (!registry || typeof registry.flush !== 'function' || typeof registry.processOne !== 'function') {
    return
  }
  if (registry.flush.__dshVisionScanGuard) return
  const origFlush = registry.flush.bind(registry)
  const origProcessOne = registry.processOne.bind(registry)

  function flushWithTreeSnapshot(onError) {
    const loader = registry.ctx?.loader || ctx.loader
    if (!loader || typeof loader.entries !== 'function') {
      return origFlush(onError)
    }
    const snapshot = snapshotEntriesByName(loader.entries())
    const origEntries = loader.entries.bind(loader)
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
