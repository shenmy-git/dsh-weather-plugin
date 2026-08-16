/**
 * Host half of dsh-weather-plugin: the model-facing `weather` tool.
 *
 * Queries Open-Meteo (free, no API key): geocoding first, then current
 * conditions. The canonical output attaches as `tool/result.meta`
 * (presentationMeta), which the client half's keyed toolview reads back to
 * render the weather card and to retint the app theme.
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { locateByIp } from './geoip.ts'
import {
  buildWeatherResult,
  formatWeatherText,
  WEATHER_CONDITION_KEYS,
  type ForecastCurrent,
  type LocationSource,
  type ResolvedLocation,
  type WeatherResult,
} from './weather.ts'

export const name = 'dsh-weather-plugin'

export interface Config {
  /** City used when the model omits the `city` argument and IP location fails or is disabled. */
  defaultCity: string
  /** Language of the model-facing text render and condition labels. */
  language: 'zh' | 'en'
  /** Locate the host machine's city from its public IP when no city argument is given. */
  autoLocate: boolean
  /** Abort the upstream fetch after this many milliseconds. */
  timeoutMs: number
}

export const Config: Schema<Config> = Schema.object({
  defaultCity: Schema.string().default('北京'),
  language: Schema.union(['zh', 'en']).default('zh'),
  autoLocate: Schema.boolean().default(true),
  timeoutMs: Schema.number().default(10000),
})

export const inject = ['tools']

/** Open-Meteo geocoding endpoint (external spec, stays fixed). */
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search'
/** Open-Meteo forecast endpoint (external spec, stays fixed). */
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'

interface GeocodeResponse {
  readonly results?: ResolvedLocation[]
}

interface ForecastResponse {
  readonly current?: ForecastCurrent
}

/** Resolve a city name to coordinates through Open-Meteo geocoding. */
async function geocode(city: string, language: 'zh' | 'en', timeoutMs: number): Promise<ResolvedLocation> {
  const url = `${GEOCODING_BASE}?name=${encodeURIComponent(city)}&count=1&language=${language}`
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) {
    throw new Error(`weather: geocoding failed with HTTP ${response.status}`)
  }
  const payload = await response.json() as GeocodeResponse
  const result = payload.results?.[0]
  if (result === undefined) {
    throw new Error(`weather: 未找到城市 "${city}" / city not found: "${city}"`)
  }
  return result
}

/** Fetch current conditions for one resolved location. */
async function currentConditions(
  location: ResolvedLocation,
  language: 'zh' | 'en',
  timeoutMs: number,
): Promise<ForecastCurrent> {
  const url = `${FORECAST_BASE}`
    + `?latitude=${location.latitude}&longitude=${location.longitude}`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day`
    + `&timezone=auto&language=${language}`
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) {
    throw new Error(`weather: forecast failed with HTTP ${response.status}`)
  }
  const payload = await response.json() as ForecastResponse
  if (payload.current === undefined) {
    throw new Error('weather: forecast response carried no current conditions')
  }
  return payload.current
}

/**
 * Query current weather for one city.
 * @param city - city name; empty auto-locates through the public IP when
 * enabled and falls back to the configured default city.
 * @param config - validated plugin configuration.
 * @returns the canonical weather result.
 */
export async function fetchWeather(city: string, config: Config): Promise<WeatherResult> {
  const query = city.trim()
  let location: ResolvedLocation
  let locationSource: LocationSource
  if (query.length > 0) {
    location = await geocode(query, config.language, config.timeoutMs)
    locationSource = 'geocode'
  } else if (config.autoLocate) {
    const ip = await locateByIp(config.timeoutMs)
    if (ip !== null) {
      location = { latitude: ip.latitude, longitude: ip.longitude, name: ip.city, ...ip.country === undefined ? {} : { country: ip.country } }
      locationSource = 'ip'
    } else {
      location = await geocode(config.defaultCity, config.language, config.timeoutMs)
      locationSource = 'default'
    }
  } else {
    location = await geocode(config.defaultCity, config.language, config.timeoutMs)
    locationSource = 'default'
  }
  const current = await currentConditions(location, config.language, config.timeoutMs)
  return buildWeatherResult(location, current, config.language, locationSource)
}

export function apply(ctx: Context, config: Config): void {
  ctx.tools.register(defineTool({
    name: 'weather',
    description: '查询指定城市当前的天气情况（温度、体感、湿度、风速、天气现象）。'
      + '查询结果会同步改变应用的界面主题色。',
    parameters: {
      city: {
        type: 'string',
        description: '城市名称，例如 "北京"、"上海"、"Tokyo"。省略时使用插件配置的默认城市。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          city: { type: 'string', required: true },
          country: { type: 'string' },
          latitude: { type: 'number', required: true },
          locationSource: { type: 'string', enum: ['ip', 'geocode', 'default'], required: true },
          temperature: { type: 'number', required: true },
          apparentTemperature: { type: 'number', required: true },
          humidity: { type: 'number', required: true },
          windSpeed: { type: 'number', required: true },
          weatherCode: { type: 'number', required: true },
          conditionKey: { type: 'string', enum: WEATHER_CONDITION_KEYS, required: true },
          conditionLabel: { type: 'string', required: true },
          isDay: { type: 'boolean', required: true },
          updatedAt: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatWeatherText(value, config.language) }],
      presentationMeta: (_args, value) => value,
    },
    async execute(args) {
      return fetchWeather(args.city ?? '', config)
    },
  }))
}
