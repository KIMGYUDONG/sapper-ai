export type DemoPreset = {
  id: string
  title: string
  toolName: string
  payload: string
  summary: string
}

export type DetectorEvidence = {
  detectorId: string
  risk: number
  confidence: number
  reasons: string[]
}

export type DetectionResponse = {
  action: 'allow' | 'block'
  risk: number
  confidence: number
  reasons: string[]
  evidence: DetectorEvidence[]
  source?: {
    fileName: string
    fileSize: number
  }
}

export type PipelineStep = {
  id: string
  title: string
  detail: string
  risk: number
  confidence: number
  status: 'clear' | 'warning' | 'critical'
}

export type AgentScenarioPreset = {
  id: 'malicious-install' | 'safe-workflow'
  title: string
  summary: string
}

export type AgentRunStep = {
  stepId: string
  label: string
  toolName: string
  argumentsPreview: string
  blocked: boolean
  executed: boolean
  timestamp: string
  durationMs: number
  analysis: string
  decision: DetectionResponse
}

export type AgentDemoResponse = {
  runId: string
  model: string
  scenario: {
    id: string
    title: string
  }
  halted: boolean
  executeBlocked: boolean
  blockedCount: number
  allowedCount: number
  steps: AgentRunStep[]
  summary: string
}

export type CampaignDistribution = {
  key: string
  total: number
  blocked: number
}

export type CampaignCaseResult = {
  id: string
  label: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  decision: DetectionResponse
}

export type AdversaryCampaignResponse = {
  runId: string
  model: string
  totalCases: number
  blockedCases: number
  detectionRate: number
  typeDistribution: CampaignDistribution[]
  severityDistribution: CampaignDistribution[]
  topReasons: string[]
  cases: CampaignCaseResult[]
}
