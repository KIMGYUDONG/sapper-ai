'use client'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-white p-8 shadow-subtle md:p-12">
      <div className="relative z-10 grid gap-8">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-medium text-steel">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" />
          JoCoding x OpenAI x Primer Hackathon
        </span>

        <div className="grid gap-4">
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-6xl">
            AI 에이전트 보안을
            <br className="hidden md:block" />
            실시간으로 차단하는&nbsp;
            <span className="text-signal">SapperAI</span>
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-steel md:text-lg">
            MCP/Agent 환경에서 프롬프트 인젝션, 명령어 인젝션, 경로 탐색 공격을 감지하고
            정책 기반으로 즉시 차단합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {['96% 악성 샘플 차단', '0% 정상 샘플 오탐', 'Rules-only p99 0.0018ms'].map((stat) => (
            <div
              key={stat}
              className="rounded-xl border border-border bg-white px-5 py-3 text-sm font-medium text-steel"
            >
              {stat}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
