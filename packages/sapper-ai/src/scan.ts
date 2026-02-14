import { existsSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import {
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  createDetectors,
  isConfigLikeFile,
  normalizeSurfaceText,
  PolicyManager,
  QuarantineManager,
  Scanner,
} from '@sapper-ai/core'
import type { Decision, Policy } from '@sapper-ai/types'

import { presets } from './presets'

export interface ScanOptions {
  targets?: string[]
  fix?: boolean
  deep?: boolean
  system?: boolean
  scopeLabel?: string
}

interface ScanFinding {
  filePath: string
  decision: Decision
  quarantinedId?: string
}

interface ScanFileResult {
  scanned: boolean
  finding?: ScanFinding
}

const CONFIG_FILE_NAMES = ['sapperai.config.yaml', 'sapperai.config.yml']

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

const SYSTEM_SCAN_PATHS = (() => {
  const home = homedir()
  return [
    join(home, '.claude'),
    join(home, '.config', 'claude-code'),
    join(home, '.cursor'),
    join(home, '.vscode', 'extensions'),
    join(home, 'Library', 'Application Support', 'Claude'),
  ]
})()

function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const fullPath = resolve(cwd, name)
    if (existsSync(fullPath)) {
      return fullPath
    }
  }

  return null
}

function resolvePolicy(cwd: string): Policy {
  const configPath = findConfigFile(cwd)
  if (!configPath) {
    return { ...presets.standard.policy }
  }

  return new PolicyManager().loadFromFile(configPath)
}

function getThresholds(policy: Policy): { riskThreshold: number; blockMinConfidence: number } {
  const extended = policy as Policy & {
    thresholds?: {
      riskThreshold?: unknown
      blockMinConfidence?: unknown
    }
  }

  const riskThreshold =
    typeof extended.thresholds?.riskThreshold === 'number' ? extended.thresholds.riskThreshold : 0.7
  const blockMinConfidence =
    typeof extended.thresholds?.blockMinConfidence === 'number' ? extended.thresholds.blockMinConfidence : 0.5

  return { riskThreshold, blockMinConfidence }
}

function shouldSkipDir(dirName: string): boolean {
  const base = basename(dirName)
  return base === 'node_modules' || base === '.git' || base === 'dist'
}

async function collectFiles(targetPath: string, deep: boolean): Promise<string[]> {
  try {
    const info = await stat(targetPath)
    if (info.isFile()) {
      return [targetPath]
    }
    if (!info.isDirectory()) {
      return []
    }
  } catch {
    return []
  }

  if (!deep) {
    try {
      const entries = await readdir(targetPath, { withFileTypes: true })
      const results: string[] = []
      for (const entry of entries) {
        if (!entry.isFile()) continue
        results.push(join(targetPath, entry.name))
      }
      return results
    } catch {
      return []
    }
  }

  const results: string[] = []
  const stack: string[] = [targetPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)

      if (entry.isDirectory()) {
        if (shouldSkipDir(fullPath)) {
          continue
        }
        stack.push(fullPath)
        continue
      }

      if (entry.isFile()) {
        results.push(fullPath)
      }
    }
  }

  return results
}

function riskColor(risk: number): string {
  if (risk >= 0.8) return RED
  if (risk >= 0.5) return YELLOW
  return GREEN
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return ''
  }
  if (text.length <= maxWidth) {
    return text
  }

  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth)
  }

  return `...${text.slice(text.length - (maxWidth - 3))}`
}

function renderProgressBar(current: number, total: number, width: number): string {
  const safeTotal = Math.max(1, total)
  const pct = Math.floor((current / safeTotal) * 100)
  const filled = Math.floor((current / safeTotal) * width)
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
  return `  ${bar}  ${pct}% │ ${current}/${total} files`
}

function extractPatternLabel(decision: Decision): string {
  const reason = decision.reasons[0]
  if (!reason) return 'threat'
  return reason.startsWith('Detected pattern: ') ? reason.slice('Detected pattern: '.length) : reason
}

function padRight(text: string, width: number): string {
  if (text.length >= width) return text
  return text + ' '.repeat(width - text.length)
}

function padRightVisual(text: string, width: number): string {
  const visLen = stripAnsi(text).length
  if (visLen >= width) return text
  return text + ' '.repeat(width - visLen)
}

function padLeft(text: string, width: number): string {
  if (text.length >= width) return text
  return ' '.repeat(width - text.length) + text
}

function renderFindingsTable(
  findings: ScanFinding[],
  opts: { cwd: string; columns: number; color: boolean }
): string[] {
  const rows = findings.map((f, i) => {
    const file = f.filePath.startsWith(opts.cwd + '/') ? f.filePath.slice(opts.cwd.length + 1) : f.filePath
    const pattern = extractPatternLabel(f.decision)
    const riskValue = f.decision.risk.toFixed(2)
    const riskPlain = padLeft(riskValue, 4)
    const risk = opts.color ? `${riskColor(f.decision.risk)}${riskPlain}${RESET}` : riskPlain
    return { idx: String(i + 1), file, risk, pattern }
  })

  const idxWidth = Math.max(1, ...rows.map((r) => r.idx.length))
  const riskWidth = 4
  const patternWidth = Math.min(20, Math.max('Pattern'.length, ...rows.map((r) => r.pattern.length)))

  const baseWidth = 2 + idxWidth + 2 + 2 + riskWidth + 2 + 2 + patternWidth + 2
  const maxTableWidth = Math.max(60, Math.min(opts.columns || 80, 120))
  const fileWidth = Math.max(20, Math.min(50, maxTableWidth - baseWidth))

  const top = `  ┌${'─'.repeat(idxWidth + 2)}┬${'─'.repeat(fileWidth + 2)}┬${'─'.repeat(riskWidth + 2)}┬${'─'.repeat(
    patternWidth + 2
  )}┐`
  const header = `  │ ${padRight('#', idxWidth)} │ ${padRight('File', fileWidth)} │ ${padRight(
    'Risk',
    riskWidth
  )} │ ${padRight('Pattern', patternWidth)} │`
  const sep = `  ├${'─'.repeat(idxWidth + 2)}┼${'─'.repeat(fileWidth + 2)}┼${'─'.repeat(riskWidth + 2)}┼${'─'.repeat(
    patternWidth + 2
  )}┤`

  const lines = [top, header, sep]
  for (const r of rows) {
    const file = truncateToWidth(r.file, fileWidth)
    const pattern = truncateToWidth(r.pattern, patternWidth)
    lines.push(
      `  │ ${padRight(r.idx, idxWidth)} │ ${padRight(file, fileWidth)} │ ${padRightVisual(r.risk, riskWidth)} │ ${padRight(
        pattern,
        patternWidth
      )} │`
    )
  }

  const bottom = `  └${'─'.repeat(idxWidth + 2)}┴${'─'.repeat(fileWidth + 2)}┴${'─'.repeat(riskWidth + 2)}┴${'─'.repeat(
    patternWidth + 2
  )}┘`
  lines.push(bottom)
  return lines
}

function isThreat(decision: Decision, policy: Policy): boolean {
  const { riskThreshold, blockMinConfidence } = getThresholds(policy)
  return decision.risk >= riskThreshold && decision.confidence >= blockMinConfidence
}

async function readFileIfPresent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function scanFile(
  filePath: string,
  policy: Policy,
  scanner: Scanner,
  detectors: ReturnType<typeof createDetectors>,
  fix: boolean,
  quarantineManager: QuarantineManager
): Promise<ScanFileResult> {
  if (!isConfigLikeFile(filePath)) {
    return { scanned: false }
  }

  const raw = await readFileIfPresent(filePath)
  if (raw === null || raw.trim().length === 0) {
    return { scanned: false }
  }

  const fileSurface = normalizeSurfaceText(raw)
  const targetType = classifyTargetType(filePath)
  const targets: Array<{ id: string; surface: string }> = [
    {
      id: `${targetType}:${buildEntryName(filePath)}`,
      surface: fileSurface,
    },
  ]

  if (filePath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(raw) as unknown
      const mcpTargets = collectMcpTargetsFromJson(filePath, parsed)
      for (const t of mcpTargets) {
        targets.push({ id: `${t.type}:${t.name}`, surface: t.surface })
      }
    } catch {
    }
  }

  let bestThreat: Decision | null = null

  for (const target of targets) {
    const decision = await scanner.scanTool(target.id, target.surface, policy, detectors)
    if (!isThreat(decision, policy)) {
      continue
    }

    if (!bestThreat || decision.risk > bestThreat.risk) {
      bestThreat = decision
    }

    if (fix && decision.action === 'block') {
      try {
        const record = await quarantineManager.quarantine(filePath, decision)
        return { scanned: true, finding: { filePath, decision, quarantinedId: record.id } }
      } catch {
      }
    }
  }

  if (!bestThreat) {
    return { scanned: true }
  }

  return { scanned: true, finding: { filePath, decision: bestThreat } }
}

export async function runScan(options: ScanOptions = {}): Promise<number> {
  const cwd = process.cwd()
  const policy = resolvePolicy(cwd)
  const fix = options.fix === true

  const deep = options.system ? true : options.deep !== false
  const targets =
    options.system === true
      ? SYSTEM_SCAN_PATHS
      : options.targets && options.targets.length > 0
        ? options.targets
        : [cwd]

  const scanner = new Scanner()
  const detectors = createDetectors({ policy })
  const quarantineDir = process.env.SAPPERAI_QUARANTINE_DIR
  const quarantineManager = quarantineDir ? new QuarantineManager({ quarantineDir }) : new QuarantineManager()

  const isTTY = process.stdout.isTTY === true
  const color = isTTY
  const scopeLabel =
    options.scopeLabel ??
    (options.system
      ? 'AI system scan'
      : deep
        ? 'Current + subdirectories'
        : 'Current directory only')

  console.log('\n  SapperAI Security Scanner\n')
  console.log(`  Scope: ${scopeLabel}`)
  console.log()

  const fileSet = new Set<string>()
  for (const target of targets) {
    const files = await collectFiles(target, deep)
    for (const f of files) {
      fileSet.add(f)
    }
  }

  const files = Array.from(fileSet).sort()
  console.log(`  Collecting files...  ${files.length} files found`)
  console.log()

  const findings: ScanFinding[] = []

  const total = files.length
  const progressWidth = Math.max(10, Math.min(30, (process.stdout.columns ?? 80) - 30))

  for (let i = 0; i < files.length; i += 1) {
    const filePath = files[i]!

    if (isTTY && total > 0) {
      const bar = renderProgressBar(i + 1, total, progressWidth)
      const label = '  Scanning: '
      const maxPath = Math.max(10, (process.stdout.columns ?? 80) - stripAnsi(bar).length - label.length)
      const scanning = `${label}${truncateToWidth(filePath, maxPath)}`

      if (i === 0) {
        process.stdout.write(`${bar}\n${scanning}\n`)
      } else {
        process.stdout.write(`\x1b[2A\x1b[2K\r${bar}\n\x1b[2K\r${scanning}\n`)
      }
    }

    const result = await scanFile(filePath, policy, scanner, detectors, fix, quarantineManager)
    if (result.finding) {
      findings.push(result.finding)
    }
  }

  if (isTTY && total > 0) {
    process.stdout.write('\x1b[2A\x1b[2K\r\x1b[1B\x1b[2K\r')
  }

  if (findings.length === 0) {
    const msg = `  ✓ All clear — ${total} files scanned, 0 threats detected`
    console.log(color ? `${GREEN}${msg}${RESET}` : msg)
    console.log()
    return 0
  }

  const warn = `  ⚠ ${total} files scanned, ${findings.length} threats detected`
  console.log(color ? `${RED}${warn}${RESET}` : warn)
  console.log()

  const tableLines = renderFindingsTable(findings, {
    cwd,
    columns: process.stdout.columns ?? 80,
    color,
  })
  for (const line of tableLines) {
    console.log(line)
  }
  console.log()

  if (!fix) {
    console.log("  Run 'npx sapper-ai scan --fix' to quarantine blocked files.")
    console.log()
  }

  return 1
}
