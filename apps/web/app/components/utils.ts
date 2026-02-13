import type { DetectionResponse, PipelineStep } from './types'

export const MAX_UPLOAD_FILE_SIZE = 1024 * 1024

export const typeLabels: Record<string, string> = {
  prompt_injection: 'Prompt Injection',
  command_injection: 'Command Injection',
  path_traversal: 'Path Traversal',
  data_exfiltration: 'Data Exfiltration',
  code_injection: 'Code Injection',
}

export const severityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const clampRisk = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export const formatPercent = (value: number): string => `${(clampRisk(value) * 100).toFixed(1)}%`

export const formatTimestamp = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export const getStatus = (risk: number): PipelineStep['status'] => {
  if (risk >= 0.7) return 'critical'
  if (risk >= 0.35) return 'warning'
  return 'clear'
}

export const getRiskTone = (risk: number): string => {
  if (risk >= 0.7) return 'bg-ember'
  if (risk >= 0.35) return 'bg-warn'
  return 'bg-mint'
}

export const getRiskStrokeTone = (risk: number): string => {
  if (risk >= 0.7) return 'stroke-ember'
  if (risk >= 0.35) return 'stroke-warn'
  return 'stroke-mint'
}

export const buildPipeline = (data: DetectionResponse): PipelineStep[] => {
  const intel = data.evidence.find((entry) => /threat|intel/i.test(entry.detectorId))
  const rules = data.evidence.find((entry) => /rule/i.test(entry.detectorId))
  const llm = data.evidence.find((entry) => /llm|openai|gpt/i.test(entry.detectorId))

  return [
    {
      id: 'threat-intel',
      title: 'ThreatIntel',
      detail: intel ? `${intel.detectorId} 매칭 완료` : '위협 피드 매칭 없음',
      risk: intel?.risk ?? 0,
      confidence: intel?.confidence ?? 0,
      status: getStatus(intel?.risk ?? 0),
    },
    {
      id: 'rules',
      title: 'Rules',
      detail: rules ? `${rules.detectorId} 규칙 탐지` : '룰 기반 고위험 신호 없음',
      risk: rules?.risk ?? 0,
      confidence: rules?.confidence ?? 0,
      status: getStatus(rules?.risk ?? 0),
    },
    {
      id: 'llm',
      title: 'LLM',
      detail: llm ? `${llm.detectorId} 2차 분석` : 'LLM 2차 분석 신호 없음',
      risk: llm?.risk ?? 0,
      confidence: llm?.confidence ?? 0,
      status: getStatus(llm?.risk ?? 0),
    },
  ]
}
