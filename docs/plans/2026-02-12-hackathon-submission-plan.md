# Hackathon Submission Plan

## Context

- **Event**: 조코딩 x OpenAI x Primer AI 해커톤
- **Deadline**: 2026-02-20 (D-8)
- **Deliverables**: 제품/서비스 주소 (deployed) + 3분 데모 영상
- **Team**: Solo (김규동)
- **Current Status**: Core engine + MCP proxy + Web demo (Vercel deployed)
- **First Impression**: 8/8 "와우" (100%)

## Vision

> "설치하면 알아서 작동하는 AI 에이전트용 방화벽"
> - 위험 감지 시 사용자에게 알리고 선택권 제공
> - 멀티 플랫폼 (Claude Code plugin, MCP proxy, npm, web)

## Strategy

**Storyline**: "AI 에이전트가 스킬을 자유롭게 다운받는 시대, 보안은 누가 책임지나?"

### Demo Scenarios (3)

| # | Scenario | OpenAI Usage | Medium |
|---|----------|-------------|--------|
| 1 | Malicious skill install blocked | OpenAI Agent tries to install skill → SapperAI auto-blocks | Web + Plugin |
| 2 | Real-time prompt injection detection | RulesDetector + GPT-4.1-mini 2nd-layer analysis | Web demo |
| 3 | Adversary campaign simulation | OpenAI-powered attack simulation → auto-report | Web or CLI |

### OpenAI Integration Points

- **OpenAI Agents SDK**: Agent with SapperAI guardrails demo
- **GPT-4.1-mini**: LlmDetector 2nd-layer analysis engine
- **Responses API**: Real-time threat analysis explanation on web demo

## Implementation Plan

### Part 1: Web Demo Enhancement (D-8 ~ D-6)

#### 1-1. OpenAI Agent Live Demo Page

- OpenAI Agents SDK agent executing tools in real-time
- Visual pipeline: each tool call inspected by SapperAI
- Malicious request → block alert + "Execute anyway?" UX
- GPT-4.1-mini analysis result shown in natural language

#### 1-2. Detection Result Visualization

- Current: Raw JSON Decision output
- Improved: Risk gauge, step-by-step pipeline viz (ThreatIntel → Rules → LLM), timeline

#### 1-3. Adversary Campaign Demo

- One-click attack simulation
- Dashboard: detection rate, type distribution, severity chart

### Part 2: Claude Code Plugin (D-5 ~ D-4)

```
.claude/plugins/sapperai/
├── plugin.json
├── hooks/
│   ├── pre-tool-use.sh   # PreToolUse → Guard.preTool()
│   └── post-tool-use.sh  # PostToolUse → Guard.postTool()
└── commands/
    └── sapperai-status.md
```

- Zero-config: install plugin → all tool calls auto-guarded
- Alert + choice on block (hook approval flow)
- OpenAI LlmDetector integration for 2nd-layer analysis

### Part 3: Integration & Polish (D-3 ~ D-2)

- End-to-end testing
- Adversary campaign demo integration
- Performance optimization for web demo
- Edge case handling

### Part 4: Demo Video (D-1)

- 3-minute script:
  - 0:00-0:30 Problem statement (AI agents downloading skills freely)
  - 0:30-1:30 Live demo: malicious skill blocked in real-time
  - 1:30-2:20 Web dashboard: detection pipeline visualization + adversary campaign
  - 2:20-2:50 Claude Code plugin: "install and forget" experience
  - 2:50-3:00 Closing: vision + call to action

## Schedule

| Date | Task |
|------|------|
| D-8~D-6 (2/12~14) | Web demo: OpenAI Agent demo page + visualization |
| D-5~D-4 (2/15~16) | Claude Code plugin MVP + OpenAI LlmDetector |
| D-3~D-2 (2/17~18) | Integration testing + adversary campaign demo |
| D-1 (2/19) | Demo video recording/editing |
| D-day (2/20) | Submit |

## Key Metrics to Showcase

- 96% detection rate (50 malicious samples)
- 0% false positive (100 benign + 20 edge cases)
- 737K ops/sec RulesDetector throughput
- Sub-millisecond p99 latency
- 60+ built-in detection rules
- 3-layer detection pipeline (ThreatIntel → Rules → LLM)
