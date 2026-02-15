function stripBom(input: string): string {
  if (input.charCodeAt(0) === 0xfeff) {
    return input.slice(1)
  }
  return input
}

function stripComments(input: string): string {
  let out = ''

  let inString = false
  let stringQuote: '"' | "'" = '"'
  let escaped = false

  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!
    const next = i + 1 < input.length ? input[i + 1]! : ''

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false
        out += ch
      }
      continue
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }

    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === stringQuote) {
        inString = false
      }
      continue
    }

    if (ch === '/' && next === '/') {
      inLineComment = true
      i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true
      i += 1
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch
      out += ch
      continue
    }

    out += ch
  }

  return out
}

function stripTrailingCommas(input: string): string {
  let out = ''

  let inString = false
  let stringQuote: '"' | "'" = '"'
  let escaped = false

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!

    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === stringQuote) {
        inString = false
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch
      out += ch
      continue
    }

    if (ch === ',') {
      let j = i + 1
      while (j < input.length && /\s/.test(input[j]!)) {
        j += 1
      }

      const nextNonWs = j < input.length ? input[j]! : ''
      if (nextNonWs === ']' || nextNonWs === '}') {
        continue
      }
    }

    out += ch
  }

  return out
}

export function stripJsonc(input: string): string {
  const withoutBom = stripBom(input)
  const withoutComments = stripComments(withoutBom)
  return stripTrailingCommas(withoutComments)
}

export function parseJsonc<T = unknown>(input: string): T {
  return JSON.parse(stripJsonc(input)) as T
}

