/**
 * Client half of dsh-weather-plugin: the resident weather state, the keyed
 * `weather` toolview, the theme override layer, the full-page ambient
 * overlay, and the QQ-pet-style HUD cat.
 *
 * The plugin is resident: on load it fetches weather straight from the
 * browser (IP geolocation + Open-Meteo, both CORS-open) and applies the
 * theme + ambience without any model question; a model answer overrides the
 * state. The HUD cat opens a menu with a manual weather picker (theme,
 * ambience, and pet all follow the pick), a Live button back to the real
 * weather, refresh, an ambience toggle, and a manual city override.
 *
 * Discovered through the package.json `dsh.client` declaration and
 * `exports["./client"]`: `dsh-client-modules` serves this bundle at
 * /plugins/dsh-weather-plugin/client.js once the package is a live host entry.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { CONDITION_LABELS, type WeatherConditionKey, type WeatherResult } from '../weather.ts'
import { AmbientWeather } from './ambient.ts'
import { WeatherHud, type HudLanguage } from './hud.tsx'
import { WeatherCard, type WeatherCardInjected } from './WeatherCard.tsx'
import { NS, en, zh } from './locales.ts'
import { weatherTokens } from './theme.ts'
import { fetchWeatherInBrowser } from './weather-client.ts'

export const name = 'dsh-weather-plugin'

export type { WeatherCardInjected, WeatherCardProps } from './WeatherCard.tsx'

export const inject = ['slots', 'locale', 'theme']

/** localStorage key remembering the manual city override. */
const CITY_OVERRIDE_KEY = 'dsh-weather-plugin:city'
/** localStorage key remembering the manual weather override. */
const WEATHER_OVERRIDE_KEY = 'dsh-weather-plugin:weather'
/** Resident refresh interval (the HUD also refreshes manually). */
const REFRESH_INTERVAL_MS = 30 * 60 * 1000

const WEATHER_KEYS: readonly WeatherConditionKey[] = [
  'clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder',
]

function loadOverride<T>(key: string, is: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return is(parsed) ? parsed : null
  } catch {
    return null
  }
}

const isConditionKey = (value: unknown): value is WeatherConditionKey =>
  typeof value === 'string' && (WEATHER_KEYS as readonly string[]).includes(value)

/**
 * Client plugin body: resident weather loop + toolview + theme/ambience/HUD.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const ambient = new AmbientWeather()
  let themeDisposer: (() => void) | undefined
  let hud: WeatherHud | undefined
  let current: WeatherResult | null = null
  let ambientEnabled = true
  let manual: WeatherConditionKey | null = loadOverride(WEATHER_OVERRIDE_KEY, isConditionKey)

  const language = (): HudLanguage => (ctx.locale.getLocale().active === 'en' ? 'en' : 'zh')

  /** The weather actually applied: the live reading, or the manual override. */
  const effectiveWeather = (weather: WeatherResult): WeatherResult =>
    manual === null
      ? weather
      : { ...weather, conditionKey: manual, conditionLabel: CONDITION_LABELS[manual][language()] }

  /** Apply one weather reading to theme, ambience, and HUD. The current
   * manual override rides along, so the HUD's picker selection, the pet's
   * condition and the ambient sound all follow the manual pick. */
  const applyWeatherState = (weather: WeatherResult): void => {
    current = weather
    const effective = effectiveWeather(weather)
    if (ambientEnabled) {
      themeDisposer?.()
      themeDisposer = ctx.theme.overrideTokens('dsh-weather-plugin', weatherTokens(effective))
      ambient.setWeather(effective)
    }
    hud?.update({ weather: effective, loading: false, error: null, manual })
  }

  /** Resident or manual refresh; `city` empty resolves through the browser IP. */
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const clearRetry = (): void => {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
  }
  const refresh = async (city?: string): Promise<void> => {
    hud?.update({ loading: true, error: null })
    try {
      const weather = await fetchWeatherInBrowser(city ?? '', language())
      if (city !== undefined && city.length > 0) {
        localStorage.setItem(CITY_OVERRIDE_KEY, city)
      }
      clearRetry()
      applyWeatherState(weather)
    } catch (error) {
      hud?.update({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
      // Transient provider failures (flaky egress, rate limits) retry on a
      // backoff-free cadence until the weather lands or the user refreshes.
      if (retryTimer === undefined) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined
          void refresh(city)
        }, 20000)
      }
    }
  }

  const toggleAmbient = (): void => {
    ambientEnabled = !ambientEnabled
    if (ambientEnabled) {
      if (current !== null) {
        themeDisposer = ctx.theme.overrideTokens('dsh-weather-plugin', weatherTokens(effectiveWeather(current)))
        ambient.setWeather(effectiveWeather(current))
      }
    } else {
      themeDisposer?.()
      themeDisposer = undefined
      ambient.clear()
    }
    hud?.update({ ambientEnabled })
  }

  /** Manual weather pick: override the condition, or return to live. The HUD
   * selection always follows immediately — even while a weather reading is
   * still pending or failed — so the picker never looks stale. */
  const setManualWeather = (condition: WeatherConditionKey | null): void => {
    manual = condition
    if (condition === null) localStorage.removeItem(WEATHER_OVERRIDE_KEY)
    else localStorage.setItem(WEATHER_OVERRIDE_KEY, JSON.stringify(condition))
    hud?.update({ manual: condition })
    if (current !== null) {
      applyWeatherState(current)
    } else {
      void refresh(localStorage.getItem(CITY_OVERRIDE_KEY) ?? '')
    }
  }

  /** Toggle the app color scheme through the official theme service. */
  const toggleTheme = (): void => {
    const active = ctx.theme.getTheme().active.colorScheme
    ctx.theme.setTheme(active === 'dark' ? 'light' : 'dark')
  }

  ctx.effect(
    () => {
      // Mount the HUD and start the resident weather loop.
      const container = document.createElement('div')
      document.body.appendChild(container)
      hud = new WeatherHud(container, {
        onRefresh: () => void refresh(),
        onToggleAmbient: toggleAmbient,
        onSubmitCity: (city) => void refresh(city),
        onSetWeather: setManualWeather,
        onToggleTheme: toggleTheme,
      }, {
        weather: null,
        loading: true,
        error: null,
        ambientEnabled: true,
        expanded: false,
        language: language(),
        manual,
        dark: ctx.theme.getTheme().active.colorScheme === 'dark',
      })
      const start = setTimeout(() => void refresh(localStorage.getItem(CITY_OVERRIDE_KEY) ?? ''), 600)
      const interval = setInterval(() => void refresh(localStorage.getItem(CITY_OVERRIDE_KEY) ?? ''), REFRESH_INTERVAL_MS)
      return () => {
        clearTimeout(start)
        clearInterval(interval)
        clearRetry()
        hud?.dispose()
        hud = undefined
        container.remove()
      }
    },
    'dsh-weather-plugin: resident weather HUD',
  )
  ctx.effect(
    () => () => ambient.dispose(),
    'dsh-weather-plugin: full-page ambient overlay',
  )
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    'dsh-weather-plugin: weather card dictionaries',
  )

  // Keep the HUD copy in the active UI language.
  ctx.on('locale/change', (snapshot) => {
    hud?.update({ language: snapshot.active === 'en' ? 'en' : 'zh' })
    if (current !== null && manual !== null) {
      applyWeatherState(current)
    }
  })

  // Keep the HUD's dark-mode indicator in sync with the theme service.
  ctx.on('theme/change', (snapshot) => {
    hud?.update({ dark: snapshot.active.colorScheme === 'dark' })
  })

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'weather',
    locale: NS,
    inject: (): WeatherCardInjected => ({
      applyWeather: applyWeatherState,
    }),
  }, WeatherCard))
}
