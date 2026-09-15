/**
 * Minimal cordis-style effect capture for guard apply/dispose tests.
 *
 * @param {Record<string, unknown>} services
 */
export function createGuardContext(services = {}) {
  /** @type {null | (() => void)} */
  let dispose = null
  return {
    ...services,
    /**
     * @param {() => () => void} factory
     */
    effect(factory) {
      dispose = factory()
      return dispose
    },
    dispose() {
      if (dispose) {
        dispose()
        dispose = null
      }
    },
  }
}
