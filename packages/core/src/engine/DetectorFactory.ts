import type { Detector, Policy } from '@sapper-ai/types'

import { LlmDetector } from '../detectors/LlmDetector'
import { RulesDetector } from '../detectors/RulesDetector'
import { ThreatIntelDetector } from '../detectors/ThreatIntelDetector'
import type { ThreatIntelEntry } from '../intel/ThreatIntelStore'

interface DetectorFactoryOptions {
  policy: Policy
  threatIntelEntries?: ThreatIntelEntry[]
  preferredDetectors?: string[]
}

export function createDetectors(options: DetectorFactoryOptions): Detector[] {
  const detectors: Detector[] = []
  const threatIntelEntries = options.threatIntelEntries ?? []

  if (threatIntelEntries.length > 0) {
    detectors.push(new ThreatIntelDetector(threatIntelEntries))
  }

  const policyWithDetectors = options.policy as Policy & { detectors?: string[] }
  const names = options.preferredDetectors ?? policyWithDetectors.detectors ?? ['rules']

  for (const name of names) {
    if (name === 'rules') {
      detectors.push(new RulesDetector())
      continue
    }

    if (name === 'llm') {
      detectors.push(new LlmDetector(options.policy.llm))
    }
  }

  if (detectors.length === 0) {
    detectors.push(new RulesDetector())
  }

  return detectors
}
