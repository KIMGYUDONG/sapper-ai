import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  applyThreatIntelBlocklist,
  AuditLogger,
  createDetectors,
  RulesDetector,
  Scanner,
  ThreatIntelStore,
  evaluatePolicyMatch,
  QuarantineManager,
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  isConfigLikeFile,
  normalizeSurfaceText,
} from '@sapper-ai/core'
import type { AssessmentContext, AuditLogEntry, Decision, Detector, Policy } from '@sapper-ai/types'
import chokidar, { type FSWatcher } from 'chokidar'
import { AdversaryCampaignRunner } from './AdversaryCampaignRunner'
import { loadThreatIntelEntries } from './threatIntel'

type AuditLoggerLike = Pick<AuditLogger, 'log'>

interface DynamicWatchOptions {
  enabled?: boolean
  maxCases?: number
  maxDurationMs?: number
  seed?: string
}

type AdversaryRunnerLike = Pick<AdversaryCampaignRunner, 'assessInMemory'>

const DEFAULT_DYNAMIC_OPTIONS: Required<DynamicWatchOptions> = {
  enabled: false,
  maxCases: 8,
  maxDurationMs: 1500,
  seed: 'watch-default',
}

interface FileWatcherOptions {
  policy: Policy
  scanner?: Scanner
  quarantineManager?: QuarantineManager
  auditLogger?: AuditLoggerLike
  detectors?: Detector[]
  watchPaths?: string[]
  threatIntelStore?: ThreatIntelStore
  dynamic?: DynamicWatchOptions
  adversaryRunner?: AdversaryRunnerLike
}

interface ScanTarget {
  id: string
  sourcePath: string
  sourceType: ReturnType<typeof classifyTargetType>
  surface: string
}

function toDefaultWatchPaths(): string[] {
  const home = homedir()
  return [join(home, '.claude', 'plugins'), join(home, '.config', 'claude-code'), process.cwd()]
}

export class FileWatcher {
  private readonly policy: Policy
  private readonly scanner: Scanner
  private readonly quarantineManager: QuarantineManager
  private readonly auditLogger: AuditLoggerLike
  private readonly detectors: Detector[]
  private readonly watchPaths: string[]
  private readonly threatIntelStore: ThreatIntelStore
  private readonly dynamic: Required<DynamicWatchOptions>
  private readonly adversaryRunner: AdversaryRunnerLike

  private watcher: FSWatcher | null = null
  private readonly inFlightPaths = new Set<string>()
  private threatIntelEntries: Array<{
    id: string
    type: 'toolName' | 'packageName' | 'urlPattern' | 'contentPattern' | 'sha256'
    value: string
    reason: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    source: string
    addedAt: string
    expiresAt?: string
  }> = []

  constructor(options: FileWatcherOptions) {
    this.policy = options.policy
    this.scanner = options.scanner ?? new Scanner()
    this.quarantineManager = options.quarantineManager ?? new QuarantineManager()
    this.auditLogger =
      options.auditLogger ?? new AuditLogger({ filePath: process.env.SAPPERAI_AUDIT_LOG_PATH ?? '/tmp/sapperai-proxy.audit.log' })
    this.detectors = options.detectors ?? [new RulesDetector()]
    this.watchPaths = options.watchPaths ?? toDefaultWatchPaths()
    this.threatIntelStore = options.threatIntelStore ?? new ThreatIntelStore({ cachePath: process.env.SAPPERAI_THREAT_FEED_CACHE })
    this.dynamic = {
      ...DEFAULT_DYNAMIC_OPTIONS,
      ...options.dynamic,
    }
    this.adversaryRunner = options.adversaryRunner ?? new AdversaryCampaignRunner()
  }

  async start(): Promise<void> {
    if (this.watcher) {
      throw new Error('FileWatcher already started')
    }

    await this.loadThreatIntel()

    const quarantineDir = this.quarantineManager.getQuarantineDir()
    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: (pathName: string) => {
        if (pathName.includes('/node_modules/') || pathName.includes('/.git/') || pathName.includes('/dist/')) {
          return true
        }

        return pathName.startsWith(quarantineDir)
      },
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100,
      },
    })

    this.watcher.on('add', (pathName: string) => {
      this.handleWatchEvent(pathName)
    })

    this.watcher.on('change', (pathName: string) => {
      this.handleWatchEvent(pathName)
    })

    await new Promise<void>((resolve, reject) => {
      if (!this.watcher) {
        reject(new Error('FileWatcher failed to initialize'))
        return
      }

      const onReady = () => {
        this.watcher?.off('error', onError)
        resolve()
      }

      const onError = (error: unknown) => {
        this.watcher?.off('ready', onReady)
        reject(error instanceof Error ? error : new Error(String(error)))
      }

      this.watcher.once('ready', onReady)
      this.watcher.once('error', onError)
    })

    // Allow the native filesystem watcher (FSEvents on macOS) to fully
    // initialise after chokidar emits 'ready'. Without this settling
    // delay, events for files created immediately after start() can be
    // missed intermittently.
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  }

  async close(): Promise<void> {
    if (!this.watcher) {
      return
    }

    await this.watcher.close()
    this.watcher = null
  }

  private handleWatchEvent(filePath: string): void {
    void this.handleFile(filePath).catch((error: unknown) => {
      const target: ScanTarget = {
        id: `watch:${buildEntryName(filePath)}`,
        sourcePath: filePath,
        sourceType: classifyTargetType(filePath),
        surface: '',
      }

      this.logAuditEntry(
        target,
        {
          action: 'allow',
          risk: 0,
          confidence: 0,
          reasons: [`Watch handler error: ${error instanceof Error ? error.message : String(error)}`],
          evidence: [],
        },
        'watch_scan_error'
      )
    })
  }

  private async handleFile(filePath: string): Promise<void> {
    if (!isConfigLikeFile(filePath) || this.inFlightPaths.has(filePath)) {
      return
    }

    this.inFlightPaths.add(filePath)

    try {
      const content = await this.readFileIfPresent(filePath)
      if (content === null || content.trim().length === 0) {
        return
      }

      const targets = this.toTargets(filePath, content)
      for (const target of targets) {
        const effectivePolicy = applyThreatIntelBlocklist(this.policy, this.threatIntelEntries)
        const dynamicEligible = this.shouldRunDynamicForTarget(target)
        let dynamicEvaluated = false
        const policyMatch = evaluatePolicyMatch(effectivePolicy, {
          toolName: target.id,
          content: target.surface,
        })

        if (policyMatch.action === 'allow') {
          this.logAuditEntry(
            target,
            {
              action: 'allow',
              risk: 0,
              confidence: 1,
              reasons: policyMatch.reasons,
              evidence: [],
            },
            'watch_policy_match'
          )

          if (dynamicEligible) {
            dynamicEvaluated = true
            if (await this.evaluateDynamicTarget(filePath, target, effectivePolicy)) {
              return
            }
          } else {
            continue
          }
        }

        if (policyMatch.action === 'block') {
          const blockDecision: Decision = {
            action: this.policy.mode === 'enforce' ? 'block' : 'allow',
            risk: 1,
            confidence: 1,
            reasons: policyMatch.reasons,
            evidence: [],
          }

          this.logAuditEntry(target, blockDecision, 'watch_policy_match')

          if (this.policy.mode === 'enforce') {
            await this.quarantineManager.quarantine(filePath, blockDecision)
            return
          }

          if (dynamicEligible) {
            dynamicEvaluated = true
          }

          if (dynamicEligible && (await this.evaluateDynamicTarget(filePath, target, effectivePolicy))) {
            return
          }

          continue
        }

        const decision = await this.scanner.scanTool(target.id, target.surface, effectivePolicy, this.resolveDetectors(), {
          scanSource: 'watch_surface',
          sourcePath: target.sourcePath,
          sourceType: target.sourceType,
        })
        this.logAuditEntry(target, decision)

        if (decision.action === 'block' && this.policy.mode === 'enforce') {
          try {
            await this.quarantineManager.quarantine(filePath, decision)
          } catch (error) {
            const reasons = [`Quarantine failed: ${error instanceof Error ? error.message : String(error)}`]
            this.logAuditEntry(
              target,
              {
                action: 'allow',
                risk: 0,
                confidence: 0,
                reasons,
                evidence: [],
              },
              'watch_quarantine_error'
            )
          }
          return
        }

        if (dynamicEligible && !dynamicEvaluated && (await this.evaluateDynamicTarget(filePath, target, effectivePolicy))) {
          return
        }
      }
    } finally {
      this.inFlightPaths.delete(filePath)
    }
  }

  private shouldRunDynamicForTarget(target: ScanTarget): boolean {
    if (this.dynamic.enabled !== true) {
      return false
    }

    return target.sourceType === 'skill' || target.sourceType === 'agent'
  }

  private async evaluateDynamicTarget(filePath: string, target: ScanTarget, policy: Policy): Promise<boolean> {
    const startedAt = performance.now()

    try {
      const result = await this.adversaryRunner.assessInMemory({
        policy,
        target: {
          id: target.id,
          sourcePath: target.sourcePath,
          sourceType: target.sourceType,
          surface: target.surface,
        },
        maxCases: this.dynamic.maxCases,
        maxDurationMs: this.dynamic.maxDurationMs,
        seed: this.dynamic.seed,
        skipSync: true,
      })
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt))

      const dynamicMeta = {
        dynamic: true,
        totalCases: result.totalCases,
        vulnerableCases: result.vulnerableCases,
      }

      if (result.vulnerable || result.vulnerableCases > 0) {
        const reasons = result.findings
          .map((finding) => finding.decision.reasons[0])
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .slice(0, 3)

        const maxRisk = result.findings.reduce((max, finding) => Math.max(max, finding.decision.risk), 0)
        const maxConfidence = result.findings.reduce((max, finding) => Math.max(max, finding.decision.confidence), 0)
        const decision: Decision = {
          action: this.policy.mode === 'enforce' ? 'block' : 'allow',
          risk: this.normalizeRisk(maxRisk, 1),
          confidence: this.normalizeRisk(maxConfidence, 1),
          reasons: reasons.length > 0 ? reasons : ['Dynamic evaluation identified exploitable behavior'],
          evidence: [],
        }

        this.logAuditEntry(target, decision, 'watch_dynamic_vulnerable', dynamicMeta, elapsedMs)

        if (this.policy.mode !== 'enforce') {
          return false
        }

        try {
          await this.quarantineManager.quarantine(filePath, decision)
        } catch (error) {
          const reasons = [`Quarantine failed: ${error instanceof Error ? error.message : String(error)}`]
          this.logAuditEntry(
            target,
            {
              action: 'allow',
              risk: 0,
              confidence: 0,
              reasons,
              evidence: [],
            },
            'watch_quarantine_error'
          )
        }
        return true
      }

      this.logAuditEntry(
        target,
        {
          action: 'allow',
          risk: 0,
          confidence: 1,
          reasons: ['Dynamic evaluation found no exploitable behavior'],
          evidence: [],
        },
        'watch_dynamic_scan',
        dynamicMeta,
        elapsedMs
      )

      return false
    } catch (error) {
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt))
      const shouldFailOpen = this.policy.mode === 'monitor' || this.policy.failOpen !== false
      const errorDecision: Decision = {
        action: shouldFailOpen ? 'allow' : 'block',
        risk: shouldFailOpen ? 0 : 1,
        confidence: shouldFailOpen ? 0 : 1,
        reasons: [`Dynamic evaluation failed: ${error instanceof Error ? error.message : String(error)}`],
        evidence: [],
      }

      this.logAuditEntry(
        target,
        errorDecision,
        'watch_dynamic_error',
        {
          dynamic: true,
          failOpen: shouldFailOpen,
        },
        elapsedMs
      )

      if (shouldFailOpen || this.policy.mode !== 'enforce') {
        return false
      }

      try {
        await this.quarantineManager.quarantine(filePath, errorDecision)
      } catch (quarantineError) {
        const reasons = [`Quarantine failed: ${quarantineError instanceof Error ? quarantineError.message : String(quarantineError)}`]
        this.logAuditEntry(
          target,
          {
            action: 'allow',
            risk: 0,
            confidence: 0,
            reasons,
            evidence: [],
          },
          'watch_quarantine_error'
        )
      }

      return true
    }
  }

  private normalizeRisk(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback
    }

    return Math.max(0, Math.min(1, value))
  }

  private async readFileIfPresent(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf8')
    } catch {
      return null
    }
  }

  private toTargets(filePath: string, content: string): ScanTarget[] {
    const normalized = normalizeSurfaceText(content)
    const targetType = classifyTargetType(filePath)
    const targets: ScanTarget[] = [
      {
        id: `${targetType}:${buildEntryName(filePath)}`,
        sourcePath: filePath,
        sourceType: targetType,
        surface: normalized,
      },
    ]

    if (filePath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content) as unknown
        const mcpTargets = collectMcpTargetsFromJson(filePath, parsed)
        for (const mcpTarget of mcpTargets) {
          targets.push({
            id: `${mcpTarget.type}:${mcpTarget.name}`,
            sourcePath: mcpTarget.source,
            sourceType: mcpTarget.type,
            surface: mcpTarget.surface,
          })
        }
      } catch {
        // Ignore invalid JSON.
      }
    }

    return targets
  }

  private logAuditEntry(
    target: ScanTarget,
    decision: Decision,
    phase:
      | 'watch_scan'
      | 'watch_quarantine_error'
      | 'watch_policy_match'
      | 'watch_dynamic_scan'
      | 'watch_dynamic_vulnerable'
      | 'watch_dynamic_error'
      | 'watch_scan_error' = 'watch_scan',
    meta: Record<string, unknown> = {},
    durationMs = 0
  ): void {
    const context = {
      kind: 'install_scan',
      policy: this.policy,
      meta: {
        phase,
        scanSource: 'watch_surface',
        sourcePath: target.sourcePath,
        sourceType: target.sourceType,
        ...meta,
      },
    } as AssessmentContext

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      context,
      decision,
      durationMs,
    }

    this.auditLogger.log(entry)
  }

  private resolveDetectors(): Detector[] {
    if (this.detectors.length !== 1 || this.detectors[0]?.id !== 'rules') {
      return this.detectors
    }

    return createDetectors({
      policy: this.policy,
      threatIntelEntries: this.threatIntelEntries,
      preferredDetectors: (this.policy as Policy & { detectors?: string[] }).detectors,
    })
  }

  private async loadThreatIntel(): Promise<void> {
    const extended = this.policy as Policy & {
      threatFeed?: {
        enabled?: boolean
        sources?: string[]
        autoSync?: boolean
        failOpen?: boolean
        cachePath?: string
      }
    }

    const feed = extended.threatFeed
    if (!feed?.enabled) {
      this.threatIntelEntries = []
      return
    }

    try {
      this.threatIntelEntries = await loadThreatIntelEntries(this.policy, this.threatIntelStore)
    } catch (error) {
      if (feed.failOpen === false) {
        throw error
      }

      this.threatIntelEntries = []
    }
  }
}
