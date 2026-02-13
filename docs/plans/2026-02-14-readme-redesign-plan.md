# SapperAI README Redesign Plan

**Date**: 2026-02-14
**Scope**: Root `README.md` only
**Goal**: Improve first-time user comprehension and copy-pasteable quick starts without changing product claims

---

## 1. Context

The current root `README.md` contains correct information, but the most important paths ("how do I try this in 60 seconds?") are buried in a long document.
This plan restructures the README so that:

- The single-install experience (`sapper-ai`) is the default entry point.
- MCP proxy usage and OpenAI Agents integration remain first-class alternatives.
- Existing metrics/claims remain unchanged (no new numbers, no new benchmarks).
- All commands match the package READMEs (`packages/*/README.md`).

---

## 2. Non-goals

- No code changes.
- No changes to package READMEs (only root README).
- No new external links that require guessing repo/org names (e.g., badges that embed a GitHub slug).
- No new performance/detection claims.
- No new images/GIFs (only text and code blocks).

---

## 3. Target README Structure

### 3.1 Top section

- One-line description (keep current meaning)
- 3 bullet "what it protects" (prompt injection / command injection / exfiltration)
- A compact "Quick start" with 3 options

### 3.2 Quick start options (copy-pasteable)

1. **Single install (recommended):** `pnpm add sapper-ai` + minimal `createGuard()` example
2. **MCP proxy (no code):** `pnpm add @sapper-ai/mcp` + `sapperai-proxy ...` commands
3. **OpenAI Agents SDK:** `pnpm add @sapper-ai/openai` + `createToolInputGuardrail(...)` example

### 3.3 The rest

- Architecture diagram (keep existing diagram; move below quick start)
- Packages table (keep, update if needed to include `sapper-ai`)
- Detection capabilities (keep categories and wording; keep educational suppression note)
- Performance + verified metrics (keep existing numbers; move together)
- Development commands (keep)
- Operations docs links (keep)
- License (keep)

---

## 4. Implementation Steps

1. Rewrite the root `README.md` headings to match the target structure.
2. Insert a new "Single install" quick start path using `packages/sapper-ai/README.md` as the source of truth.
3. Keep existing MCP/OpenAI/direct integration blocks, but align them with:
   - `packages/mcp/README.md` for CLI commands
   - `packages/openai/README.md` for guardrail usage
   - `packages/core/README.md` for direct integration wording
4. Ensure all examples are internally consistent (package names, tool names, CLI names).
5. Run a repo build/test pass to ensure nothing was accidentally broken by documentation edits.

---

## 5. Acceptance Criteria

- Root `README.md` has a clear, top-level quick start with `sapper-ai` + alternatives.
- No new metrics or claims were introduced; existing numbers remain unchanged.
- All commands in root `README.md` match the corresponding package READMEs.
- Markdown renders cleanly (no broken fenced blocks).
