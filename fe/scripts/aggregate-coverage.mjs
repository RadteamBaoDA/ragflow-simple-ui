import fs from 'fs'
import path from 'path'
import v8ToIstanbul from 'v8-to-istanbul'
import pkgCoverage from 'istanbul-lib-coverage'
const { createCoverageMap } = pkgCoverage
import pkgReport from 'istanbul-lib-report'
const { createContext } = pkgReport
import pkgReports from 'istanbul-reports'
const reports = pkgReports

const TMP_DIR = path.resolve(process.cwd(), 'coverage', '.tmp')
const OUT_DIR = path.resolve(process.cwd(), 'coverage', 'report')

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
  // If this fragment already looks like Istanbul coverage, merge directly
  const isIstanbul = raw && typeof raw === 'object' && (
    raw._coverageSchema || Object.keys(raw).some(k => raw[k] && typeof raw[k] === 'object' && raw[k].path && (raw[k].s || raw[k].statementMap))
  )
  if (isIstanbul) {
    console.log('Merging istanbul fragment', p)
    coverageMap.merge(raw)
    continue
  }

  const results = raw.result || raw
  if (!Array.isArray(results)) {
    console.warn('Skipping non-array fragment:', p)
    continue
  }
  console.log('Reading', p, 'entries:', results.length)
  for (const entry of results) {
    if (!entry || !entry.url) continue
    // Convert file URL -> path
    let filePath = entry.url
    if (filePath.startsWith('file:///')) {
      // Windows file:///C:/...
      filePath = new URL(entry.url).pathname
      // On Windows path starts with /C:/, remove leading slash
      if (/^\/[A-Za-z]:\//.test(filePath)) filePath = filePath.slice(1)
    }
    // Skip entries that are not in repo source
    if (!filePath.startsWith(process.cwd())) {
      // allow files inside /src
      if (!filePath.includes(path.sep + 'src' + path.sep)) continue
    }
    let source = ''
    try {
      source = fs.readFileSync(filePath, 'utf8')
    } catch (e) {
      // if source not found, fallback to empty
      source = ''
    }

    const conv = v8ToIstanbul(filePath, 0, { source })
    try {
      await conv.load()
      conv.applyCoverage(entry)
      const istanbulCov = conv.toIstanbul()
      const keys = Object.keys(istanbulCov)
      console.log('Converted', filePath, '->', keys.length, 'files')
      if (keys.length) coverageMap.merge(istanbulCov)
      else console.warn('No istanbul coverage generated for', filePath)
    } catch (e) {
      // If conversion failed, continue
      console.warn('Failed to convert coverage entry for', filePath, e && e.message)
    }
  }
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// create report context
const context = createContext({
  dir: OUT_DIR,
  coverageMap,
})

// produce text-summary and html
const textReport = reports.create('text-summary')
textReport.execute(context)

const htmlReport = reports.create('html')
htmlReport.execute(context)

// Print JSON summary
const summary = coverageMap.getCoverageSummary().toJSON()
console.log('\nCoverage Summary:')
console.log(JSON.stringify(summary, null, 2))

// Exit with non-zero if lines < 90
const pct = summary.lines.pct
if (typeof pct === 'number' && pct < 90) {
  console.log(`\nCoverage below target: ${pct}% < 90%`) 
  process.exitCode = 2
} else {
  console.log(`\nCoverage meets target: ${pct}% >= 90%`)
}
