import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots')
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures')

test.describe('SapperAI web app QA', () => {
  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true })
  })

  test('Hero Section', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveTitle(/SapperAI/)
    await expect(page.getByRole('heading', { name: 'SapperAI' })).toBeVisible()

    await expect(
      page.getByText('JoCoding x OpenAI x Primer Hackathon', { exact: true })
    ).toBeVisible()

    await expect(page.getByText('96% 악성 샘플 차단', { exact: true })).toBeVisible()
    await expect(page.getByText('0% 정상 샘플 오탐', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Rules-only p99 0.0018ms', { exact: true })
    ).toBeVisible()

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-hero.png'),
      fullPage: true,
    })
  })

  test('Skill File Upload', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const section = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'skill.md 업로드 위험 분석' }),
    })

    await expect(
      page.getByRole('heading', { name: 'skill.md 업로드 위험 분석' })
    ).toBeVisible()

    const fileInput = page.locator('input[type="file"]')

    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'malicious.md'))
    await expect(section.getByText('BLOCK', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    await expect(section.getByText(/Risk \d+\.\d+%/).first()).toBeVisible()
    await expect(section.getByText('판단 이유', { exact: true })).toBeVisible()
    await expect(section.getByText('Risk Gauge', { exact: true })).toBeVisible()
    await expect(section.getByText('Detection Pipeline', { exact: true })).toBeVisible()
    await expect(section.getByText('Timeline', { exact: true })).toBeVisible()

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-upload-malicious.png'),
      fullPage: true,
    })

    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'benign.md'))
    await expect(section.getByText('ALLOW', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-upload-benign.png'),
      fullPage: true,
    })
  })

  test('Interactive Detection Demo', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const section = page.locator('section').filter({
      has: page.getByRole('heading', { name: '인터랙티브 보안 데모' }),
    })

    await expect(
      page.getByRole('heading', { name: '인터랙티브 보안 데모' })
    ).toBeVisible()

    await section.getByRole('button', { name: '프롬프트 인젝션' }).click()
    await expect(section.getByRole('textbox', { name: 'Tool 이름' })).toHaveValue(
      'researchTool'
    )

    const argumentsBox = section.getByRole('textbox', {
      name: 'Tool arguments(JSON 권장)',
    })
    await expect(argumentsBox).toHaveValue(/\uAE30\uC874\s*\uC9C0\uC2DC/i)

    await section.getByRole('button', { name: 'SapperAI 탐지 실행' }).click()
    await expect(section.getByText('BLOCK', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-detect-prompt-injection.png'),
      fullPage: true,
    })

    await section.getByRole('button', { name: '정상 요청' }).click()
    await section.getByRole('button', { name: 'SapperAI 탐지 실행' }).click()
    await expect(section.getByText('ALLOW', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-detect-benign.png'),
      fullPage: true,
    })
  })

  test('Agent Live Demo', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const section = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'OpenAI Agent Live Demo' }),
    })

    await expect(
      page.getByRole('heading', { name: 'OpenAI Agent Live Demo' })
    ).toBeVisible()

    await section.getByRole('button', { name: 'Agent Live Run 시작' }).click()
    await expect(section.getByText(/Block \d+/).first()).toBeVisible({
      timeout: 60_000,
    })

    const stepItems = section.locator('ol li')
    expect(await stepItems.count()).toBeGreaterThan(0)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-agent-malicious.png'),
      fullPage: true,
    })

    const haltedWarning = section.getByText(
      '고위험 요청이 차단되어 실행이 멈췄습니다.',
      { exact: true }
    )

    if (await haltedWarning.isVisible().catch(() => false)) {
      await section.getByRole('button', { name: 'Execute anyway' }).click()
      await expect(section.getByText(/Allow \d+/).first()).toBeVisible({
        timeout: 60_000,
      })

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '07-agent-execute-anyway.png'),
        fullPage: true,
      })
    }

    await section.getByRole('button', { name: '정상 업무 시나리오' }).click()
    await section.getByRole('button', { name: 'Agent Live Run 시작' }).click()
    await expect(section.getByText(/Allow \d+/).first()).toBeVisible({
      timeout: 60_000,
    })

    const safeSteps = section.locator('ol li')
    const safeCount = await safeSteps.count()
    expect(safeCount).toBeGreaterThan(0)

    for (let i = 0; i < safeCount; i++) {
      const step = safeSteps.nth(i)
      await expect(step.getByText('allow', { exact: true })).toBeVisible()
      await expect(step.getByText('block', { exact: true })).toHaveCount(0)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '08-agent-safe.png'),
      fullPage: true,
    })
  })

  test('Adversary Campaign', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const section = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Adversary Campaign Demo' }),
    })

    await expect(
      page.getByRole('heading', { name: 'Adversary Campaign Demo' })
    ).toBeVisible()

    await section.getByRole('button', { name: '원클릭 캠페인 실행' }).click()
    await expect(section.getByText('Campaign Stats', { exact: true })).toBeVisible({
      timeout: 60_000,
    })

    await expect(section.getByText('detect', { exact: true })).toBeVisible()
    await expect(section.getByText(/Total \d+/).first()).toBeVisible()
    await expect(section.getByText(/Blocked \d+/).first()).toBeVisible()

    await expect(section.getByText('Type Distribution', { exact: true })).toBeVisible()
    await expect(
      section.getByText('Severity Distribution', { exact: true })
    ).toBeVisible()
    await expect(
      section.getByText('Top Detection Reasons', { exact: true })
    ).toBeVisible()
    await expect(section.getByText('Cases', { exact: true })).toBeVisible()

    await expect(section.getByText('Label', { exact: true })).toBeVisible()
    await expect(section.getByText('Type', { exact: true })).toBeVisible()
    await expect(section.getByText('Severity', { exact: true })).toBeVisible()
    await expect(section.getByText('Action', { exact: true })).toBeVisible()
    await expect(section.getByText('Risk', { exact: true })).toBeVisible()

    const caseRows = section.locator('ul.divide-y.divide-slate-200 > li')
    expect(await caseRows.count()).toBeGreaterThanOrEqual(5)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '09-campaign-results.png'),
      fullPage: true,
    })
  })
})
