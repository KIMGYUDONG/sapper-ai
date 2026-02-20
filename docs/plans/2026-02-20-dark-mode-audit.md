# Dark Mode UI Audit - Bug Report & Fix Plan

## Date: 2026-02-20

## Audit Scope
Playground + Marketing 페이지 전체 컴포넌트에서 다크 모드 미대응 하드코딩 색상 탐색.

---

## Bug 1: StatusBadge - 다크 모드에서 라이트 배경 고정 (High)

**파일**: `apps/web/app/components/status-badge.tsx` (L5-12)

### 현상
모든 StatusBadge(BLOCK, ALLOW, clear, warning 등)가 다크 모드에서도 밝은 배경(`bg-red-50`, `bg-emerald-50`, `bg-amber-50`, `bg-gray-50`)으로 표시됨. 다크 배경 위에 밝은 뱃지가 뜨면서 시각적으로 튐.

### 영향 범위
- Runtime 탐지 결과: BLOCK/ALLOW 뱃지
- Adversary Campaign: 각 case의 Action/Severity 뱃지 (대량)
- 모든 StatusBadge 사용처

### 수정 방법
```tsx
const variantStyles: Record<StatusVariant, string> = {
  block: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  allow: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  critical: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  warning: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  clear: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  executed: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
  stopped: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
}
```

---

## Bug 2: RiskBar - 다크 모드에서 트랙 배경 안 보임 (Medium)

**파일**: `apps/web/app/components/risk-bar.tsx` (L19)

### 현상
`bg-gray-100`이 다크 배경과 비슷해져 프로그레스 바 트랙이 거의 보이지 않음.

### 영향 범위
- Runtime 결과의 Risk 게이지 내부
- Adversary Campaign Stats: Blocked/Total 바, Type/Severity distribution 바

### 수정 방법
```tsx
// Before
<div className={`${heightClass} w-full overflow-hidden rounded-full bg-gray-100`}>

// After
<div className={`${heightClass} w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800`}>
```

---

## Bug 3: CircularGauge - 다크 모드에서 SVG 트랙 링 안 보임 (Medium)

**파일**: `apps/web/app/components/circular-gauge.tsx` (L26)

### 현상
원형 게이지의 배경 원(트랙)이 `stroke-gray-100`으로 다크 배경에서 거의 보이지 않음.

### 수정 방법
```tsx
// Before
<circle ... className="stroke-gray-100" />

// After
<circle ... className="stroke-gray-100 dark:stroke-gray-700" />
```

---

## Bug 4: 에러 알림 박스 - 다크 모드에서 라이트 배경 고정 (Medium)

5곳에서 동일 패턴 사용:

| 파일 | 라인 | 설명 |
|------|------|------|
| `interactive-demo-section.tsx` | L250 | 탐지 에러 |
| `campaign-section.tsx` | L108 | 캠페인 에러 |
| `upload-section.tsx` | L109 | 업로드 에러 |
| `config/page.tsx` | L89 | 설정 에러 |
| `interactive-demo-section.tsx` | L173 | sample fallback 경고 (amber) |

### 현상
`bg-red-50 border-red-200 text-red-600` / `bg-amber-50 border-amber-200 text-amber-900`
다크 모드에서 밝은 빨간/노란 박스가 눈에 띄게 튐.

### 수정 방법
```tsx
// red error: 4곳 공통
// Before
"rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
// After
"rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"

// amber warning: 1곳
// Before
"rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
// After
"rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
```

---

## Bug 5: Campaign 분포 바 - 다크 모드에서 트랙 안 보임 (Low)

**파일**: `apps/web/app/playground/_components/demos/campaign-section.tsx` (L178, L203)

### 현상
Type/Severity Distribution 프로그레스 바의 `bg-gray-100` 트랙이 다크 모드에서 안 보임.
(Bug 2와 동일 패턴이지만 RiskBar 컴포넌트가 아닌 인라인 구현)

### 수정 방법
```tsx
// L178, L203 (2곳)
// Before
<div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
// After
<div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
```

---

## Bug 6: Campaign Blocked 뱃지 - 다크 모드에서 라이트 배경 (Low)

**파일**: `apps/web/app/playground/_components/demos/campaign-section.tsx` (L126)

### 현상
"Blocked N" 뱃지가 `bg-red-50 text-red-600 border-red-200`로 다크 모드 미대응.

### 수정 방법
```tsx
// Before
"rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600"
// After
"rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
```

---

## 정상 확인 (버그 아닌 항목)

| 컴포넌트 | 상태 | 비고 |
|----------|------|------|
| SiteHeader 로고 | OK | `dark:bg-olive-400 dark:text-ink` 대응 |
| SiteHeader "Get started" | OK | `dark:bg-olive-400 dark:text-ink` 대응 |
| PlaygroundNav 탭 | OK | `border-ink text-ink` / `text-steel` 시맨틱 토큰 사용 |
| Quickstart 탭 | OK | 이미 수정 완료 |
| 탐지/캠페인 실행 버튼 | OK | 이미 수정 완료 |
| ThemeToggle | OK | next-themes 사용 |

---

## TODO List (Codex 실행용)

- [ ] **T1**: `status-badge.tsx` — 7개 variant에 dark: 접두사 색상 추가
- [ ] **T2**: `risk-bar.tsx` L19 — `bg-gray-100` 뒤에 `dark:bg-gray-800` 추가
- [ ] **T3**: `circular-gauge.tsx` L26 — `stroke-gray-100` 뒤에 `dark:stroke-gray-700` 추가
- [ ] **T4**: `interactive-demo-section.tsx` L250 — 에러 박스에 dark: 색상 추가
- [ ] **T5**: `interactive-demo-section.tsx` L173 — amber 경고 박스에 dark: 색상 추가
- [ ] **T6**: `campaign-section.tsx` L108 — 에러 박스에 dark: 색상 추가
- [ ] **T7**: `campaign-section.tsx` L126 — Blocked 뱃지에 dark: 색상 추가
- [ ] **T8**: `campaign-section.tsx` L178, L203 — 분포 바 트랙에 `dark:bg-gray-800` 추가
- [ ] **T9**: `upload-section.tsx` L109 — 에러 박스에 dark: 색상 추가
- [ ] **T10**: `config/page.tsx` L89 — 에러 박스에 dark: 색상 추가
- [ ] **T11**: `pnpm build` 성공 확인
- [ ] **T12**: 브라우저에서 다크 모드 전체 페이지 시각 확인

## Verification
1. `pnpm build` 성공
2. 다크 모드에서 각 뱃지/에러박스/프로그레스바가 어두운 배경 + 밝은 텍스트로 표시
3. 라이트 모드 기존 동작 유지
