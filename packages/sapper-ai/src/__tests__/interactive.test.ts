import { describe, expect, it } from 'vitest'

import { formatInteractivePromptReasons, getInteractivePromptState } from '../utils/interactive'

describe('interactive prompt utility', () => {
  it('allows prompts when no blocking reason exists', () => {
    const state = getInteractivePromptState({
      noPrompt: false,
      env: {},
      stdoutIsTTY: true,
      stdinIsTTY: true,
    })

    expect(state.allowed).toBe(true)
    expect(state.reasons).toEqual([])
  })

  it('returns all blocking reasons in a stable order', () => {
    const state = getInteractivePromptState({
      noPrompt: true,
      env: { CI: 'true' },
      stdoutIsTTY: false,
      stdinIsTTY: false,
    })

    expect(state.allowed).toBe(false)
    expect(state.reasons).toEqual(['no_prompt_flag', 'ci_env', 'stdout_not_tty', 'stdin_not_tty'])
    expect(formatInteractivePromptReasons(state.reasons)).toBe('no_prompt_flag, ci_env, stdout_not_tty, stdin_not_tty')
  })

  it('can skip CI checks when requested', () => {
    const state = getInteractivePromptState({
      env: { CI: 'true' },
      stdoutIsTTY: true,
      stdinIsTTY: true,
      checkCi: false,
    })

    expect(state.allowed).toBe(true)
    expect(state.reasons).toEqual([])
  })
})
