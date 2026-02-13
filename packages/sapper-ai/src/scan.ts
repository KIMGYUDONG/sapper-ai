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

function toDefaultTargets(cwd: string): string[] {
  const home = homedir()
  return [join(home, '.claude', 'plugins'), join(home, '.config', 'claude-code'), cwd]
}

function shouldSkipDir(dirName: string): boolean {
  const base = basename(dirName)
  return base === 'node_modules' || base === '.git' || base === 'dist'
}

async function collectFiles(targetPath: string): Promise<string[]> {
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

function formatFindingLine(index: number, finding: ScanFinding): string {
  const reason = finding.decision.reasons[0]
  const label = reason?.startsWith('Detected pattern: ')
    ? reason.slice('Detected pattern: '.length)
    : reason ?? 'threat'

  const risk = finding.decision.risk.toFixed(2)
  const quarantineSuffix = finding.quarantinedId ? ` (quarantined: ${finding.quarantinedId})` : ''
  return `  ${index}. ${finding.filePath}\n     Risk: ${risk} | ${label}${quarantineSuffix}`
}

export async function runScan(options: ScanOptions = {}): Promise<number> {
  const cwd = process.cwd()
  const policy = resolvePolicy(cwd)
  const fix = options.fix === true

  const targets = options.targets && options.targets.length > 0 ? options.targets : toDefaultTargets(cwd)
  const scanner = new Scanner()
  const detectors = createDetectors({ policy })
  const quarantineDir = process.env.SAPPERAI_QUARANTINE_DIR
  const quarantineManager = quarantineDir ? new QuarantineManager({ quarantineDir }) : new QuarantineManager()

  console.log('\n  SapperAI Environment Scan\n')
  console.log('  Scanning:')
  for (const target of targets) {
    console.log(`    ${target}`)
  }
  console.log()

  const fileSet = new Set<string>()
  for (const target of targets) {
    const files = await collectFiles(target)
    for (const f of files) {
      fileSet.add(f)
    }
  }

  let scannedFiles = 0
  const findings: ScanFinding[] = []

  for (const filePath of Array.from(fileSet).sort()) {
    const result = await scanFile(filePath, policy, scanner, detectors, fix, quarantineManager)
    if (result.scanned) {
      scannedFiles += 1
    }
    if (result.finding) {
      findings.push(result.finding)
    }
  }

  console.log('  Results:')
  console.log(`    ${scannedFiles} files scanned, ${findings.length} threats detected`)
  console.log()

  if (findings.length > 0) {
    findings.forEach((finding, idx) => {
      console.log(formatFindingLine(idx + 1, finding))
      console.log()
    })

    if (!fix) {
      console.log("  Run 'npx sapper-ai scan --fix' to quarantine blocked files.")
      console.log()
    }
  }

  return findings.length > 0 ? 1 : 0
}
