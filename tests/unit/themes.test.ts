import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TONE_TO_C_VAR,
  THEME_IDS,
  THEME_TOKENS,
  THEME_TONE_KEYS
} from '../../src/renderer/src/theme'

const css = readFileSync(resolve(__dirname, '../../src/renderer/src/styles/global.css'), 'utf8')

function parseThemeBlock(theme: string): Record<string, string> {
  const block = css.match(
    new RegExp(`:root\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n  \\}`, 'm')
  )
  expect(block, `theme block ${theme} present`).not.toBeNull()
  const tokens: Record<string, string> = {}
  const re = /--([a-z0-9-]+):\s*([^;]+);/g
  let match: RegExpExecArray | null
  while ((match = re.exec(block?.[1] ?? '')) !== null) {
    tokens[`--${match[1]!}`] = match[2]!.trim()
  }
  return tokens
}

function channel(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const int = parseInt(value, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = channel(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('theme tokens in global.css match the spec table', () => {
  for (const theme of THEME_IDS) {
    it(`${theme} defines every spec token with the spec value`, () => {
      const fromCss = parseThemeBlock(theme)
      for (const key of THEME_TONE_KEYS) {
        expect(`--${key}` in fromCss, `${theme}: --${key} defined`).toBe(true)
        expect(fromCss[`--${key}`]).toBe(THEME_TOKENS[theme][key])
      }
    })

    it(`${theme} rgb() triplets mirror the hex tokens`, () => {
      const fromCss = parseThemeBlock(theme)
      for (const key of THEME_TONE_KEYS) {
        const cVarName = TONE_TO_C_VAR[key]
        if (cVarName === undefined) continue
        const value = THEME_TOKENS[theme][key]
        const triplet = channel(value).join(' ')
        expect(`--${cVarName}` in fromCss, `${theme}: --${cVarName} defined`).toBe(true)
        expect(fromCss[`--${cVarName}`]).toBe(triplet)
      }
    })
  }
})

describe('text contrast on the panel background meets 4.5:1', () => {
  for (const theme of THEME_IDS) {
    const tokens = parseThemeBlock(theme)
    const bg1 = tokens['--bg-1']!

    it(`${theme}: text-1 (${tokens['--text-1']}) on bg-1`, () => {
      expect(contrast(tokens['--text-1']!, bg1)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${theme}: text-2 (${tokens['--text-2']}) on bg-1`, () => {
      expect(contrast(tokens['--text-2']!, bg1)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${theme}: text-3 (${tokens['--text-3']}) on bg-1`, () => {
      expect(contrast(tokens['--text-3']!, bg1)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
