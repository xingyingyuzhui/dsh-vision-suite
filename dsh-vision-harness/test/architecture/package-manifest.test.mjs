import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkPackage,
  findClosureGaps,
  findDuplicateEntries,
  findMissingEntries,
  readManifest,
} from '../../scripts/check-package.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * @param {string[]} files
 * @param {Record<string, string>} sources
 */
function makePackage(files, sources = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-harness-pack-'))
  const pkg = { name: 'fixture-harness', version: '1.0.0', files }
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  writeFileSync(join(dir, 'standing-guard.js'), 'export function apply() {}\n')
  writeFileSync(join(dir, 'scan-guard.js'), 'export function apply() {}\n')
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  writeFileSync(join(dir, 'LICENSE'), 'MIT\n')
  writeFileSync(join(dir, 'cordis.patch.yml'), '- insert: []\n')
  for (const [rel, body] of Object.entries(sources)) {
    const full = join(dir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }
  return dir
}

test('live harness package manifest passes pack:check', () => {
  const result = checkPackage(root)
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.ok(result.counts.entries >= 8)
})

test('duplicate and ghost manifest entries are both rejected', (t) => {
  const dir = makePackage(['standing-guard.js', 'standing-guard.js', 'lib/gone.mjs'])
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  assert.deepEqual(findDuplicateEntries(['a', 'b', 'a']), ['a'])
  assert.deepEqual(findMissingEntries(dir, ['standing-guard.js', 'lib/gone.mjs']), ['lib/gone.mjs'])
  const result = checkPackage(dir)
  assert.equal(result.ok, false)
  assert.ok(result.problems.some((p) => p.includes('more than once')))
  assert.ok(result.problems.some((p) => p.includes('does not exist')))
})

test('a shipped file importing an unshipped module fails the gate', (t) => {
  const sources = {
    'standing-guard.js': "import { x } from './lib/missing.mjs'\nexport const y = x\n",
    'lib/missing.mjs': 'export const x = 1\n',
  }
  const broken = makePackage(['standing-guard.js'], sources)
  t.after(() => rmSync(broken, { recursive: true, force: true }))
  const gaps = findClosureGaps(broken, readManifest(broken).files)
  assert.deepEqual(gaps, [{ from: 'standing-guard.js', to: 'lib/missing.mjs' }])
  assert.equal(checkPackage(broken).ok, false)
})
