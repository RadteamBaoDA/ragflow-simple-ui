import fs from 'fs'
import path from 'path'
import v8ToIstanbul from 'v8-to-istanbul'
import pkgCoverage from 'istanbul-lib-coverage'
const { createCoverageMap } = pkgCoverage

const TMP_DIR = path.resolve(process.cwd(), 'coverage', '.tmp')

if (!fs.existsSync(TMP_DIR)) {
  console.error('Coverage tmp directory not found:', TMP_DIR)
  process.exit(1)
}

const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith('coverage-') && f.endsWith('.json'))
if (!files.length) {
  console.error('No coverage fragments found in', TMP_DIR)
  process.exit(1)
}

const coverageMap = createCoverageMap({})

for (const file of files) {
  const p = path.join(TMP_DIR, file)
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  const isIstanbul = raw && typeof raw === 'object' && (
    raw._coverageSchema || Object.keys(raw).some(k => raw[k] && typeof raw[k] === 'object' && raw[k].path && (raw[k].s || raw[k].statementMap))
  )
  if (isIstanbul) {
    coverageMap.merge(raw)
    continue
  }
  const results = raw.result || raw
  if (!Array.isArray(results)) continue
  for (const entry of results) {
    if (!entry || !entry.url) continue
    let filePath = entry.url
    if (filePath.startsWith('file:///')) {
      filePath = new URL(entry.url).pathname
      if (/^\/[A-Za-z]:\//.test(filePath)) filePath = filePath.slice(1)
    }
    if (!filePath.startsWith(process.cwd())) {
      if (!filePath.includes(path.sep + 'src' + path.sep)) continue
    }
    let source = ''
    try { source = fs.readFileSync(filePath, 'utf8') } catch (e) { source = '' }
    const conv = v8ToIstanbul(filePath, 0, { source })
    try {
      await conv.load()
      conv.applyCoverage(entry)
      const istanbulCov = conv.toIstanbul()
      if (Object.keys(istanbulCov).length) coverageMap.merge(istanbulCov)
    } catch (e) {
      // ignore
    }
  }
}

// compute per-file summaries
const data = coverageMap.files().map(f => {
  const fc = coverageMap.fileCoverageFor(f)
  const sum = fc.toSummary().data
  return { file: f, lines: sum.lines.pct, statements: sum.statements.pct, functions: sum.functions.pct, branches: sum.branches.pct }
})

// sort ascending by lines
const sorted = data.sort((a,b) => (a.lines === 'Unknown' ? 100 : a.lines) - (b.lines === 'Unknown' ? 100 : b.lines))

console.log('Worst 40 files by lines coverage:')
for (const row of sorted.slice(0, 40)) {
  console.log(`${String(row.lines).padStart(6)}%  ${row.file}`)
}

console.log('\nTotal files:', data.length)

