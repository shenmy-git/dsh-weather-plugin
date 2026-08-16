/**
 * Keyed toolview for the `weather` tool: a collapsible compact card. The
 * collapsed row is one line (icon · temperature · city · condition · sound
 * toggle); expanding reveals stats, the companion pair, and the fact. The
 * card stays out of the way — the full-page ambient layer carries the visual
 * weight. Theme/ambience updates ride the inject face (`applyWeather`).
 */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { CONDITION_ICONS, isWeatherResult, type WeatherConditionKey, type WeatherResult } from '../weather.ts'
import { companionsOf, seasonOf } from './companions.ts'
import { NS, type WeatherCardKey } from './locales.ts'
import { soundProfileOf, WeatherSoundEngine } from './weather-sound.ts'
import styles from './weather-card.module.css'

/** The registrant business face: apply the weather-derived theme + ambient layer. */
export interface WeatherCardInjected {
  applyWeather: (weather: WeatherResult) => void
}

/** Full row props: the toolview runtime share plus the locale seat plus the injected face. */
export type WeatherCardProps = ToolCallViewProps & PropsLocale<typeof NS> & WeatherCardInjected

/** The weather card row: one compact line, expandable. */
export function WeatherCard({ block, t, applyWeather }: WeatherCardProps) {
  const weather = 'kind' in block && block.kind === 'tool-result' && isWeatherResult(block.meta)
    ? block.meta
    : null

  const soundRef = useRef<WeatherSoundEngine | undefined>(undefined)
  const [soundOn, setSoundOn] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (weather !== null) applyWeather(weather)
  }, [weather, applyWeather])

  /** Retune the playing engine to one condition (or silence). */
  const playFor = (key: WeatherConditionKey | undefined): void => {
    const engine = soundRef.current ?? new WeatherSoundEngine()
    soundRef.current = engine
    engine.stop()
    engine.setVolume(0.5)
    void engine.start(key === undefined ? 'quiet' : soundProfileOf(key))
  }

  const conditionKey = weather?.conditionKey
  useEffect(() => {
    if (!soundOn) return
    playFor(conditionKey)
  }, [conditionKey, soundOn])

  useEffect(() => () => soundRef.current?.stop(), [])

  const toggleSound = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
    if (soundOn) {
      soundRef.current?.stop()
      setSoundOn(false)
      return
    }
    // The effect below owns (re)starting the engine — one source of truth.
    setSoundOn(true)
  }

  if (weather === null) {
    const failed = 'kind' in block && block.kind === 'tool-result' && block.isError
    return (
      <div className={styles.card}>
        <div className={styles.placeholder}>{failed ? t('error') : t('running')}</div>
      </div>
    )
  }

  const companion = companionsOf(weather)

  return (
    <div className={styles.card}>
      <button type="button" className={styles.bar} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className={styles.barIcon}>{CONDITION_ICONS[weather.conditionKey]}</span>
        <span className={styles.barTemp}>{Math.round(weather.temperature)}°</span>
        <span className={styles.barCity}>
          {weather.city}
          {weather.locationSource === 'ip' ? ' · 📍' : ''}
        </span>
        <span className={styles.barCond}>{weather.conditionLabel}</span>
        <span className={styles.barSpacer} />
        <span
          className={styles.soundButton}
          role="button"
          tabIndex={0}
          onClick={toggleSound}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSound(e) }}
          title={soundOn ? t('soundOn') : t('soundHint')}
        >
          {soundOn ? '🔊' : '🔇'}
        </span>
        <span className={styles.barArrow}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className={styles.detail}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('feelsLike')}</span>
              <span className={styles.statValue}>{Math.round(weather.apparentTemperature)}°C</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('humidity')}</span>
              <span className={styles.statValue}>{weather.humidity}%</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('wind')}</span>
              <span className={styles.statValue}>{Math.round(weather.windSpeed)} km/h</span>
            </div>
          </div>

          <div className={styles.companions}>
            <span>{t('companions')}</span>
            <span className={styles.companionPair}>{companion.animal} {companion.plant}</span>
            <span className={styles.seasonChip}>{t(seasonOf(weather))}</span>
          </div>

          <div className={styles.fact}>
            <span className={styles.factLabel}>{t('fact')}</span>
            {t(companion.factKey)}
          </div>

          <div className={styles.meta}>
            {t('updatedAt')} {new Date(weather.updatedAt).toLocaleTimeString()}
            {weather.isDay ? ` · ${t('day')}` : ` · ${t('night')}`}
          </div>
        </div>
      )}
    </div>
  )
}
