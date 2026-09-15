import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { collectTestFiles, testFileArgs } from '../../scripts/run-tests.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * @param {string} file
 */
function rel(file) {
  return file.slice(root.length + 1).replaceAll('\\', '/')
}

/**
 * @param {string} file
 */
function lineCount(file) {
  return readFileSync(file, 'utf8').split(/\r?\n/).length
}

test('test runner lists nested *.test.mjs files without shell globs', () => {
  const files = collectTestFiles(root).map(rel)
  assert.ok(files.includes('test/standing/entry.test.mjs'))
  assert.ok(files.includes('test/scan/entry.test.mjs'))
  assert.ok(files.includes('test/log/harness-log.test.mjs'))
  assert.ok(files.includes('test/architecture/package-manifest.test.mjs'))
  assert.ok(!files.some((file) => file.includes('/helpers/')))
  assert.ok(!files.some((file) => file.includes('*')))
  const args = testFileArgs(root)
  assert.equal(args.length, files.length)
  assert.ok(args.every((file) => file.startsWith('test/')))
})

test('npm quality scripts do not rely on shell glob expansion', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.match(pkg.scripts.test, /scripts\/run-tests\.mjs/)
  assert.match(pkg.scripts['test:coverage'], /scripts\/run-tests\.mjs/)
  assert.match(pkg.scripts['test:coverage'], /c8 --all\b/)
  assert.match(pkg.scripts.quality, /npm run lint/)
  assert.match(pkg.scripts.quality, /npm run typecheck/)
  assert.match(pkg.scripts.quality, /npm run test:coverage/)
  assert.match(pkg.scripts.quality, /npm run pack:check/)
  for (const name of ['test', 'test:coverage', 'lint', 'typecheck', 'pack:check']) {
    assert.doesNotMatch(pkg.scripts[name], /\*/)
  }
})

test('cache/log/scan/standing tests live in separate files under 350 lines', () => {
  const expected = [
    'test/standing/failure-cache.test.mjs',
    'test/standing/entry.test.mjs',
    'test/scan/batch.test.mjs',
    'test/scan/entry.test.mjs',
    'test/log/harness-log.test.mjs',
  ]
  for (const relPath of expected) {
    const full = join(root, relPath)
    assert.equal(statSync(full).isFile(), true, relPath)
    assert.ok(lineCount(full) < 350, `${relPath} has ${lineCount(full)} lines`)
  }
  // Old monolithic root test must be gone.
  const rootTests = readdirSync(join(root, 'test')).filter((name) => name.endsWith('.test.mjs'))
  assert.deepEqual(rootTests, [])
})

test('c8 --all include covers published production JS', () => {
  const c8 = JSON.parse(readFileSync(join(root, '.c8rc.json'), 'utf8'))
  assert.ok(c8.include.includes('standing-guard.js'))
  assert.ok(c8.include.includes('scan-guard.js'))
  assert.ok(c8.include.includes('lib/**'))
  assert.ok(c8.exclude.includes('test/**'))
  assert.ok(c8.exclude.includes('scripts/**'))
  assert.deepEqual(c8.extension, ['.js', '.mjs'])
})
