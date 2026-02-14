# `npx sapper-ai scan` — createDetectors 에러 수정

## Context

`npx sapper-ai scan` 실행 시 `(0 , core_1.createDetectors) is not a function` 에러 발생.
`@sapper-ai/core@0.2.0`이 불완전한 dist로 publish되어 `createDetectors` 등 다수 export가 누락됨.
수정 버전(`core@0.2.1`, `sapper-ai@0.2.2`)은 이미 publish되었으나, 깨진 버전을 deprecate하고 재발을 방지해야 함.

### NPM Registry 상태

| Package | core 의존성 | createDetectors |
|---|---|---|
| `sapper-ai@0.2.1` | `core@0.2.0` | **없음** |
| `sapper-ai@0.2.2` (latest) | `core@0.2.1` | 있음 |

## TODO

### 1. 깨진 NPM 버전 deprecate

```bash
npm deprecate "@sapper-ai/core@0.2.0" "Incomplete build – missing createDetectors and other exports. Use >=0.2.1"
npm deprecate "sapper-ai@0.2.1" "Depends on broken @sapper-ai/core@0.2.0. Use >=0.2.2"
```

### 2. re-export 완전성 smoke test 추가

- **파일**: `packages/sapper-ai/src/__tests__/exports.test.ts` (신규)
- **목적**: `index.ts`에서 re-export하는 모든 named export가 `undefined`가 아닌지 검증
- **패턴**: 기존 테스트 (`createGuard.test.ts` 등)와 동일한 vitest 패턴 사용
- **검증 대상** (`packages/sapper-ai/src/index.ts` 라인 4-17):
  - `Guard`, `DecisionEngine`, `RulesDetector`, `LlmDetector`, `ThreatIntelDetector`
  - `createDetectors`, `AuditLogger`, `PolicyManager`, `validatePolicy`
  - `Scanner`, `QuarantineManager`, `ThreatIntelStore`
  - `createGuard`, `presets`
- **테스트 내용**:
  ```typescript
  import { describe, expect, it } from 'vitest'
  import * as sapperAi from '../index'

  describe('exports completeness', () => {
    it.each([
      ['createGuard'],
      ['presets'],
      ['Guard'],
      ['DecisionEngine'],
      ['RulesDetector'],
      ['LlmDetector'],
      ['ThreatIntelDetector'],
      ['createDetectors'],
      ['AuditLogger'],
      ['PolicyManager'],
      ['validatePolicy'],
      ['Scanner'],
      ['QuarantineManager'],
      ['ThreatIntelStore'],
    ])('%s is exported and defined', (name) => {
      expect(sapperAi[name as keyof typeof sapperAi]).toBeDefined()
    })
  })
  ```

### 3. 사용자 즉시 해결 안내

```bash
npx sapper-ai@latest scan
```

## Verification

```bash
# 1. deprecation 적용 확인
npm view @sapper-ai/core@0.2.0 deprecated
npm view sapper-ai@0.2.1 deprecated

# 2. 테스트 통과
pnpm --filter sapper-ai test

# 3. 최신 버전 scan 정상 동작
npx sapper-ai@latest scan
```
