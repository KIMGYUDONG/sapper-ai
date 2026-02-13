# SapperAI Developer Experience (DX) Improvement Plan

**Date**: 2026-02-13
**Stage**: Post-publish (npm v0.2.0)
**Author**: SapperAI Founding Team

---

## 1. Executive Summary

SapperAI는 강력한 탐지 엔진(737K ops/sec, 96% 탐지율, 0% 오탐)을 보유하고 있으나, **첫 사용자 경험(DX)이 경쟁 서비스 대비 복잡하다**. 현재는 모노레포 구조의 4개 패키지를 개별 이해해야 하고, 정책은 YAML/JSON을 수동 작성해야 하며, 모니터링 대시보드가 없다.

업계 표준 서비스 8개를 벤치마킹한 결과, 성공하는 서비스의 공통 패턴은 **원커맨드 설치, 웹 대시보드, 프리셋 카탈로그**이다. 이 문서는 SapperAI의 DX를 업계 수준으로 끌어올리기 위한 로드맵을 정의한다.

### 목표

```
현재: git clone → pnpm install → pnpm build → YAML 수동 작성 → CLI 실행 (~15분)
목표: pnpm add sapper-ai → npx sapper-ai init → 대시보드 확인 (~3분)
```

---

## 2. Competitive Landscape Analysis

### 2.1 벤치마킹 대상 (8개 서비스)

| 서비스 | 유형 | 설치 방식 | 첫 사용까지 | 웹 대시보드 | 정책 설정 |
|--------|------|----------|------------|-----------|----------|
| **Lakera Guard** | SaaS API | API 키 발급 | ~3분 | ✅ 상세 | 웹 UI 프로젝트별 |
| **Guardrails AI** | OSS Framework | `pip install guardrails-ai` | ~5분 | ✅ 모니터링 | Python + Hub 67+ validators |
| **Pangea AI Guard** | SaaS API | SDK/REST | ~3분 | ✅ Console | Recipe 기반 75+ 규칙 |
| **Lasso Security** | Gateway | `pip install mcp-gateway` | ~5분 | ✅ 실시간 | 웹 UI + 플러그인 |
| **NeMo Guardrails** | OSS Framework | `pip install nemoguardrails` | ~10분 | ❌ API 문서만 | Colang DSL + YAML |
| **Rebuff** | OSS SDK | `pip install rebuff` | ~5분 | ✅ Playground | 코드 내 설정 |
| **Arthur Shield** | Enterprise | 인프라 설정 | ~30분+ | ⚠️ Self-hosted | 규칙 기반 |
| **LlamaGuard** | OSS Model | `pip install transformers` | ~20분+ | ❌ | 프롬프트 기반 |
| **SapperAI (현재)** | OSS Framework | 모노레포 빌드 | ~15분+ | ⚠️ 데모만 | YAML/JSON 수동 |

### 2.2 성공 서비스의 공통 패턴

**Pattern 1: 원커맨드 설치**
- Lakera: API 키 하나로 즉시 시작 (설치 불필요)
- Guardrails AI: `pip install guardrails-ai` → `guardrails hub install`
- Pangea: SDK 설치 or REST API 직접 호출
- **핵심**: 3분 이내에 첫 번째 보안 검사 실행 가능

**Pattern 2: 웹 대시보드 필수**
- Lakera: 요청 볼륨, 위협 통계, 지연시간, 프로젝트별 비교, 정책 설정
- Guardrails AI: Request Traces, 규칙 트리거 모니터링, YAML Config 탭
- Pangea: Overview, Activity Log, Recipe 관리, API 자격증명
- **핵심**: 대시보드 없는 서비스(NeMo, LlamaGuard)는 채택률이 현저히 낮음

**Pattern 3: 프리셋/마켓플레이스**
- Guardrails AI: 67+ validator Hub (카테고리별 분류, 인증 시스템)
- Pangea: 75+ 분류 규칙 Recipe (조합 선택)
- Lakera: 사전 정의된 정책 카탈로그 (Public-facing App 등)
- **핵심**: 사용자가 처음부터 규칙을 작성할 필요 없음

**Pattern 4: 프리 티어**
- Lakera: 월 10,000 API 호출 무료
- Guardrails AI: 완전 오픈소스 무료
- Pangea: 종량제 (소량 무료)
- Arthur Shield: Free-forever 플랜

### 2.3 SapperAI의 현재 문제점

| 문제 | 상세 | 영향 |
|------|------|------|
| **설치 복잡** | 4개 패키지(types/core/mcp/openai) 개별 이해 필요 | 첫 사용자 이탈 |
| **정책 작성 어려움** | YAML/JSON 수동 작성, 옵션 파악 어려움 | 잘못된 설정으로 보안 구멍 |
| **대시보드 없음** | 데모앱은 있지만 실제 관리 도구 아님 | 운영 가시성 부재 |
| **프리셋 없음** | 매번 처음부터 정책 작성 | 시작 비용 높음 |
| **CLI 위저드 없음** | 수동 설정 파일 생성 | 오타/누락 위험 |

---

## 3. Improvement Roadmap

### Phase 1: 통합 패키지 + CLI 위저드 (P0)

#### 3.1 통합 패키지 `sapper-ai`

**목표**: `pnpm add sapper-ai` 한 줄로 모든 핵심 기능 사용 가능

**구조**:
```
packages/sapper-ai/          # 새 통합 패키지
├── src/
│   ├── index.ts              # 통합 API re-export
│   ├── presets.ts            # 프리셋 정책 카탈로그
│   └── cli/
│       ├── init.ts           # npx sapper-ai init
│       └── dashboard.ts      # npx sapper-ai dashboard
├── package.json              # name: "sapper-ai"
└── README.md
```

**사용자 경험**:
```typescript
// 설치
// pnpm add sapper-ai

// 3줄로 시작
import { createGuard } from 'sapper-ai'

const guard = createGuard()  // 기본 정책 자동 적용 (balanced 프리셋)
const decision = await guard.check(toolCall)

// MCP 프록시 사용 시
import { createProxy } from 'sapper-ai/mcp'

// OpenAI Agent SDK 사용 시
import { createSapperToolInputGuardrail } from 'sapper-ai/openai'
```

**내부 구현**:
- `@sapper-ai/core`, `@sapper-ai/types`를 dependency로 포함
- `@sapper-ai/mcp`, `@sapper-ai/openai`는 optional peer dependency
- `createGuard()`: Guard + DecisionEngine + AuditLogger를 한 번에 생성
- 기본 정책: `{ mode: 'enforce', defaultAction: 'allow', failOpen: true, detectors: ['rules'] }`

#### 3.2 CLI 위저드 `npx sapper-ai init`

**목표**: 대화형 위저드로 프로젝트 초기 설정 자동화

**플로우**:
```
$ npx sapper-ai init

🛡️ SapperAI Setup

? Protection mode:
  ❯ enforce (auto-block threats)
    monitor (log only, no blocking)

? Detectors:
  ❯ [x] rules (pattern-based, recommended)
    [ ] llm (AI deep analysis, requires API key)
    [ ] threat-intel (threat feed integration)

? Integration:
  ❯ MCP Proxy (Claude Code, etc.)
    OpenAI Agents SDK
    Core Library (custom)

? Risk threshold: (0.7)
? Block min confidence: (0.5)

✅ Created: sapperai.config.yaml
✅ Run: npx sapper-ai dashboard
```

**생성 파일**: `sapperai.config.yaml`
```yaml
# SapperAI Configuration
# Generated by: npx sapper-ai init
# Docs: https://github.com/user/SapperAI

mode: enforce
defaultAction: allow
failOpen: true

detectors:
  - rules

thresholds:
  riskThreshold: 0.7
  blockMinConfidence: 0.5

# Uncomment to enable:
# llm:
#   provider: openai
#   model: gpt-4.1-mini
# threatFeed:
#   enabled: true
#   sources: []
```

### Phase 2: 프리셋 정책 카탈로그 (P1)

**목표**: 사전 정의된 정책으로 즉시 시작

```typescript
import { createGuard, presets } from 'sapper-ai'

// 프리셋 목록
const guard = createGuard(presets.strict)       // 최대 보안: 낮은 threshold, 모든 detector
const guard = createGuard(presets.balanced)      // 균형 (기본값, 추천)
const guard = createGuard(presets.permissive)    // 최소 간섭: 높은 threshold, rules-only
const guard = createGuard(presets.claudeCode)    // Claude Code/MCP 특화
const guard = createGuard(presets.agentSdk)      // OpenAI Agent SDK 특화
```

**프리셋 정의**:

| 프리셋 | mode | riskThreshold | blockMinConfidence | detectors | 용도 |
|--------|------|---------------|-------------------|-----------|------|
| `strict` | enforce | 0.5 | 0.4 | rules + llm + threat-intel | 금융/의료 등 고보안 |
| `balanced` | enforce | 0.7 | 0.5 | rules | 일반 프로덕션 (기본값) |
| `permissive` | enforce | 0.85 | 0.7 | rules | 개발/테스트 환경 |
| `claudeCode` | enforce | 0.7 | 0.5 | rules + threat-intel | MCP 프록시 통합 |
| `agentSdk` | enforce | 0.7 | 0.5 | rules | OpenAI Agent SDK 통합 |
| `monitor` | monitor | 0.7 | 0.5 | rules | 모니터링 전용 (차단 없음) |

### Phase 3: 웹 대시보드 (P1-P2)

**목표**: 기존 `apps/web`을 데모 + 실제 관리 도구로 발전

**실행 방식**:
```bash
npx sapper-ai dashboard
# → http://localhost:4100 에서 대시보드 열림
```

#### 3.3.1 Dashboard 탭 (P1)

| 메트릭 | 설명 |
|--------|------|
| Total Requests | 전체 검사 요청 수 |
| Blocked | 차단된 요청 수 및 비율 |
| Avg Latency | 평균 검사 소요 시간 |
| Top Threats | 가장 많이 탐지된 위협 유형 |
| Timeline | 시간별 요청/차단 추이 그래프 |

#### 3.3.2 Policy Editor 탭 (P1)

**참고 모델**: Lakera Guard 정책 설정 UI

```
┌─────────────────────────────────────────────┐
│ Policy Configuration                         │
├─────────────────────────────────────────────┤
│                                              │
│ Mode:     [● Enforce] [○ Monitor]           │
│                                              │
│ Detectors:                                   │
│   [✓] Rules (pattern-based)                 │
│   [ ] LLM (AI analysis)                     │
│   [ ] Threat Intel (feed-based)             │
│                                              │
│ Thresholds:                                  │
│   Risk:       [====●======] 0.7             │
│   Confidence: [==●========] 0.5             │
│                                              │
│ Presets: [Strict] [Balanced✓] [Permissive]  │
│                                              │
│ [Save Policy]  [Export YAML]  [Test Policy] │
└─────────────────────────────────────────────┘
```

- GUI로 정책 수정 → `sapperai.config.yaml` 자동 업데이트
- "Test Policy" 버튼으로 즉시 공격 시뮬레이션
- YAML 내보내기/가져오기 지원

#### 3.3.3 Audit Log 탭 (P2)

**참고 모델**: Pangea Activity Log

| 컬럼 | 내용 |
|------|------|
| Timestamp | 요청 시각 |
| Tool | 검사된 도구명 |
| Action | allow / block |
| Risk | 위험도 점수 |
| Confidence | 신뢰도 점수 |
| Reasons | 차단/허용 사유 |
| Detector | 트리거된 탐지기 |
| Duration | 검사 소요 시간 |

- 필터링: 날짜, 액션(block/allow), 탐지기, 위험도 범위
- 개별 로그 클릭 → 상세 증거(evidence) 확인
- CSV/JSON 내보내기

#### 3.3.4 Threat Intel 탭 (P2)

- 피드 소스 관리 (추가/삭제/동기화)
- 블록리스트 현황 (항목 수, 마지막 동기화 시각)
- 개별 인디케이터 검색 및 상세 정보
- 동기화 로그

#### 3.3.5 Campaign 탭 (기존 유지)

- 현재 `apps/web`의 적대 캠페인 기능 그대로 유지
- 대시보드 내에서 원클릭 캠페인 실행

---

## 4. Architecture Changes

### 4.1 새 패키지 구조

```
SapperAI/
├── packages/
│   ├── types/           → (변경 없음)
│   ├── core/            → (변경 없음)
│   ├── mcp/             → (변경 없음)
│   ├── openai/          → (변경 없음)
│   └── sapper-ai/       → 🆕 통합 패키지 (npm: "sapper-ai")
│       ├── src/
│       │   ├── index.ts          # createGuard, presets re-export
│       │   ├── presets.ts        # 프리셋 정책 정의
│       │   ├── cli/
│       │   │   ├── index.ts      # CLI 진입점
│       │   │   ├── init.ts       # init 위저드
│       │   │   └── dashboard.ts  # dashboard 런처
│       │   ├── mcp.ts            # @sapper-ai/mcp re-export
│       │   └── openai.ts         # @sapper-ai/openai re-export
│       └── package.json
│           name: "sapper-ai"
│           bin: { "sapper-ai": "./dist/cli/index.js" }
│           dependencies: @sapper-ai/core, @sapper-ai/types
│           optionalDependencies: @sapper-ai/mcp, @sapper-ai/openai
├── apps/
│   └── web/             → 대시보드로 발전 (기존 데모 기능 유지)
```

### 4.2 의존성 체인 (업데이트)

```
types → core → mcp
              → openai
              → sapper-ai (통합) → mcp (optional)
                                  → openai (optional)
                                  → web (dashboard)
```

---

## 5. User Journey (목표 상태)

### 5.1 신규 사용자 (개발자)

```
1. pnpm add sapper-ai                     # 설치 (~10초)
2. npx sapper-ai init                      # 대화형 설정 (~1분)
3. 코드에 import { createGuard }           # 3줄 통합 (~1분)
4. npx sapper-ai dashboard                 # 대시보드 확인
   ─────────────────────────────────────
   총 소요 시간: ~3분
```

### 5.2 MCP 사용자 (Claude Code 등)

```
1. pnpm add sapper-ai                     # 설치
2. npx sapper-ai init --integration mcp   # MCP 모드 설정
3. sapperai-proxy --config sapperai.config.yaml -- <mcp-server>
4. npx sapper-ai dashboard                # 실시간 모니터링
```

### 5.3 OpenAI Agent SDK 사용자

```
1. pnpm add sapper-ai                     # 설치
2. npx sapper-ai init --integration agent-sdk
3. import { createSapperToolInputGuardrail } from 'sapper-ai/openai'
4. Agent에 guardrail 연결
5. npx sapper-ai dashboard                # 실시간 모니터링
```

---

## 6. Implementation Priority

| Phase | 항목 | 임팩트 | 난이도 | 예상 기간 |
|-------|------|--------|-------|----------|
| **P0** | 통합 패키지 `sapper-ai` | 매우 높음 | 낮음 | 1-2일 |
| **P0** | `createGuard()` 간소화 API | 매우 높음 | 낮음 | 0.5일 |
| **P0** | `npx sapper-ai init` CLI 위저드 | 매우 높음 | 중간 | 1-2일 |
| **P1** | 프리셋 정책 카탈로그 (6개) | 높음 | 낮음 | 0.5일 |
| **P1** | 대시보드 - Policy Editor | 높음 | 높음 | 3-5일 |
| **P1** | 대시보드 - Dashboard 메트릭 | 높음 | 높음 | 3-5일 |
| **P2** | 대시보드 - Audit Log | 중간 | 중간 | 2-3일 |
| **P2** | 대시보드 - Threat Intel 관리 | 중간 | 중간 | 2-3일 |
| **P2** | `npx sapper-ai dashboard` 런처 | 중간 | 낮음 | 0.5일 |

---

## 7. Success Metrics

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| 설치 → 첫 검사 시간 | ~15분 | < 3분 |
| 설치 단계 수 | 5-6단계 | 2-3단계 |
| 정책 설정에 필요한 지식 | YAML + 옵션 숙지 | GUI 또는 프리셋 선택 |
| 모니터링 가능 여부 | 감사 로그 파일만 | 웹 대시보드 |
| npm install 명령 | `@sapper-ai/core` + `@sapper-ai/types` | `sapper-ai` |

---

## 8. Competitive Positioning

### 8.1 SapperAI의 차별화 포인트 (유지)

이 DX 개선은 기존 강점을 유지하면서 접근성만 높이는 것이다:

| 강점 | 현재 | 개선 후 |
|------|------|--------|
| **초고속 성능** (p99 0.0018ms) | ✅ | ✅ 유지 |
| **Tool Layer 보안 특화** | ✅ | ✅ 유지 |
| **MCP 프로토콜 네이티브** | ✅ | ✅ + 쉬운 설정 |
| **OpenAI Agent SDK 통합** | ✅ | ✅ + 쉬운 설정 |
| **적대 캠페인 시뮬레이션** | ✅ | ✅ + 대시보드 통합 |
| **한국어 탐지 패턴** | ✅ | ✅ 유지 |
| **쉬운 설치** | ❌ | ✅ 원커맨드 |
| **웹 대시보드** | ❌ | ✅ 정책 + 모니터링 |
| **프리셋 정책** | ❌ | ✅ 6개 프리셋 |

### 8.2 경쟁 서비스 대비 포지셔닝

```
                    쉬운 사용 ────────────────► 어려운 사용
                    │
        SaaS API    │  Lakera ·· Pangea
                    │
      OSS + 대시보드 │  Guardrails AI ·· Lasso
                    │
   SapperAI (목표)  │  ★ SapperAI (DX 개선 후)
                    │
      OSS + CLI     │  NeMo ·· SapperAI (현재) ·· Rebuff
                    │
       모델 기반    │  LlamaGuard ·· Arthur Shield
                    │
                    Tool Layer 보안 ──────────► Prompt I/O 보안
```

**SapperAI의 목표 포지션**: Tool Layer 보안 특화 + Guardrails AI 수준의 DX

---

## Appendix A: Research Sources

### Lakera Guard
- [Getting Started](https://docs.lakera.ai/docs/quickstart)
- [Dashboard Documentation](https://docs.lakera.ai/docs/platform)
- [Guard API](https://docs.lakera.ai/docs/api/guard)

### Guardrails AI
- [Quickstart Guide](https://www.guardrailsai.com/docs/getting_started/quickstart)
- [Guardrails Hub](https://guardrailsai.com/hub) (67+ validators)
- [AI Guardrails Index](https://index.guardrailsai.com/download)

### NVIDIA NeMo Guardrails
- [Installation Guide](https://docs.nvidia.com/nemo/guardrails/latest/getting-started/installation-guide.html)
- [CLI Documentation](https://docs.nvidia.com/nemo/guardrails/latest/user-guides/cli.html)
- [Colang Language Guide](https://docs.nvidia.com/nemo/guardrails/latest/user-guides/colang-language-syntax-guide.html)

### Pangea AI Guard
- [AI Guard Overview](https://pangea.cloud/docs/ai-guard/overview)
- [Integration Guide](https://docs.nvidia.com/nemo/guardrails/latest/user-guides/community/pangea.html)

### Lasso Security
- [MCP Gateway (OSS)](https://github.com/lasso-security/mcp-gateway)
- [Enterprise Platform](https://www.lasso.security/)

### Others
- [Rebuff GitHub](https://github.com/protectai/rebuff)
- [Arthur Shield Quickstart](https://shield.docs.arthur.ai/docs/arthur-shield-quickstart)
- [LlamaGuard on HuggingFace](https://huggingface.co/meta-llama/Llama-Guard-3-8B)
- [ProtectAI Guardian](https://protectai.com/guardian)

### Market Analysis
- [AI Guardrails Platforms Comparison (SlashLLM)](https://slashllm.com/resources/platforms-comparison)
- [Enterprise AI Security Predictions 2026 (Lasso)](https://www.lasso.security/blog/enterprise-ai-security-predictions-2026)
- [Top 10 AI Security Tools (AppSecSanta)](https://appsecsanta.com/ai-security-tools)
