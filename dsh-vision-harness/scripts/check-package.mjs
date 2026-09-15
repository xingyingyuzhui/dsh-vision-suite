import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED = ['standing-guard.js', 'scan-guard.js', 'README.md', 'LICENSE', 'cordis.patch.yml']

const BANNED = ['__pycache__', '.pyc', 'coverage/', 'node_modules/', 'test/', 'scripts/']

/** Extensions whose relative imports make one shipped file depend on another. */
const SCANNED_EXTENSIONS = ['.mjs', '.js']

const RELATIVE_IMPORT =
  /(?:^|[^\w])(?:import|export)[^;]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g

/**
 * @param {string} projectRoot
 * @returns {{ name: string, version: string, files: string[] }}
 */
export function readManifest(projectRoot) {
  const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
  return { name: pkg.name, version: pkg.version, files: Array.isArray(pkg.files) ? pkg.files.map(String) : [] }
}

/**
 * @param {string[]} files
 * @returns {string[]}
 */
export function findDuplicateEntries(files) {
  const seen = new Set()
  const duplicates = new Set()
  for (const file of files) {
    if (seen.has(file)) duplicates.add(file)
    seen.add(file)
  }
  return [...duplicates]
}

/**
 * @param {string} projectRoot
 * @param {string[]} files
 * @returns {string[]}
 */
export function findMissingEntries(projectRoot, files) {
  return files.filter((file) => {
    const full = join(projectRoot, file)
    return !existsSync(full) || !statSync(full).isFile()
  })
}

/**
 * @param {string} projectRoot
 * @param {string} from
 * @param {string} specifier
 * @returns {string|null}
 */
export function resolveSpecifier(projectRoot, from, specifier) {
  const base = normalize(join(dirname(from), specifier))
  const candidates = [base, `${base}.mjs`, `${base}.js`, join(base, 'index.mjs'), join(base, 'index.js')]
  for (const candidate of candidates) {
    const full = join(projectRoot, candidate)
    if (existsSync(full) && statSync(full).isFile()) return candidate.replaceAll('\\', '/')
  }
  return null
}

/**
 * Published package must be closed under relative imports.
 *
 * @param {string} projectRoot
 * @param {string[]} files
 * @returns {{ from: string, to: string }[]}
 */
export function findClosureGaps(projectRoot, files) {
  const shipped = new Set(files)
  const gaps = []
  for (const from of files) {
    if (!SCANNED_EXTENSIONS.some((ext) => from.endsWith(ext))) continue
    const full = join(projectRoot, from)
    if (!existsSync(full) || !statSync(full).isFile()) continue
    const source = readFileSync(full, 'utf8')
    let match
    RELATIVE_IMPORT.lastIndex = 0
    while ((match = RELATIVE_IMPORT.exec(source))) {
      const target = resolveSpecifier(projectRoot, from, match[1] || match[2])
      if (target && !shipped.has(target)) gaps.push({ from, to: target })
    }
  }
  return gaps
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: boolean, problems: string[], counts: object }}
 */
export function checkPackage(projectRoot = root) {
  const problems = []
  const manifest = readManifest(projectRoot)
  const files = manifest.files

  for (const file of REQUIRED) {
    if (!existsSync(join(projectRoot, file))) problems.push(`missing ${file}`)
  }

  for (const banned of BANNED) {
    if (files.some((file) => String(file).includes(banned))) problems.push(`files[] must not include ${banned}`)
  }

  const duplicates = findDuplicateEntries(files)
  for (const file of duplicates) problems.push(`files[] lists ${file} more than once`)

  const missing = findMissingEntries(projectRoot, files)
  for (const file of missing) problems.push(`files[] points at a path that does not exist: ${file}`)

  const gaps = findClosureGaps(projectRoot, files)
  for (const gap of gaps) problems.push(`shipped file imports an unshipped module: ${gap.from} -> ${gap.to}`)

  return {
    ok: problems.length === 0,
    problems,
    counts: { entries: files.length, duplicates: duplicates.length, missing: missing.length, gaps: gaps.length },
  }
}

function main() {
  const result = checkPackage(root)
  if (!result.ok) {
    console.error('pack:check failed:')
    for (const problem of result.problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  console.log(
    `pack:check ok (${result.counts.entries} files, 0 duplicates, 0 missing, 0 closure gaps)`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
