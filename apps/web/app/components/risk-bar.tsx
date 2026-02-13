'use client'

import { clampRisk, formatPercent, getRiskTone } from './utils'

export function RiskBar({
  value,
  height = 'sm',
  showLabel = false,
}: {
  value: number
  height?: 'sm' | 'md'
  showLabel?: boolean
}) {
  const clamped = clampRisk(value)
  const heightClass = height === 'sm' ? 'h-1.5' : 'h-2.5'

  return (
    <div className="grid gap-1">
      <div className={`${heightClass} w-full overflow-hidden rounded-full bg-gray-100`}>
        <div
          className={`${heightClass} rounded-full transition-all duration-500 ${getRiskTone(clamped)}`}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-[11px] tabular-nums text-steel">{formatPercent(clamped)}</p>
      )}
    </div>
  )
}
