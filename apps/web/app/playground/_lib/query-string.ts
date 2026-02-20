export type SearchParams = Record<string, string | string[] | undefined>

export function toQueryString(searchParams: SearchParams, omitKeys: Set<string>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (omitKeys.has(key) || value === undefined) continue
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry)
      continue
    }
    params.set(key, value)
  }

  const serialized = params.toString()
  return serialized.length > 0 ? `?${serialized}` : ''
}
