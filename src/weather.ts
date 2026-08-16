/**
 * Weather domain shared by the host tool and the client card. Both halves
 * bundle this module (the client bundle inlines it); there is no cross-plugin
 * import involved, so the client bundle purity gate is satisfied.
 *
 * Data source: Open-Meteo (free, no API key). WMO weather code mapping follows
 * the official table: https://open-meteo.com/en/docs
 */

/** Coarse condition family derived from a WMO weather code. */
export const WEATHER_CONDITION_KEYS = [
  'clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder',
] as const

export type WeatherConditionKey = (typeof WEATHER_CONDITION_KEYS)[number]

/** How the queried city was resolved. */
export type LocationSource = 'ip' | 'geocode' | 'default'

/** One resolved location with coordinates, shared by host and browser fetches. */
export interface ResolvedLocation {
  readonly name: string
  readonly country?: string
  readonly latitude: number
  readonly longitude: number
}

/** Raw current-conditions payload from the Open-Meteo forecast endpoint. */
export interface ForecastCurrent {
  readonly temperature_2m: number
  readonly apparent_temperature: number
  readonly relative_humidity_2m: number
  readonly weather_code: number
  readonly wind_speed_10m: number
  readonly is_day: number
}

/**
 * Build the canonical weather result from a resolved location and the raw
 * forecast payload. Shared by the host tool and the browser-side fetch.
 * @param location - resolved city and coordinates.
 * @param current - raw current-conditions payload.
 * @param language - condition-label language.
 * @param locationSource - how the location was resolved.
 * @returns the canonical weather result.
 */
export function buildWeatherResult(
  location: ResolvedLocation,
  current: ForecastCurrent,
  language: 'zh' | 'en',
  locationSource: LocationSource,
): WeatherResult {
  const conditionKey = conditionKeyOf(current.weather_code)
  const labels = CONDITION_LABELS[conditionKey]
  return {
    city: location.name,
    ...location.country === undefined ? {} : { country: location.country },
    latitude: location.latitude,
    locationSource,
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    conditionKey,
    conditionLabel: language === 'zh' ? labels.zh : labels.en,
    isDay: current.is_day === 1,
    updatedAt: new Date().toISOString(),
  }
}

/** The tool's canonical output, persisted as `tool/result.meta`. */
export interface WeatherResult {
  /** Resolved display name of the queried city. */
  readonly city: string
  /** ISO-3166 country name as returned by the geocoder; absent when unknown. */
  readonly country?: string
  /** Latitude of the resolved location (drives season detection). */
  readonly latitude: number
  /** How the city was resolved. */
  readonly locationSource: LocationSource
  /** Air temperature in Celsius. */
  readonly temperature: number
  /** Apparent (feels-like) temperature in Celsius. */
  readonly apparentTemperature: number
  /** Relative humidity in percent. */
  readonly humidity: number
  /** Wind speed in km/h. */
  readonly windSpeed: number
  /** Raw WMO weather code (0-99). */
  readonly weatherCode: number
  /** Coarse condition family, drives both the card icon and the theme. */
  readonly conditionKey: WeatherConditionKey
  /** Localized human-readable condition label. */
  readonly conditionLabel: string
  /** Whether the reading is daytime (drives the card's day/night hint). */
  readonly isDay: boolean
  /** ISO timestamp of the reading. */
  readonly updatedAt: string
}

/** Language-neutral condition labels. */
export const CONDITION_LABELS: Record<WeatherConditionKey, { zh: string; en: string }> = {
  clear: { zh: '晴', en: 'Clear' },
  partly: { zh: '多云', en: 'Partly cloudy' },
  cloudy: { zh: '阴', en: 'Cloudy' },
  fog: { zh: '雾', en: 'Fog' },
  drizzle: { zh: '毛毛雨', en: 'Drizzle' },
  rain: { zh: '雨', en: 'Rain' },
  snow: { zh: '雪', en: 'Snow' },
  thunder: { zh: '雷暴', en: 'Thunderstorm' },
}

/** WMO weather code → coarse condition family. */
export function conditionKeyOf(weatherCode: number): WeatherConditionKey {
  if (weatherCode === 0) return 'clear'
  if (weatherCode === 1 || weatherCode === 2) return 'partly'
  if (weatherCode === 3) return 'cloudy'
  if (weatherCode === 45 || weatherCode === 48) return 'fog'
  if (weatherCode >= 51 && weatherCode <= 57) return 'drizzle'
  if ((weatherCode >= 61 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return 'rain'
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) return 'snow'
  if (weatherCode >= 95 && weatherCode <= 99) return 'thunder'
  return 'cloudy'
}

/** Runtime guard for `tool/result.meta` (opaque JSON from the durable log). */
export function isWeatherResult(value: unknown): value is WeatherResult {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.city === 'string'
    && typeof record.latitude === 'number'
    && (record.locationSource === 'ip' || record.locationSource === 'geocode' || record.locationSource === 'default')
    && typeof record.temperature === 'number'
    && typeof record.apparentTemperature === 'number'
    && typeof record.humidity === 'number'
    && typeof record.windSpeed === 'number'
    && typeof record.weatherCode === 'number'
    && typeof record.conditionKey === 'string'
    && typeof record.conditionLabel === 'string'
    && typeof record.isDay === 'boolean'
    && typeof record.updatedAt === 'string'
}

/** Format the canonical value for the model-facing text render. */
export function formatWeatherText(weather: WeatherResult, language: 'zh' | 'en'): string {
  const condition = CONDITION_LABELS[weather.conditionKey]
  const label = weather.conditionLabel || (language === 'zh' ? condition.zh : condition.en)
  const day = weather.isDay
    ? (language === 'zh' ? '白天' : 'day')
    : (language === 'zh' ? '夜间' : 'night')
  const located = weather.locationSource === 'ip'
    ? (language === 'zh' ? `（已自动定位到${weather.city}）` : ` (auto-located to ${weather.city})`)
    : ''
  if (language === 'zh') {
    return `${weather.city}${located}当前${label}（${day}），气温 ${weather.temperature}°C`
      + `（体感 ${weather.apparentTemperature}°C），湿度 ${weather.humidity}%，`
      + `风速 ${weather.windSpeed} km/h。`
  }
  return `${weather.city}${located} is currently ${label.toLowerCase()} (${day}), `
    + `${weather.temperature}°C (feels like ${weather.apparentTemperature}°C), `
    + `humidity ${weather.humidity}%, wind ${weather.windSpeed} km/h.`
}

/** Emoji per condition family, shared with the card icon. */
export const CONDITION_ICONS: Record<WeatherConditionKey, string> = {
  clear: '☀️',
  partly: '🌤️',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '🌨️',
  thunder: '⛈️',
}
