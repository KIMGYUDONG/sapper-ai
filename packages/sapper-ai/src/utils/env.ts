export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false

  return fallback
}

export function isCiEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  // CI providers generally set CI=true; also treat GitHub Actions as CI even if CI is unset.
  const ci = env.CI
  if (ci && ci.trim().length > 0 && ci !== '0' && ci.toLowerCase() !== 'false') {
    return true
  }

  if (env.GITHUB_ACTIONS && env.GITHUB_ACTIONS !== 'false') {
    return true
  }

  return false
}

