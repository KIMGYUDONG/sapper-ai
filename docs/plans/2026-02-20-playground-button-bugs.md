# Playground Button UI Bugs Fix Plan

## Date: 2026-02-20

## Context

Playground 페이지에서 버튼 관련 UI 버그 2가지를 발견함.
`defaultTheme` 다크 모드 기본값 변경은 이미 적용 완료.

---

## Bug 1: 탐지 실행 후 버튼이 세로로 늘어나는 버그 (Critical)

### 현상
- "SapperAI 탐지 실행" 버튼 클릭 → 결과가 오른쪽 패널에 렌더링됨
- 오른쪽 패널이 길어지면서 왼쪽 컬럼도 함께 늘어남
- 버튼이 세로로 크게 늘어나 비정상적으로 큰 영역을 차지함 (스크린샷 참조)

### 근본 원인
```
외부 grid: lg:grid-cols-[1fr_1.1fr]
  ├── 왼쪽: <div className="grid gap-4">  ← align-items: stretch (기본값)
  │   ├── Tool 이름 input
  │   ├── Textarea (min-h-64)
  │   ├── 버튼                            ← 여분 높이가 분배됨!
  │   └── 현재 선택된 예시 텍스트
  └── 오른쪽: 결과 패널 (Risk Gauge, Pipeline, Timeline...)  ← 매우 길어짐
```

CSS Grid의 기본 `align-content: normal`은 행 간 여분 공간을 균등 배분.
결과 패널이 길어지면 왼쪽 컬럼도 동일 높이로 늘어나고,
내부 grid 행들(버튼 포함)에 여분 공간이 배분되어 버튼이 세로로 늘어남.

### 영향 범위
| 파일 | 라인 | 컴포넌트 |
|------|------|----------|
| `interactive-demo-section.tsx` | L208 | 탐지 데모 왼쪽 컬럼 |
| `campaign-section.tsx` | L95 | 캠페인 데모 왼쪽 컬럼 (동일 패턴) |

### 수정 방법
내부 grid 컨테이너에 `content-start` 추가하여 행을 상단에 정렬:

```tsx
// interactive-demo-section.tsx L208
// Before
<div className="grid gap-4">

// After
<div className="grid content-start gap-4">
```

```tsx
// campaign-section.tsx L95
// Before
<div className="grid gap-4">

// After
<div className="grid content-start gap-4">
```

---

## Bug 2: 버튼 로딩 시 미세한 레이아웃 시프트 (Minor)

### 현상
- 버튼 클릭 시 스피너가 조건부 렌더링되면서 버튼 내부 콘텐츠가 살짝 이동
- 텍스트도 변경됨 ('SapperAI 탐지 실행' → '탐지 엔진 실행 중...')

### 근본 원인
```tsx
// 스피너가 조건부로 추가됨 → gap-2 공간 발생
{loading && <span className="h-4 w-4 animate-spin ..." />}
{loading ? '탐지 엔진 실행 중...' : 'SapperAI 탐지 실행'}
```

버튼이 grid 안에서 full-width이므로 가로 변화는 미미하나,
스피너 추가/제거 시 `gap-2` 공간이 생기면서 텍스트가 오른쪽으로 밀림.

### 영향 범위
| 파일 | 라인 | 버튼 텍스트 |
|------|------|-------------|
| `interactive-demo-section.tsx` | L232-233 | SapperAI 탐지 실행 |
| `campaign-section.tsx` | L103-104 | 원클릭 캠페인 실행 |

### 수정 방법
스피너를 항상 렌더링하되, 비활성 시 보이지 않게:

```tsx
// Before
{loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
{loading ? '탐지 엔진 실행 중...' : 'SapperAI 탐지 실행'}

// After
<span className={`inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent ${loading ? 'animate-spin' : 'opacity-0'}`} aria-hidden="true" />
{loading ? '탐지 엔진 실행 중...' : 'SapperAI 탐지 실행'}
```

> Note: config/page.tsx의 Refresh 버튼은 텍스트가 고정("Refresh")이고 flex-wrap 컨테이너 안에 있어 영향 미미. upload-section.tsx의 스피너는 버튼 외부에 있어 해당 없음.

---

## Bug 3 해당 없음 - 추가 유사 버그 감사 결과

### 감사 범위
- `animate-spin` 사용처 4곳 전수 조사 완료
- 조건부 로딩 텍스트 변경 패턴 전수 조사 완료

### 결과
| 파일 | 상태 | 비고 |
|------|------|------|
| `interactive-demo-section.tsx` | **수정 필요** | Bug 1 + Bug 2 |
| `campaign-section.tsx` | **수정 필요** | Bug 1 + Bug 2 |
| `config/page.tsx` | OK | 텍스트 고정, 별도 flex 컨테이너 |
| `upload-section.tsx` | OK | 스피너가 버튼 외부 |

---

## TODO List (Codex 실행용)

- [ ] **T1**: `interactive-demo-section.tsx` L208 — `"grid gap-4"` → `"grid content-start gap-4"` 변경
- [ ] **T2**: `campaign-section.tsx` L95 — `"grid gap-4"` → `"grid content-start gap-4"` 변경
  - 주의: L95의 `<div className="grid gap-4">`는 `<button>` 바로 위의 부모. 파일에 `grid gap-4`가 여러 개일 수 있으므로 L94 `grid gap-5 lg:grid-cols-[0.9fr_1.1fr]` 바로 아래의 것을 수정
- [ ] **T3**: `interactive-demo-section.tsx` L232 — 스피너 조건부 렌더링을 상시 렌더링 + opacity-0으로 변경
- [ ] **T4**: `campaign-section.tsx` L103 — 동일 스피너 패턴 수정
- [ ] **T5**: `pnpm build` 성공 확인
- [ ] **T6**: 브라우저에서 다크 모드 + 탐지 실행 후 버튼 크기 고정 확인

## Verification

1. `pnpm build` 성공
2. `/playground/runtime` → 탐지 실행 → 버튼 높이 변화 없음
3. `/playground/adversary` → 캠페인 실행 → 버튼 높이 변화 없음
4. 로딩 중 스피너 + 텍스트 전환 시 레이아웃 시프트 없음
