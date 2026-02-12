import { AuditLogger, createDetectors, DecisionEngine, Guard } from '@sapper-ai/core'
import type { ThreatIntelEntry } from '@sapper-ai/core'
import type { AuditLogEntry, Decision, Policy, ToolCall, ToolResult } from '@sapper-ai/types'
import type {
  InputGuardrail,
  GuardrailFunctionOutput,
  ToolInputGuardrailDefinition,
  ToolOutputGuardrailDefinition,
  ToolGuardrailFunctionOutput,
} from '@openai/agents'

interface GuardrailOptions {
  logger?: { log: (entry: AuditLogEntry) => void }
  threatIntelEntries?: ThreatIntelEntry[]
}

function buildGuard(policy: Policy, options?: GuardrailOptions): Guard {
  const detectors = createDetectors({
    policy,
    threatIntelEntries: options?.threatIntelEntries,
  })
  const auditLogger = options?.logger
    ? ({ log: options.logger.log } as unknown as AuditLogger)
    : new AuditLogger()
  const decisionEngine = new DecisionEngine(detectors)
  return new Guard(decisionEngine, auditLogger, policy)
}

function blockReason(decision: Decision, fallback: string): string {
  return decision.evidence[0]?.reasons[0] || fallback
}

/**
 * Create a tool input guardrail that integrates SapperAI Guard with OpenAI Agents SDK.
 * The guardrail intercepts tool calls before execution and blocks malicious inputs.
 *
 * @param policy - Security policy configuration
 * @param options - Optional guardrail options (logger, threatIntelEntries)
 * @returns Guardrail handler function for testing and integration
 */
export function createToolInputGuardrail(policy: Policy, options?: GuardrailOptions) {
  const guard = buildGuard(policy, options)

  return async (toolCall: unknown) => {
    const decision = await guard.preTool(toolCall as ToolCall)

    if (decision.action === 'block') {
      throw new Error(`Tool call blocked: ${blockReason(decision, 'Security policy violation')}`)
    }
  }
}

/**
 * Create a tool output guardrail that integrates SapperAI Guard with OpenAI Agents SDK.
 * The guardrail intercepts tool results after execution and blocks malicious outputs.
 *
 * @param policy - Security policy configuration
 * @param options - Optional guardrail options (logger, threatIntelEntries)
 * @returns Guardrail handler function for testing and integration
 */
export function createToolOutputGuardrail(policy: Policy, options?: GuardrailOptions) {
  const guard = buildGuard(policy, options)

  return async (toolCall: unknown, toolResult: unknown) => {
    const decision = await guard.postTool(toolCall as ToolCall, toolResult as ToolResult)

    if (decision.action === 'block') {
      throw new Error(`Tool result blocked: ${blockReason(decision, 'Tool result blocked')}`)
    }
  }
}

/**
 * Create an SDK-compatible InputGuardrail that scans the agent's raw input
 * (user message text) through SapperAI detection before the model runs.
 *
 * Usage:
 * ```ts
 * const agent = new Agent({
 *   inputGuardrails: [createSapperInputGuardrail('sapper-input', policy)],
 * })
 * ```
 */
export function createSapperInputGuardrail(
  name: string,
  policy: Policy,
  options?: GuardrailOptions,
): InputGuardrail {
  const guard = buildGuard(policy, options)

  return {
    name,
    execute: async ({ input }): Promise<GuardrailFunctionOutput> => {
      const text = typeof input === 'string' ? input : JSON.stringify(input)
      const syntheticToolCall: ToolCall = {
        toolName: '__agent_input__',
        arguments: { text },
      }
      const decision = await guard.preTool(syntheticToolCall)

      return {
        tripwireTriggered: decision.action === 'block',
        outputInfo: {
          risk: decision.risk,
          confidence: decision.confidence,
          reasons: decision.reasons,
          evidence: decision.evidence,
        },
      }
    },
  }
}

/**
 * Create an SDK-compatible ToolInputGuardrailDefinition that scans tool
 * arguments before tool execution.
 *
 * Usage:
 * ```ts
 * const myTool = tool({ ..., inputGuardrails: [createSapperToolInputGuardrail('sapper-tool-input', policy)] })
 * ```
 */
export function createSapperToolInputGuardrail(
  name: string,
  policy: Policy,
  options?: GuardrailOptions,
): ToolInputGuardrailDefinition {
  const guard = buildGuard(policy, options)

  return {
    name,
    type: 'tool_input' as const,
    run: async ({ toolCall: sdkToolCall }): Promise<ToolGuardrailFunctionOutput> => {
      let parsedArgs: unknown
      try {
        parsedArgs = sdkToolCall.arguments ? JSON.parse(sdkToolCall.arguments) : {}
      } catch {
        parsedArgs = { raw: sdkToolCall.arguments }
      }

      const sapperToolCall: ToolCall = {
        toolName: sdkToolCall.name,
        arguments: parsedArgs,
      }

      const decision = await guard.preTool(sapperToolCall)
      const outputInfo = {
        risk: decision.risk,
        confidence: decision.confidence,
        reasons: decision.reasons,
        evidence: decision.evidence,
      }

      if (decision.action === 'block') {
        return {
          outputInfo,
          behavior: {
            type: 'rejectContent' as const,
            message: `Tool call blocked: ${blockReason(decision, 'Security policy violation')}`,
          },
        }
      }

      return { outputInfo, behavior: { type: 'allow' as const } }
    },
  }
}

/**
 * Create an SDK-compatible ToolOutputGuardrailDefinition that scans tool
 * results after tool execution.
 *
 * Usage:
 * ```ts
 * const myTool = tool({ ..., outputGuardrails: [createSapperToolOutputGuardrail('sapper-tool-output', policy)] })
 * ```
 */
export function createSapperToolOutputGuardrail(
  name: string,
  policy: Policy,
  options?: GuardrailOptions,
): ToolOutputGuardrailDefinition {
  const guard = buildGuard(policy, options)

  return {
    name,
    type: 'tool_output' as const,
    run: async ({ toolCall: sdkToolCall, output }): Promise<ToolGuardrailFunctionOutput> => {
      let parsedArgs: unknown
      try {
        parsedArgs = sdkToolCall.arguments ? JSON.parse(sdkToolCall.arguments) : {}
      } catch {
        parsedArgs = { raw: sdkToolCall.arguments }
      }

      const sapperToolCall: ToolCall = {
        toolName: sdkToolCall.name,
        arguments: parsedArgs,
      }

      const sapperToolResult: ToolResult = {
        content: output,
      }

      const decision = await guard.postTool(sapperToolCall, sapperToolResult)
      const outputInfo = {
        risk: decision.risk,
        confidence: decision.confidence,
        reasons: decision.reasons,
        evidence: decision.evidence,
      }

      if (decision.action === 'block') {
        return {
          outputInfo,
          behavior: {
            type: 'rejectContent' as const,
            message: `Tool result blocked: ${blockReason(decision, 'Tool result blocked')}`,
          },
        }
      }

      return { outputInfo, behavior: { type: 'allow' as const } }
    },
  }
}
