'use client'

type StatusVariant = 'block' | 'allow' | 'critical' | 'warning' | 'clear' | 'executed' | 'stopped'

const variantStyles: Record<StatusVariant, string> = {
  block: 'bg-red-50 text-red-600 border-red-200',
  allow: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  clear: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  executed: 'bg-gray-50 text-gray-600 border-gray-200',
  stopped: 'bg-gray-50 text-gray-500 border-gray-200',
}

export function StatusBadge({ variant, label }: { variant: StatusVariant; label?: string }) {
  const text = label ?? variant
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wider ${variantStyles[variant]}`}
    >
      {text}
    </span>
  )
}
