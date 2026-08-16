/**
 * Weather/season companions: one animal + one plant per condition, with the
 * popular-science fact text living in the locale dictionaries (keyed by
 * `FactKey`) so it follows the active UI language through the standard
 * lookup chain. The `clear` family varies by season, computed from the month
 * and the location's hemisphere.
 */
import type { WeatherConditionKey, WeatherResult } from '../weather.ts'

/** Dictionary key of the companion's fact (see `locales.ts`). */
export type FactKey =
  | 'factClearSpring' | 'factClearSummer' | 'factClearAutumn' | 'factClearWinter'
  | 'factPartly' | 'factCloudy' | 'factFog' | 'factDrizzle'
  | 'factRain' | 'factSnow' | 'factThunder'

/** One companion pair plus the fact dictionary key. */
export interface Companion {
  /** Animal emoji. */
  readonly animal: string
  /** Plant emoji. */
  readonly plant: string
  readonly factKey: FactKey
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** Compute the local season from the month and hemisphere. */
export function seasonOf(weather: WeatherResult): Season {
  const month = new Date(weather.updatedAt).getMonth() + 1
  const northern = weather.latitude >= 0
  const shifted = northern ? month : ((month + 6 - 1) % 12) + 1
  if (shifted >= 3 && shifted <= 5) return 'spring'
  if (shifted >= 6 && shifted <= 8) return 'summer'
  if (shifted >= 9 && shifted <= 11) return 'autumn'
  return 'winter'
}

const CLEAR_BY_SEASON: Record<Season, Companion> = {
  spring: { animal: '🦋', plant: '🌷', factKey: 'factClearSpring' },
  summer: { animal: '🦗', plant: '🌻', factKey: 'factClearSummer' },
  autumn: { animal: '🦔', plant: '🍁', factKey: 'factClearAutumn' },
  winter: { animal: '🐦', plant: '🌲', factKey: 'factClearWinter' },
}

const BY_CONDITION: Record<Exclude<WeatherConditionKey, 'clear'>, Companion> = {
  partly: { animal: '🐦', plant: '☁️', factKey: 'factPartly' },
  cloudy: { animal: '🐌', plant: '🍀', factKey: 'factCloudy' },
  fog: { animal: '🦌', plant: '🌲', factKey: 'factFog' },
  drizzle: { animal: '🐸', plant: '🍄', factKey: 'factDrizzle' },
  rain: { animal: '🐸', plant: '🌈', factKey: 'factRain' },
  snow: { animal: '🐧', plant: '❄️', factKey: 'factSnow' },
  thunder: { animal: '🦅', plant: '⚡', factKey: 'factThunder' },
}

/** The companion pair for one weather reading. */
export function companionsOf(weather: WeatherResult): Companion {
  if (weather.conditionKey === 'clear') return CLEAR_BY_SEASON[seasonOf(weather)]
  return BY_CONDITION[weather.conditionKey]
}
