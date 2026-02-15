import type { PresetName } from './presets'
import { presets } from './presets'

export function renderPolicyYaml(preset: PresetName, auditLogPath?: string): string {
  const p = presets[preset].policy
  const lines: string[] = []

  lines.push(`mode: ${p.mode}`)
  lines.push(`defaultAction: ${p.defaultAction}`)
  lines.push(`failOpen: ${p.failOpen}`)
  lines.push('')
  lines.push('detectors:')

  const detectors = p.detectors ?? ['rules']
  for (const d of detectors) {
    lines.push(`  - ${d}`)
  }

  lines.push('')
  lines.push('thresholds:')
  const thresholds = p.thresholds ?? {}
  lines.push(`  riskThreshold: ${thresholds.riskThreshold ?? 0.7}`)
  lines.push(`  blockMinConfidence: ${thresholds.blockMinConfidence ?? 0.5}`)

  if (auditLogPath) {
    lines.push('')
    lines.push(`auditLogPath: ${auditLogPath}`)
  }

  return `${lines.join('\n')}\n`
}

