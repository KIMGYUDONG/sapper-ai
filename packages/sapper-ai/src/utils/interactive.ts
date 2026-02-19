import { isCiEnv } from './env'

export type InteractivePromptReason = 'no_prompt_flag' | 'ci_env' | 'stdout_not_tty' | 'stdin_not_tty'

export interface InteractivePromptCheckInput {
  noPrompt?: boolean
  env?: NodeJS.ProcessEnv
  stdoutIsTTY?: boolean
  stdinIsTTY?: boolean
  checkCi?: boolean
}

export interface InteractivePromptCheckResult {
  allowed: boolean
  reasons: InteractivePromptReason[]
}

export function getInteractivePromptState(input: InteractivePromptCheckInput = {}): InteractivePromptCheckResult {
  const reasons: InteractivePromptReason[] = []

  if (input.noPrompt === true) {
    reasons.push('no_prompt_flag')
  }

  if ((input.checkCi ?? true) && isCiEnv(input.env ?? process.env)) {
    reasons.push('ci_env')
  }

  const stdoutIsTTY = input.stdoutIsTTY ?? process.stdout.isTTY
  if (stdoutIsTTY !== true) {
    reasons.push('stdout_not_tty')
  }

  const stdinIsTTY = input.stdinIsTTY ?? process.stdin.isTTY
  if (stdinIsTTY !== true) {
    reasons.push('stdin_not_tty')
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  }
}

export function formatInteractivePromptReasons(reasons: readonly InteractivePromptReason[]): string {
  return reasons.length > 0 ? reasons.join(', ') : 'unknown'
}
