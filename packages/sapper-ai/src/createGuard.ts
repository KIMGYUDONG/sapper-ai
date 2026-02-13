import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { AuditLogger, createDetectors, DecisionEngine, Guard, PolicyManager } from '@sapper-ai/core'
import type { Decision, Policy, ToolCall, ToolResult } from '@sapper-ai/types'

import { presets, type PresetName } from './presets'

export interface CreateGuardOptions {
  preset?: PresetName
  policy?: Partial<Policy>
  configPath?: string
  auditLogPath?: string
}

export interface SapperGuard {
  check(toolCall: ToolCall): Promise<Decision>
  checkResult(toolCall: ToolCall, toolResult: ToolResult): Promise<Decision>
  guard: Guard
  policy: Policy
}

export function createGuard(options?: CreateGuardOptions | PresetName): SapperGuard {
  const opts = typeof options === 'string' ? { preset: options } : (options ?? {})
  const policy = resolvePolicy(opts)

  warnIfLlmMisconfigured(policy)

  const detectors = createDetectors({ policy })
  const engine = new DecisionEngine(detectors)
  const logger = opts.auditLogPath ? new AuditLogger({ filePath: opts.auditLogPath }) : new AuditLogger()
  const guard = new Guard(engine, logger, policy)

  return {
    check: (toolCall) => guard.preTool(toolCall),
    checkResult: (toolCall, toolResult) => guard.postTool(toolCall, toolResult),
    guard,
    policy,
  }
}

function resolvePolicy(opts: CreateGuardOptions): Policy {
  const base = resolveBasePolicy(opts)
  if (!opts.policy) {
    return base
  }

  return mergePolicy(base, opts.policy)
}

function resolveBasePolicy(opts: CreateGuardOptions): Policy {
  if (opts.preset) {
    const preset = presets[opts.preset]
    if (!preset) {
      const valid = Object.keys(presets).join(', ')
      throw new Error(`Unknown preset "${opts.preset}". Valid presets: ${valid}`)
    }
    return { ...preset.policy }
  }

  const fromFile = loadConfigFile(opts.configPath)
  return fromFile ?? { ...presets.standard.policy }
}

function mergePolicy(base: Policy, override: Partial<Policy>): Policy {
  const mergedThresholds = {
    ...(base.thresholds ?? {}),
    ...(override.thresholds ?? {}),
  }

  const hasThresholds =
    typeof mergedThresholds.riskThreshold === 'number' || typeof mergedThresholds.blockMinConfidence === 'number'

  return {
    ...base,
    ...override,
    thresholds: hasThresholds ? mergedThresholds : undefined,
  }
}

function loadConfigFile(explicitPath?: string): Policy | null {
  const configPath = explicitPath ?? findConfigFile()
  if (!configPath) return null
  if (!existsSync(configPath)) return null

  try {
    const manager = new PolicyManager()
    return manager.loadFromFile(configPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load config from ${configPath}: ${message}`)
  }
}

const CONFIG_FILE_NAMES = ['sapperai.config.yaml', 'sapperai.config.yml']

function findConfigFile(): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const fullPath = resolve(process.cwd(), name)
    if (existsSync(fullPath)) return fullPath
  }
  return null
}

function warnIfLlmMisconfigured(policy: Policy): void {
  if (policy.detectors?.includes('llm') && !policy.llm) {
    console.warn(
      '[sapper-ai] Warning: Policy includes "llm" detector but no llm config provided. ' +
        'LLM detector will be inactive. Set policy.llm to enable it.'
    )
  }
}
