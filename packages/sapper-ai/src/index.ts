export { createGuard, type CreateGuardOptions, type SapperGuard } from './createGuard'
export { presets, type Preset, type PresetName } from './presets'

export {
  Guard,
  DecisionEngine,
  RulesDetector,
  LlmDetector,
  ThreatIntelDetector,
  createDetectors,
  AuditLogger,
  PolicyManager,
  validatePolicy,
  Scanner,
  QuarantineManager,
  ThreatIntelStore,
} from '@sapper-ai/core'

export type {
  Policy,
  ToolCall,
  ToolResult,
  ToolMetadata,
  ToolPolicy,
  Decision,
  DetectorOutput,
  Detector,
  AssessmentContext,
  AuditLogEntry,
  GuardAction,
  MatchList,
  ThreatFeedConfig,
  LlmConfig,
} from '@sapper-ai/types'

export type { QuarantineRecord, ThreatIntelEntry, ThreatIntelSnapshot, IntelMatchList } from '@sapper-ai/core'
