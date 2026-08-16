/**
 * The QQ-pet-style weather cat: a draggable, WALKING cat along the browser's
 * bottom edge. It paces left and right, turning at the edges; clicking it
 * stops it and pops the weather menu (2×4 picker + Live + refresh + ambience
 * + city override + details); dragging it moves it anywhere (it resumes
 * pacing on release). The cat reacts to the weather and can be petted.
 */
import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  CONDITION_ICONS, CONDITION_LABELS, WEATHER_CONDITION_KEYS,
  type WeatherConditionKey, type WeatherResult,
} from '../weather.ts'
import { companionsOf, seasonOf } from './companions.ts'
import { en, zh, type WeatherCardKey } from './locales.ts'
import { WeatherPet } from './pet.tsx'
import { soundProfileOf, WeatherSoundEngine } from './weather-sound.ts'
import styles from './hud.module.css'

export type HudLanguage = 'zh' | 'en'

export interface HudViewState {
  readonly weather: WeatherResult | null
  readonly loading: boolean
  readonly error: string | null
  readonly ambientEnabled: boolean
  readonly expanded: boolean
  readonly language: HudLanguage
  /** Manual weather override; null = live weather. */
  readonly manual: WeatherConditionKey | null
  /** Whether the app is currently in the dark color scheme. */
  readonly dark: boolean
}

export interface WeatherHudCallbacks {
  readonly onRefresh: () => void
  readonly onToggleAmbient: () => void
  readonly onSubmitCity: (city: string) => void
  /** Pick one weather manually; null returns to live weather. */
  readonly onSetWeather: (condition: WeatherConditionKey | null) => void
  /** Toggle the app color scheme between light and dark. */
  readonly onToggleTheme: () => void
}

const DICT = { zh, en }

/** Walking pace in px per tick; tick = 40ms → ~40 px/s. */
const WALK_SPEED = 1.6
/** Cat capsule footprint (used for edge turning). */
const CAT_WIDTH = 120

function HudView({ state, callbacks }: { state: HudViewState; callbacks: WeatherHudCallbacks }) {
  const t = DICT[state.language]
  const [cityDraft, setCityDraft] = useState('')
  const [patting, setPatting] = useState(false)
  const [draft, setDraft] = useState({ expanded: state.expanded })
  const [x, setX] = useState(() => Math.max(8, Math.min(window.innerWidth - CAT_WIDTH, window.innerWidth * 0.55)))
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(true)
  const [soundOn, setSoundOn] = useState(false)
  const soundRef = useRef<WeatherSoundEngine | undefined>(undefined)

  // Ambient sound follows the effective weather: switching the weather pick
  // (or the live weather updating) retunes a playing engine to the new
  // condition's profile. Without any weather reading the engine stays quiet
  // unless the user picked a condition manually.
  const condition = state.manual ?? state.weather?.conditionKey ?? 'cloudy'
  useEffect(() => {
    if (!soundOn) return
    const engine = soundRef.current ?? new WeatherSoundEngine()
    soundRef.current = engine
    engine.stop()
    engine.setVolume(0.5)
    void engine.start(state.weather === null && state.manual === null ? 'quiet' : soundProfileOf(condition))
  }, [condition, soundOn, state.weather, state.manual])

  // Release the audio engine when the HUD unmounts.
  useEffect(() => () => soundRef.current?.stop(), [])

  const toggleSound = (): void => {
    if (soundOn) {
      soundRef.current?.stop()
      setSoundOn(false)
      return
    }
    // The effect below owns (re)starting the engine — one source of truth.
    setSoundOn(true)
  }

  const stateRef = useRef({ x, dir, walking })
  stateRef.current = { x, dir, walking }
  const drag = useRef<{ active: boolean; moved: boolean; startX: number; startY: number; startAt: number; origX: number }>(
    { active: false, moved: false, startX: 0, startY: 0, startAt: 0, origX: 0 },
  )

  // Walking loop: pace along the bottom edge, turning at the viewport edges.
  useEffect(() => {
    const id = setInterval(() => {
      const w = stateRef.current
      if (!w.walking) return
      const max = window.innerWidth - CAT_WIDTH
      const next = w.x + w.dir * WALK_SPEED
      if (next <= 6) {
        setDir(1)
        setX(6)
      } else if (next >= max) {
        setDir(-1)
        setX(max)
      } else {
        setX(next)
      }
    }, 40)
    return () => clearInterval(id)
  }, [])

  const weather = state.weather
  const expanded = draft.expanded

  const pat = (): void => {
    setPatting(true)
    setTimeout(() => setPatting(false), 550)
  }

  const onPointerEnter = (): void => {
    // Stop pacing when the pointer is over the cat so a click lands precisely
    // instead of chasing a moving target (or misreading as a drag).
    setWalking(false)
  }

  const onPointerLeave = (): void => {
    if (!expanded) setWalking(true)
  }

  const onPointerDown = (event: React.PointerEvent): void => {
    setWalking(false)
    drag.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      startAt: performance.now(),
      origX: x,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    const d = drag.current
    if (!d.active) return
    const dx = event.clientX - d.startX
    if (!d.moved && Math.abs(dx) > 12) d.moved = true
    if (!d.moved) return
    setX(Math.max(0, Math.min(window.innerWidth - CAT_WIDTH, d.origX + dx)))
    setDir(dx < 0 ? -1 : 1)
  }

  const onPointerUp = (): void => {
    const d = drag.current
    drag.current.active = false
    // A drag only when the pointer actually travelled; anything short and
    // quick is a click — real mice jitter a few px even on a steady click.
    const quick = performance.now() - d.startAt < 600
    if (d.moved && !quick) {
      // Released after a real drag: resume pacing from here.
      setWalking(true)
      return
    }
    // A click: pat the cat and toggle the menu.
    pat()
    const next = !expanded
    setDraft({ expanded: next })
    setWalking(!next)
  }

  // Panel anchored above the cat, clamped to the viewport. The panel is an
  // absolute child of the HUD (which sits at viewport `left: x`), so the
  // offset is the target viewport position minus the HUD's own left.
  const targetLeft = Math.max(8, Math.min(x - 140, window.innerWidth - 340))
  const panelLeft = targetLeft - x

  const manual = state.manual

  return (
    <div className={styles.hud} style={{ left: x, bottom: 12, right: 'auto' }}>
      {expanded && (
        <div className={styles.panel} style={{ left: panelLeft, bottom: 'calc(100% + 10px)' }}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>
              <div className={styles.cityLine}>
                {weather === null ? (state.loading ? '…' : '--') : weather.city}
                {weather?.locationSource === 'ip' && <span className={styles.locateTag}>📍</span>}
                {manual !== null && <span className={styles.manualTag}>{t.manualWeather}</span>}
              </div>
              <div className={styles.tempLine}>
                {weather === null ? (state.loading ? t.loading : '--') : `${Math.round(weather.temperature)}°C`}
              </div>
              <div className={styles.conditionLine}>
                {weather === null
                  ? (state.error !== null ? t.errorText : '')
                  : `${CONDITION_ICONS[condition]} ${CONDITION_LABELS[condition][state.language]}${weather.isDay ? ` · ${t.day}` : ` · ${t.night}`}`}
              </div>
            </div>
            <button type="button" className={styles.closeButton} onClick={() => { setDraft({ expanded: false }); setWalking(true) }} aria-label="collapse">
              ▾
            </button>
          </div>

          <div className={styles.picker}>
            <span className={styles.pickerLabel}>{t.manualWeather}</span>
            <div className={styles.pickerGrid}>
              {WEATHER_CONDITION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.pickItem} ${condition === key && manual !== null ? styles.pickActive : ''}`}
                  title={CONDITION_LABELS[key][state.language]}
                  onClick={() => callbacks.onSetWeather(condition === key && manual !== null ? null : key)}
                >
                  <span className={styles.pickIcon}>{CONDITION_ICONS[key]}</span>
                  <span className={styles.pickName}>{CONDITION_LABELS[key][state.language]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`${styles.button} ${styles.primary} ${manual === null ? styles.pickActive : ''}`}
              onClick={() => callbacks.onSetWeather(null)}
            >
              ● {t.realtime}
            </button>
          </div>

          {weather !== null && (
            <>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t.feelsLike}</span>
                  <span className={styles.statValue}>{Math.round(weather.apparentTemperature)}°C</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t.humidity}</span>
                  <span className={styles.statValue}>{weather.humidity}%</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t.wind}</span>
                  <span className={styles.statValue}>{Math.round(weather.windSpeed)} km/h</span>
                </div>
              </div>

              <div className={styles.companions}>
                <span>{t.companions}</span>
                <span className={styles.companionPair}>
                  {companionsOf(manual === null ? weather : { ...weather, conditionKey: manual, conditionLabel: '' }).animal}{' '}
                  {companionsOf(manual === null ? weather : { ...weather, conditionKey: manual, conditionLabel: '' }).plant}
                </span>
                <span className={styles.seasonChip}>{t[seasonOf(weather)]}</span>
              </div>

              <div className={styles.fact}>
                <span className={styles.factLabel}>{t.fact}</span>
                {t[companionsOf(manual === null ? weather : { ...weather, conditionKey: manual, conditionLabel: '' }).factKey]}
              </div>
            </>
          )}

          <div className={styles.footer}>
            {weather !== null && (
              <span>{t.updatedAt} {new Date(weather.updatedAt).toLocaleTimeString()}</span>
            )}
            <div className={styles.controls}>
              <button
                type="button"
                className={styles.button}
                onClick={toggleSound}
                title={soundOn ? t.soundOn : t.soundHint}
              >
                {soundOn ? '🔊' : '🔇'}
              </button>
              <button type="button" className={styles.button} onClick={callbacks.onToggleTheme}>
                {state.dark ? '☀️ ' : '🌙 '}{state.dark ? t.lightMode : t.darkMode}
              </button>
              <button type="button" className={styles.button} onClick={callbacks.onRefresh}>{t.refresh}</button>
              <button type="button" className={styles.button} onClick={callbacks.onToggleAmbient}>
                {state.ambientEnabled ? t.hideAmbient : t.showAmbient}
              </button>
            </div>
          </div>

          <form
            className={styles.cityForm}
            onSubmit={(event) => {
              event.preventDefault()
              callbacks.onSubmitCity(cityDraft.trim())
            }}
          >
            <input
              className={styles.cityInput}
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
              placeholder={t.cityPlaceholder}
            />
            <button type="submit" className={`${styles.button} ${styles.primary}`}>{t.citySubmit}</button>
          </form>

          {state.error !== null && <div className={styles.message}>{state.error}</div>}
        </div>
      )}

      <div
        className={`${styles.petCapsule} ${patting ? styles.patting : ''}`}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title={t.patHint}
        role="button"
        aria-label="weather pet"
      >
        <div className={styles.petBox}>
          <WeatherPet condition={condition} isDay={weather?.isDay ?? true} walking={walking} dir={dir} />
        </div>
      </div>
    </div>
  )
}

/** Owns one detached React root for the HUD; the plugin body drives it. */
export class WeatherHud {
  private readonly root: Root
  private state: HudViewState
  private callbacks: WeatherHudCallbacks

  constructor(container: HTMLDivElement, callbacks: WeatherHudCallbacks, initial: HudViewState) {
    this.state = initial
    this.callbacks = callbacks
    this.root = createRoot(container)
    this.root.render(<HudView state={this.state} callbacks={callbacks} />)
  }

  /** Patch the HUD state and re-render. The panel open state is preserved
   * unless the patch explicitly changes it (weather updates must not slam
   * the menu shut mid-interaction). */
  update(patch: Partial<HudViewState>): void {
    this.state = {
      ...this.state,
      ...patch,
      expanded: patch.expanded ?? this.state.expanded,
    }
    this.root.render(<HudView state={this.state} callbacks={this.callbacks} />)
  }

  /** Unmount the root (plugin dispose). */
  dispose(): void {
    this.root.unmount()
  }
}
