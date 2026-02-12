import { coreVersion } from '@sapper-ai/core'

export const openaiVersion = coreVersion

export {
  createToolInputGuardrail,
  createToolOutputGuardrail,
  createSapperInputGuardrail,
  createSapperToolInputGuardrail,
  createSapperToolOutputGuardrail,
} from './guardrails'
