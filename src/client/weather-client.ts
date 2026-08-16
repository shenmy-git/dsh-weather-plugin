/**
 * Browser-side weather fetch for the resident (always-on) weather state.
 * Runs entirely in the browser: IP geolocation (ipwho.is → ipapi.co, both
 * CORS-open), Open-Meteo geocoding and forecast (CORS-open). This is what
 * makes the plugin ambient without any model question — the page queries on
 * load and the result drives the theme, the ambient layer, and the HUD pet.
 */
import {
  buildWeatherResult,
  type ForecastCurrent,
  type LocationSource,
  type ResolvedLocation,
  type WeatherResult,
} from '../weather.ts'

/** Open-Meteo geocoding endpoint (external spec, stays fixed). */
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search'
/** Open-Meteo forecast endpoint (external spec, stays fixed). */
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'
/** ipwho.is primary endpoint (external spec, stays fixed). */
const IPWHOIS_URL = 'https://ipwho.is/'
/** ipapi.co fallback endpoint (external spec, stays fixed). */
const IPAPI_CO_URL = 'https://ipapi.co/json/'

interface GeocodeResponse {
  readonly results?: ResolvedLocation[]
}

interface ForecastResponse {
  readonly current?: ForecastCurrent
}

async function geocodeCity(city: string, language: 'zh' | 'en', timeoutMs: number): Promise<ResolvedLocation> {
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

async function locateByIpInBrowser(timeoutMs: number): Promise<ResolvedLocation | null> {
  for (const url of [IPWHOIS_URL, IPAPI_CO_URL]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (!response.ok) continue
      const payload = await response.json() as Record<string, unknown>
      const city = payload.city
      const latitude = payload.latitude
      if (typeof city !== 'string' || typeof latitude !== 'number') continue
      const country = payload.country
      const longitude = payload.longitude
      return {
        name: city,
        ...typeof country === 'string' ? { country } : {},
        latitude,
        longitude: typeof longitude === 'number' ? longitude : 0,
      }
    } catch {
      // try the next provider
    }
  }
  return null
}

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
 * Resident weather fetch in the browser.
 * @param city - explicit city; empty resolves through the browser's public IP.
 * @param language - condition-label language.
 * @param timeoutMs - per-request timeout.
 * @returns the canonical weather result.
 * @throws when every location route fails.
 */
export async function fetchWeatherInBrowser(
  city: string,
  language: 'zh' | 'en',
  timeoutMs = 10000,
): Promise<WeatherResult> {
  const query = city.trim()
  let location: ResolvedLocation
  let locationSource: LocationSource
  if (query.length > 0) {
    location = await geocodeCity(query, language, timeoutMs)
    locationSource = 'geocode'
  } else {
    const ip = await locateByIpInBrowser(timeoutMs)
    if (ip === null) {
      throw new Error('weather: IP location failed (no provider answered)')
    }
    location = ip
    locationSource = 'ip'
  }
  const current = await currentConditions(location, language, timeoutMs)
  return buildWeatherResult(location, current, language, locationSource)
}
