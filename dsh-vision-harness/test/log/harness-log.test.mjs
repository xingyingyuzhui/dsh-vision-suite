import assert from 'node:assert/strict'
import test from 'node:test'
import { createHarnessLog } from '../../lib/harness-log.mjs'

test('harness log rate-limits and drops when the queue is full', async () => {
  const chunks = []
  const log = createHarnessLog({
    file: '/tmp/unused.jsonl',
    now: () => 1000,
    queueCap: 2,
    minIntervalMs: 1000,
    writeStream: {
      write(buf) {
        chunks.push(String(buf))
        return true
      },
    },
  })
  log.record('k', { type: 'a' }, 'stack-1')
  log.record('k', { type: 'a' }, 'stack-2')
  log.record('other', { type: 'b' })
  log.record('third', { type: 'c' })
  assert.equal(log.stats().dropped, 1)
  await new Promise((r) => setImmediate(r))
  assert.equal(chunks.length, 2)
  assert.match(chunks[0], /stack-1/)
})

test('harness log close ends the stream', () => {
  let ended = 0
  const log = createHarnessLog({
    file: '/tmp/unused-close.jsonl',
    writeStream: {
      write() {
        return true
      },
      end() {
        ended += 1
      },
    },
  })
  log.close()
  assert.equal(ended, 1)
  log.close()
  assert.equal(ended, 1)
})
