import type { Policy } from '@sapper-ai/types'

export interface Preset {
  name: string
  description: string
  policy: Policy
}

export type PresetName = 'monitor' | 'standard' | 'strict' | 'paranoid' | 'ci' | 'development'

export const presets: Record<PresetName, Preset> = {
  monitor: {
    name: 'monitor',
    description: 'Monitor only - logs threats but never blocks',
    policy: {
      mode: 'monitor',
      defaultAction: 'allow',
      failOpen: true,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
    },
  },

  standard: {
    name: 'standard',
    description: 'Balanced protection with sensible defaults',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: true,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
    },
  },

  strict: {
    name: 'strict',
    description: 'Strict enforcement with lower thresholds',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: false,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.5, blockMinConfidence: 0.3 },
    },
  },

  paranoid: {
    name: 'paranoid',
    description: 'Maximum security - aggressive blocking, fail closed, LLM analysis',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: false,
      detectors: ['rules', 'llm'],
      thresholds: { riskThreshold: 0.3, blockMinConfidence: 0.2 },
    },
  },

  ci: {
    name: 'ci',
    description: 'CI/CD pipeline - deterministic, fail closed, no LLM',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: false,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
    },
  },

  development: {
    name: 'development',
    description: 'Development mode - permissive, monitor only',
    policy: {
      mode: 'monitor',
      defaultAction: 'allow',
      failOpen: true,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.9, blockMinConfidence: 0.8 },
    },
  },
}
