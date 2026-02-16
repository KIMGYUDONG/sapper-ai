import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseCliArgs, resolvePolicy } from '../cli'

describe('parseCliArgs', () => {
  it('parses watch subcommand arguments', () => {
    const args = parseCliArgs(['watch', '--policy', '/tmp/policy.yaml', '--path', '/tmp/a', '--path', '/tmp/b'])

    expect(args).toMatchObject({
      command: 'watch',
      policyPath: '/tmp/policy.yaml',
      watchPaths: ['/tmp/a', '/tmp/b'],
    })
  })

  it('parses watch dynamic arguments', () => {
    const args = parseCliArgs([
      'watch',
      '--dynamic',
      '--dynamic-max-cases',
      '12',
      '--dynamic-max-duration-ms',
      '2500',
      '--dynamic-seed',
      'watch-seed',
    ])

    expect(args).toMatchObject({
      command: 'watch',
      dynamic: {
        enabled: true,
        maxCases: 12,
        maxDurationMs: 2500,
        seed: 'watch-seed',
      },
    })
  })

  it('applies watch dynamic defaults when omitted', () => {
    const args = parseCliArgs(['watch'])

    expect(args).toMatchObject({
      command: 'watch',
      dynamic: {
        enabled: false,
        maxCases: 8,
        maxDurationMs: 1500,
        seed: 'watch-default',
      },
    })
  })

  it('parses proxy mode with separator command', () => {
    const args = parseCliArgs(['--policy', '/tmp/policy.yaml', '--', 'npx', '@modelcontextprotocol/server-example'])

    expect(args).toMatchObject({
      command: 'proxy',
      policyPath: '/tmp/policy.yaml',
      upstreamCommand: 'npx',
      upstreamArgs: ['@modelcontextprotocol/server-example'],
    })
  })

  it('parses quarantine list subcommand', () => {
    const args = parseCliArgs(['quarantine', 'list', '--quarantine-dir', '/tmp/quarantine'])

    expect(args).toMatchObject({
      command: 'quarantine_list',
      quarantineDir: '/tmp/quarantine',
    })
  })

  it('parses quarantine restore subcommand with positional id', () => {
    const args = parseCliArgs(['quarantine', 'restore', 'abc-123', '--quarantine-dir', '/tmp/quarantine'])

    expect(args).toMatchObject({
      command: 'quarantine_restore',
      id: 'abc-123',
      quarantineDir: '/tmp/quarantine',
    })
  })

  it('parses blocklist sync arguments', () => {
    const args = parseCliArgs([
      'blocklist',
      'sync',
      '--policy',
      '/tmp/policy.yaml',
      '--source',
      'https://example.com/feed1.json',
      '--source',
      'https://example.com/feed2.json',
      '--cache-path',
      '/tmp/intel.json',
    ])

    expect(args).toMatchObject({
      command: 'blocklist_sync',
      policyPath: '/tmp/policy.yaml',
      sources: ['https://example.com/feed1.json', 'https://example.com/feed2.json'],
      cachePath: '/tmp/intel.json',
    })
  })

  it('parses adversary run arguments', () => {
    const args = parseCliArgs([
      'adversary',
      'run',
      '--out',
      '/tmp/adversary',
      '--agent',
      '/tmp/agent.json',
      '--max-cases',
      '25',
      '--max-duration-ms',
      '60000',
      '--seed',
      'sapper',
    ])

    expect(args).toMatchObject({
      command: 'adversary_run',
      outDir: '/tmp/adversary',
      agentConfigPath: '/tmp/agent.json',
      maxCases: 25,
      maxDurationMs: 60000,
      seed: 'sapper',
    })
  })

  it('parses adversary replay arguments', () => {
    const args = parseCliArgs(['adversary', 'replay', '--repro', '/tmp/repro.json'])

    expect(args).toMatchObject({
      command: 'adversary_replay',
      reproPath: '/tmp/repro.json',
    })
  })

  it('rejects option flags used as missing values', () => {
    expect(() => parseCliArgs(['blocklist', 'sync', '--source', '--cache-path', '/tmp/cache.json'])).toThrow(
      'Missing value for --source'
    )
  })

  it('rejects invalid watch dynamic numeric values', () => {
    expect(() => parseCliArgs(['watch', '--dynamic-max-cases', '0'])).toThrow('Invalid value for --dynamic-max-cases')
    expect(() => parseCliArgs(['watch', '--dynamic-max-cases', '101'])).toThrow('Invalid value for --dynamic-max-cases')
    expect(() => parseCliArgs(['watch', '--dynamic-max-duration-ms', 'abc'])).toThrow(
      'Invalid value for --dynamic-max-duration-ms'
    )
    expect(() => parseCliArgs(['watch', '--dynamic-max-duration-ms', '30001'])).toThrow(
      'Invalid value for --dynamic-max-duration-ms'
    )
  })
})

describe('resolvePolicy', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // no-op
      }
    }
    tempDirs.length = 0
  })

  it('auto-discovers sapperai.config.yaml at repo root when no explicit policy is set', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-mcp-policy-root-'))
    tempDirs.push(repoRoot)
    mkdirSync(join(repoRoot, '.git'), { recursive: true })

    const nested = join(repoRoot, 'nested')
    mkdirSync(nested, { recursive: true })

    writeFileSync(
      join(repoRoot, 'sapperai.config.yaml'),
      ['mode: monitor', 'defaultAction: block', 'failOpen: false', ''].join('\n'),
      'utf8'
    )

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(nested)
    try {
      const policy = resolvePolicy(undefined, {})
      expect(policy.mode).toBe('monitor')
      expect(policy.defaultAction).toBe('block')
      expect(policy.failOpen).toBe(false)
    } finally {
      cwdSpy.mockRestore()
    }
  })

  it('fails closed on auto-discovered policy parse/validation errors by default', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-mcp-policy-bad-'))
    tempDirs.push(repoRoot)
    mkdirSync(join(repoRoot, '.git'), { recursive: true })

    writeFileSync(
      join(repoRoot, 'sapperai.config.yaml'),
      ['mode: enforce', 'defaultAction: allow', 'thresholds:', '  riskThreshold: not-a-number', ''].join('\n'),
      'utf8'
    )

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(repoRoot)
    try {
      expect(() => resolvePolicy(undefined, {})).toThrow()
    } finally {
      cwdSpy.mockRestore()
    }
  })

  it('can fail open on auto-discovered policy parse errors when SAPPERAI_POLICY_PARSE_FAIL_OPEN=true', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-mcp-policy-bad-open-'))
    tempDirs.push(repoRoot)
    mkdirSync(join(repoRoot, '.git'), { recursive: true })

    writeFileSync(
      join(repoRoot, 'sapperai.config.yaml'),
      ['mode: enforce', 'defaultAction: allow', 'thresholds:', '  riskThreshold: not-a-number', ''].join('\n'),
      'utf8'
    )

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(repoRoot)
    try {
      const policy = resolvePolicy(undefined, {
        SAPPERAI_POLICY_PARSE_FAIL_OPEN: 'true',
        SAPPERAI_POLICY_MODE: 'monitor',
        SAPPERAI_DEFAULT_ACTION: 'block',
        SAPPERAI_FAIL_OPEN: 'false',
      })
      expect(policy).toEqual({ mode: 'monitor', defaultAction: 'block', failOpen: false })
    } finally {
      cwdSpy.mockRestore()
    }
  })

  it('treats an explicit policy path as fatal on parse errors even when fail-open is enabled', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-mcp-policy-explicit-bad-'))
    tempDirs.push(repoRoot)

    const policyPath = join(repoRoot, 'policy.yaml')
    writeFileSync(policyPath, ['mode: enforce', 'defaultAction: allow', 'thresholds:', '  riskThreshold: bad', ''].join('\n'), 'utf8')

    expect(() =>
      resolvePolicy(policyPath, {
        SAPPERAI_POLICY_PARSE_FAIL_OPEN: 'true',
      })
    ).toThrow()
  })
})
