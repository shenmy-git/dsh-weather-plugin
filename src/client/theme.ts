/**
 * Weather → theme mapping: one `--dsw-alias-*` override layer per condition
 * family, applied through `ctx.theme.overrideTokens` (the sanctioned
 * third-party token-override channel). Every token carries both palette modes
 * so an override never goes illegible when the user switches color scheme.
 */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { WeatherConditionKey, WeatherResult } from '../weather.ts'

interface Palette {
  readonly brand: readonly [string, string]
  readonly bgBase: readonly [string, string]
  readonly bgLayer1: readonly [string, string]
  readonly bgLayer2: readonly [string, string]
  readonly border: readonly [string, string]
  readonly label: readonly [string, string]
  readonly labelSecondary: readonly [string, string]
  readonly sidebar: readonly [string, string]
}

/** Expand one palette into the full token override layer ([light, dark] per entry). */
function layer(palette: Palette): ThemeTokenOverrides {
  const modes = (pair: readonly [string, string]) => ({ light: pair[0], dark: pair[1] })
  return {
    '--dsw-alias-brand-primary': modes(palette.brand),
    '--dsw-alias-bg-base': modes(palette.bgBase),
    '--dsw-alias-bg-layer-1': modes(palette.bgLayer1),
    '--dsw-alias-bg-layer-2': modes(palette.bgLayer2),
    '--dsw-alias-border-l1': modes(palette.border),
    '--dsw-alias-label-primary': modes(palette.label),
    '--dsw-alias-label-secondary': modes(palette.labelSecondary),
    '--dsw-specific-sidebar-fill': modes(palette.sidebar),
  }
}

const PALETTES: Record<WeatherConditionKey, Palette> = {
  clear: {
    brand: ['#f59e0b', '#fbbf24'],
    bgBase: ['#fdf8ec', '#1a1712'],
    bgLayer1: ['#fffdf5', '#221e16'],
    bgLayer2: ['#f7f0dd', '#2a2519'],
    border: ['#e8dcc0', '#3a3222'],
    label: ['#1f1a0e', '#f5efe2'],
    labelSecondary: ['#6b5f45', '#b3a78c'],
    sidebar: ['#f5ecd8', '#14110c'],
  },
  partly: {
    brand: ['#d9a441', '#e3b65c'],
    bgBase: ['#f7f6f2', '#17181a'],
    bgLayer1: ['#fcfbf8', '#1e1f22'],
    bgLayer2: ['#efeee9', '#26282b'],
    border: ['#dedcd3', '#36383c'],
    label: ['#26251f', '#ececea'],
    labelSecondary: ['#6d6b61', '#a8a79e'],
    sidebar: ['#efeee8', '#121315'],
  },
  cloudy: {
    brand: ['#7a8aa0', '#93a3ba'],
    bgBase: ['#f2f4f6', '#14161a'],
    bgLayer1: ['#f8f9fb', '#1a1d22'],
    bgLayer2: ['#e9ebef', '#22262c'],
    border: ['#d5d9df', '#33383f'],
    label: ['#1c1f24', '#e6e8ec'],
    labelSecondary: ['#5f6670', '#9ca3ad'],
    sidebar: ['#e9ebef', '#101216'],
  },
  fog: {
    brand: ['#9a9a9a', '#b5b5b5'],
    bgBase: ['#f5f5f5', '#161616'],
    bgLayer1: ['#fafafa', '#1c1c1c'],
    bgLayer2: ['#ececec', '#232323'],
    border: ['#dbdbdb', '#353535'],
    label: ['#222222', '#e8e8e8'],
    labelSecondary: ['#6a6a6a', '#a0a0a0'],
    sidebar: ['#ececec', '#111111'],
  },
  drizzle: {
    brand: ['#6b93b8', '#8fb3d4'],
    bgBase: ['#f3f6f8', '#13171b'],
    bgLayer1: ['#f9fbfc', '#191e23'],
    bgLayer2: ['#e8edf1', '#21272d'],
    border: ['#d3dbe1', '#333b42'],
    label: ['#1b2025', '#e4e8ec'],
    labelSecondary: ['#5d666e', '#99a2ab'],
    sidebar: ['#e8edf1', '#0f1317'],
  },
  rain: {
    brand: ['#3b6ea5', '#5d8fc4'],
    bgBase: ['#eef3f8', '#10141a'],
    bgLayer1: ['#f6f9fc', '#161b22'],
    bgLayer2: ['#e3eaf1', '#1e242c'],
    border: ['#cdd8e2', '#303a44'],
    label: ['#16202b', '#e2e7ed'],
    labelSecondary: ['#55616d', '#939ea9'],
    sidebar: ['#e3eaf1', '#0c1015'],
  },
  snow: {
    brand: ['#4f8fbf', '#7fb4de'],
    bgBase: ['#f4f8fc', '#14181e'],
    bgLayer1: ['#fafcff', '#1a1f27'],
    bgLayer2: ['#e9f0f7', '#222933'],
    border: ['#d5e0ea', '#35404c'],
    label: ['#1a222c', '#e7ebf1'],
    labelSecondary: ['#5a6673', '#9da7b3'],
    sidebar: ['#e9f0f7', '#0f1319'],
  },
  thunder: {
    brand: ['#a16207', '#f0b429'],
    bgBase: ['#f1f2f4', '#101014'],
    bgLayer1: ['#f9f9fa', '#17171c'],
    bgLayer2: ['#e7e8ea', '#1f1f25'],
    border: ['#d6d7da', '#33343b'],
    label: ['#1d1f23', '#eae7e0'],
    labelSecondary: ['#5f6268', '#a09d94'],
    sidebar: ['#e7e8ea', '#0c0c0f'],
  },
}

/**
 * The token override layer for one weather reading. Idempotent per reading:
 * re-applying the same condition replaces the previous layer wholesale.
 * @param weather - canonical weather result from the tool.
 * @returns the override layer to stack through `ctx.theme.overrideTokens`.
 */
export function weatherTokens(weather: WeatherResult): ThemeTokenOverrides {
  return layer(PALETTES[weather.conditionKey])
}
