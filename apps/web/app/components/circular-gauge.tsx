'use client'

import { useEffect, useState } from 'react'

import { clampRisk, formatPercent, getRiskStrokeTone } from './utils'

export function CircularGauge({ value, label }: { value: number; label?: string }) {
  const clamped = clampRisk(value)
  const [animatedValue, setAnimatedValue] = useState(0)
  const dasharray = 283
  const dashoffset = dasharray * (1 - clampRisk(animatedValue))
  const strokeTone = getRiskStrokeTone(clamped)

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      setAnimatedValue(clamped)
    })
    return () => {
      window.cancelAnimationFrame(handle)
    }
  }, [clamped])

  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle r="45" cx="50" cy="50" fill="none" strokeWidth="8" className="stroke-gray-100" />
        <circle
          r="45"
          cx="50"
          cy="50"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={dasharray}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          className={`${strokeTone} origin-center -rotate-90`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="grid place-items-center">
          <p className="text-xl font-bold tabular-nums text-ink">{formatPercent(clamped)}</p>
          {label && (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-steel">
              {label}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
