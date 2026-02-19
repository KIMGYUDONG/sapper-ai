# CLI 실행 감지 및 TTY 상속 버그 수정

**작성일**: 2026-02-19
**우선순위**: High (데모 영상 촬영 블로커)
**영향 범위**: `packages/sapper-ai/src/cli.ts`

---

## 문제

### 1. `isDirectExecution()` 버그 (Critical)

글로벌 설치(`npm link`, `npm install -g`) 후 `sapper-ai scan --ai` 실행 시 CLI가 아예 동작하지 않음.

**원인**: `cli.ts:1212-1218`의 `isDirectExecution()` 함수가 `argv[1]`이 `/cli.js` 또는 `/cli.ts`로 끝나는 경우만 허용함.

```ts
// 현재 코드
function isDirectExecution(argv: string[]): boolean {
  const entry = argv[1]
  if (!entry) return false
  return entry.endsWith('/cli.js') || entry.endsWith('\\cli.js') || entry.endsWith('/cli.ts')
}
```

**동작하는 경우**:
- `node packages/sapper-ai/dist/cli.js scan --ai` → `argv[1]` = `.../cli.js` → OK

**동작하지 않는 경우**:
- `sapper-ai scan --ai` (글로벌 설치) → `argv[1]` = `/opt/homebrew/bin/sapper-ai` → FAIL
- `npx sapper-ai scan --ai` (npx 실행) → `argv[1]` = `.../node_modules/.bin/sapper-ai` → FAIL

### 2. `npx` TTY 상속 문제 (Medium)

`npx sapper-ai scan --ai` 실행 시 자식 프로세스에서 `process.stdin.isTTY` / `process.stdout.isTTY`가 `undefined`로 설정됨.

**증상**: API 키 프롬프트 대신 에러 메시지 출력
```
Error: OPENAI_API_KEY environment variable is required for --ai mode.
```

**원인**: npm의 `npx`가 패키지를 임시 설치 후 실행할 때 stdio를 pipe로 연결하여 TTY 속성이 손실됨. 로컬에 이미 설치된 경우(`node_modules/.bin/`에 존재)에는 TTY가 정상 상속될 수 있음.

**참고**: 이 문제는 npm/npx의 동작 방식에 기인하므로 sapper-ai 측에서 완전히 해결하기 어려움. 하지만 `isDirectExecution()` 수정 후 글로벌/로컬 설치된 상태에서의 실행은 정상 동작할 것임.

---

## 수정 방안

### `isDirectExecution()` 수정

**파일**: `packages/sapper-ai/src/cli.ts` (라인 1212-1218)

**변경 내용**: `argv[1]`이 `sapper-ai` 바이너리명으로 끝나는 경우도 허용

```ts
// 수정 후
function isDirectExecution(argv: string[]): boolean {
  const entry = argv[1]
  if (!entry) return false
  const base = entry.replace(/\\/g, '/').split('/').pop() ?? ''
  return base === 'cli.js' || base === 'cli.ts' || base === 'sapper-ai'
}
```

**설계 근거**:
- `basename` 비교로 변경하여 경로 형태에 무관하게 동작
- `sapper-ai` 바이너리명 명시적 허용 (symlink, `.bin/sapper-ai` 등)
- `path.basename()` 대신 문자열 처리로 import 추가 없이 구현 (파일 상단에 이미 `import { join, resolve } from 'node:path'`가 있으나 `basename`은 없음 — 추가해도 무방)

---

## Codex TODO List

- [ ] **`isDirectExecution()` 함수 수정**
  - 파일: `packages/sapper-ai/src/cli.ts`
  - 위치: 라인 1212-1218
  - 변경: `entry.endsWith('/cli.js')` 패턴을 basename 비교 방식으로 교체
  - `'cli.js'`, `'cli.ts'`, `'sapper-ai'` 3가지 basename 허용
  - 기존 import에 `basename` 없으면 추가 (`import { basename, join, resolve } from 'node:path'` — 라인 3)

- [ ] **기존 테스트 확인 및 보강**
  - 파일: `packages/sapper-ai/src/__tests__/cli.test.ts` (있으면)
  - `isDirectExecution` 관련 테스트 케이스 추가:
    - `['node', '/path/to/dist/cli.js']` → `true`
    - `['node', '/path/to/cli.ts']` → `true`
    - `['node', '/opt/homebrew/bin/sapper-ai']` → `true`
    - `['node', '/path/to/node_modules/.bin/sapper-ai']` → `true`
    - `['node', '/path/to/other-tool']` → `false`
    - `['node']` (argv[1] 없음) → `false`

- [ ] **빌드 및 글로벌 링크 재설정**
  - `pnpm build`
  - `cd packages/sapper-ai && npm link`
  - 터미널에서 `sapper-ai --help` 동작 확인
  - 터미널에서 `sapper-ai scan --ai` 실행 → API 키 프롬프트 표시 확인

- [ ] **npx 실행 경로도 확인**
  - `npx sapper-ai --help` 동작 확인
  - npx TTY 문제가 여전히 존재하면, 문서(quickstart)에 권장 실행 방법 명시 검토:
    - 로컬 설치 후 `npx` 사용 (TTY 정상)
    - 또는 `pnpm exec` / `yarn exec` 사용

---

## 검증 방법

```bash
# 1. 빌드
pnpm build

# 2. 글로벌 링크
cd packages/sapper-ai && npm link

# 3. auth.json 삭제 (프롬프트 테스트용)
rm -f ~/.sapperai/auth.json

# 4. 글로벌 실행 테스트 (터미널에서)
sapper-ai --help            # 도움말 출력 확인
sapper-ai scan --ai         # API 키 프롬프트 표시 확인

# 5. node 직접 실행 (회귀 테스트)
node packages/sapper-ai/dist/cli.js scan --ai  # 기존 동작 유지 확인

# 6. npx 실행 (참고)
npx sapper-ai scan --ai     # TTY 상속 여부 확인 (npx 자체 제한일 수 있음)

# 7. 단위 테스트
pnpm --filter sapper-ai test
```

---

## 영향 분석

- **변경 파일 수**: 1개 (`cli.ts`)
- **변경 라인 수**: ~5줄
- **하위 호환성**: 완전 호환 (기존 `cli.js`/`cli.ts` 케이스 유지, 새 케이스 추가)
- **위험도**: 낮음 (entry point 감지 로직만 변경, 비즈니스 로직 무관)
