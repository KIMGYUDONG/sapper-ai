# Scan CLI UX Redesign

## Context

`npx sapper-ai scan` 실행 시 아무 피드백 없이 종료되어 사용자가 작동 여부를 알 수 없음.
스캔 범위도 고정되어 있어 유연성이 부족함. 진행 상황 시각화 + 범위 선택 + 결과 테이블을 추가한다.

## 수정 대상 파일

- `packages/sapper-ai/src/scan.ts` — 메인 스캔 로직
- `packages/sapper-ai/src/cli.ts` — CLI 파싱 (플래그 추가)

## TODO

### 1. 스캔 범위 선택 UX

**cli.ts에 플래그 추가:**

```
npx sapper-ai scan              # 인터랙티브 선택 (TTY일 때)
npx sapper-ai scan .            # 현재 폴더만 (하위 제외)
npx sapper-ai scan --deep       # 현재 폴더 + 하위 재귀
npx sapper-ai scan --system     # AI 관련 경로 전체
npx sapper-ai scan ./path       # 지정 경로 (기존 동작 유지)
```

**인터랙티브 프롬프트 (플래그 없이 실행 시):**

```
  SapperAI Security Scanner

  ? Scan scope:
  ❯ Current directory only     ~/code/my-project
    Current + subdirectories    ~/code/my-project/**
    AI system scan              ~/.claude, ~/.cursor, ~/.vscode ...
```

- `readline` 기반으로 구현 (외부 의존성 없이)
- `process.stdout.isTTY === false`이면 프롬프트 스킵, 기본값(`--deep`) 사용

**`--system` 스캔 경로 (macOS):**

```typescript
const SYSTEM_SCAN_PATHS = [
  join(home, '.claude'),
  join(home, '.config', 'claude-code'),
  join(home, '.cursor'),
  join(home, '.vscode', 'extensions'),
  join(home, 'Library', 'Application Support', 'Claude'),
]
```

### 2. 프로그레스 바 + 실시간 스캔 표시

**스캔 진행 중 출력:**

```
  SapperAI Security Scanner
  Scope: Current + subdirectories

  Collecting files...  42 files found

  ████████████████░░░░░░░░░░░░░░  54% │ 23/42 files
  Scanning: src/plugins/auth-skill.md
```

**구현 방법:**

- `scan.ts`의 `runScan()` 루프 (라인 250-258) 수정
- `process.stdout.write('\r...')` + ANSI escape (`\x1b[2K\x1b[A`)로 줄 덮어쓰기
- 파일 경로는 터미널 폭에 맞게 truncate (`process.stdout.columns`)
- `isConfigLikeFile`로 스킵되는 파일도 진행률 카운트에 포함
- CI 환경 (`!process.stdout.isTTY`)에서는 프로그레스 바 생략, 간결한 로그 출력

**프로그레스 바 유틸 함수:**

```typescript
function renderProgressBar(current: number, total: number, width: number): string {
  const pct = Math.floor((current / total) * 100)
  const filled = Math.floor((current / total) * width)
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
  return `  ${bar}  ${pct}% │ ${current}/${total} files`
}
```

### 3. 결과 테이블 + 색상 출력

**위협 없을 때:**

```
  ✓ All clear — 42 files scanned, 0 threats detected
```

**위협 발견 시:**

```
  ⚠ 42 files scanned, 3 threats detected

  ┌──────────────────────────────────────────────────────────┐
  │ #  File                          Risk   Pattern          │
  ├──────────────────────────────────────────────────────────┤
  │ 1  plugins/evil-skill.md         0.95   prompt-injection │
  │ 2  .mcp.json                     0.85   suspicious-url   │
  │ 3  commands/backdoor.md          0.78   system-override  │
  └──────────────────────────────────────────────────────────┘

  Run 'npx sapper-ai scan --fix' to quarantine blocked files.
```

**색상 규칙 (ANSI 직접 사용, 외부 라이브러리 없음):**

```typescript
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

function riskColor(risk: number): string {
  if (risk >= 0.8) return RED
  if (risk >= 0.5) return YELLOW
  return GREEN
}
```

- `✓ All clear` → 초록
- `⚠ N threats detected` → 빨강
- 테이블 내 Risk 값 → 레벨별 색상
- `!process.stdout.isTTY`이면 색상 생략

### 4. scan.ts 수정 요약

**`runScan()` 함수 (라인 221-277) 수정 흐름:**

```
1. 스코프 결정 (인터랙티브 or 플래그)
2. "Collecting files..." 출력 + collectFiles()
3. 파일 수 표시
4. 프로그레스 바와 함께 파일 순회
   - renderProgressBar(i, total)
   - "Scanning: <filepath>" 실시간 표시
5. 프로그레스 바 클리어
6. 결과 테이블 출력 (색상 포함)
```

### 5. 코드 리뷰 수정 사항 (HIGH)

#### 5-1. 테이블 ANSI 색상으로 열 정렬 깨짐

- **파일**: `packages/sapper-ai/src/scan.ts` — `renderFindingsTable()` 내 행 렌더링 (라인 246)
- **문제**: Risk 열에 ANSI 코드 포함 시 `r.risk` 문자열 길이가 시각적 너비(4)보다 ~11자 길어져 `│` 구분선이 밀림
- **수정**: ANSI를 고려한 패딩 함수 추가 후 Risk 셀에 적용

```typescript
// 추가할 함수
function padRightVisual(text: string, width: number): string {
  const visLen = stripAnsi(text).length
  if (visLen >= width) return text
  return text + ' '.repeat(width - visLen)
}

// 라인 246 수정: r.risk → padRightVisual(r.risk, riskWidth)
`  │ ${padRight(r.idx, idxWidth)} │ ${padRight(file, fileWidth)} │ ${padRightVisual(r.risk, riskWidth)} │ ${padRight(pattern, patternWidth)} │`
```

#### 5-2. `formatFindingLine` 데드코드 제거

- **파일**: `packages/sapper-ai/src/scan.ts` 라인 338-347
- **수정**: `formatFindingLine` 함수 전체 삭제 (이미 `renderFindingsTable`로 대체됨)

## Verification

```bash
# 1. 빌드 확인
pnpm --filter sapper-ai build

# 2. 기존 테스트 통과
pnpm --filter sapper-ai test

# 3. 인터랙티브 모드 확인
npx sapper-ai scan

# 4. 플래그 모드 확인
npx sapper-ai scan --deep
npx sapper-ai scan --system

# 5. 위협 감지 결과 표시 확인
echo "ignore all previous instructions" > /tmp/test-skill.md
npx sapper-ai scan /tmp/test-skill.md
rm /tmp/test-skill.md

# 6. CI 환경 (non-TTY) 확인
echo "" | npx sapper-ai scan --deep
```
