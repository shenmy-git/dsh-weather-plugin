/**
 * Procedural ambient sound engine (Web Audio, no audio files). Profiles map
 * each weather condition to a synthesized loop: breeze/wind from filtered
 * noise with a slow LFO, rain/drizzle/snow from shaped noise, thunder as rain
 * plus random low-frequency booms. The AudioContext is created lazily inside
 * `start()` so it always rides a user gesture (autoplay policy).
 */

import type { WeatherConditionKey } from '../weather.ts'

export type SoundProfile = 'breeze' | 'wind' | 'rain' | 'drizzle' | 'snow' | 'thunder' | 'quiet'

/** The sound profile for one condition family. */
export function soundProfileOf(condition: WeatherConditionKey): SoundProfile {
  switch (condition) {
    case 'clear': return 'breeze'
    case 'partly': return 'breeze'
    case 'cloudy': return 'wind'
    case 'fog': return 'quiet'
    case 'drizzle': return 'drizzle'
    case 'rain': return 'rain'
    case 'snow': return 'snow'
    case 'thunder': return 'thunder'
  }
}

interface ActiveSound {
  readonly master: GainNode
  readonly stops: readonly (() => void)[]
  readonly boomTimer: ReturnType<typeof setInterval> | undefined
}

/** One playback session; start() creates the AudioContext (user-gesture only). */
export class WeatherSoundEngine {
  private context: AudioContext | undefined
  private active: ActiveSound | undefined
  private volume = 0.5

  /** Whether a session is currently playing. */
  isPlaying(): boolean {
    return this.active !== undefined
  }

  /**
   * Start the profile loop. Must be called from a user gesture the first time
   * (browsers block AudioContext creation otherwise).
   * @param profile - the sound profile to play.
   */
  async start(profile: SoundProfile): Promise<void> {
    this.stop()
    if (profile === 'quiet' || typeof AudioContext === 'undefined') return
    const AudioCtor: typeof AudioContext = AudioContext
    const context = this.context ?? new AudioCtor()
    this.context = context
    if (context.state === 'suspended') await context.resume()

    const master = context.createGain()
    master.gain.value = this.volume
    master.connect(context.destination)

    const stops: (() => void)[] = []
    let boomTimer: ReturnType<typeof setInterval> | undefined

    /** Two-second noise buffer (white or integrated brown). */
    const noise = (kind: 'white' | 'brown'): AudioBuffer => {
      const length = Math.floor(context.sampleRate * 2)
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        last = kind === 'brown' ? (last + 0.02 * white) / 1.02 : white
        data[i] = kind === 'brown' ? last * 3.5 : white
      }
      return buffer
    }

    /** Loop one noise buffer through a filter chain into a per-loop level gain. */
    const loop = (buffer: AudioBuffer, filters: BiquadFilterNode[], gain: number): void => {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const first = filters[0]
      source.connect(first)
      for (let i = 0; i + 1 < filters.length; i++) filters[i].connect(filters[i + 1])
      const level = context.createGain()
      level.gain.value = gain
      filters[filters.length - 1].connect(level)
      level.connect(master)
      source.start()
      stops.push(() => { source.stop() })
    }

    const lowpass = (frequency: number): BiquadFilterNode => {
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = frequency
      return filter
    }
    const highpass = (frequency: number): BiquadFilterNode => {
      const filter = context.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = frequency
      return filter
    }

    switch (profile) {
      case 'breeze': {
        // clear skies: faint air with a slow swell — quiet, not rainy
        const filter = lowpass(360)
        loop(noise('white'), [filter], 0.045)
        const lfo = context.createOscillator()
        const lfoGain = context.createGain()
        lfo.frequency.value = 0.09
        lfoGain.gain.value = 0.025
        lfo.connect(lfoGain)
        lfoGain.connect(master.gain)
        lfo.start()
        stops.push(() => { lfo.stop() })
        break
      }
      case 'wind': {
        // overcast: a low rumble that surges — unmistakably wind, not rain.
        // Brown noise (low-frequency-rich) through a deep low-pass reads as a
        // distant gust, where rain needs high-frequency hiss.
        const filter = lowpass(240)
        loop(noise('brown'), [filter], 0.22)
        const lfo = context.createOscillator()
        const lfoGain = context.createGain()
        lfo.frequency.value = 0.06
        lfoGain.gain.value = 150
        lfo.connect(lfoGain)
        lfoGain.connect(filter.frequency)
        lfo.start()
        stops.push(() => { lfo.stop() })
        const surge = context.createOscillator()
        const surgeGain = context.createGain()
        surge.frequency.value = 0.23
        surgeGain.gain.value = 0.06
        surge.connect(surgeGain)
        surgeGain.connect(master.gain)
        surge.start()
        stops.push(() => { surge.stop() })
        break
      }
      case 'rain': {
        loop(noise('white'), [highpass(250), lowpass(2200)], 0.28)
        loop(noise('white'), [highpass(250), lowpass(2200)], 0.20)
        break
      }
      case 'drizzle': {
        loop(noise('white'), [highpass(400), lowpass(1600)], 0.14)
        break
      }
      case 'snow': {
        // snowfall: faint high hiss with drifting intensity — much lighter
        // than rain (no mid-band body), so it never reads as a downpour.
        const filter = highpass(1600)
        loop(noise('white'), [filter], 0.028)
        const lfo = context.createOscillator()
        const lfoGain = context.createGain()
        lfo.frequency.value = 0.11
        lfoGain.gain.value = 0.014
        lfo.connect(lfoGain)
        lfoGain.connect(master.gain)
        lfo.start()
        stops.push(() => { lfo.stop() })
        break
      }
      case 'thunder': {
        loop(noise('white'), [highpass(250), lowpass(1800)], 0.12)
        const boom = (): void => {
          const source = context.createBufferSource()
          source.buffer = noise('brown')
          const low = lowpass(140)
          const envelope = context.createGain()
          const now = context.currentTime
          envelope.gain.setValueAtTime(0, now)
          envelope.gain.linearRampToValueAtTime(0.5, now + 0.06)
          envelope.gain.exponentialRampToValueAtTime(0.001, now + 2.6)
          source.connect(low)
          low.connect(envelope)
          envelope.connect(master)
          source.start(now)
          source.stop(now + 3)
        }
        boomTimer = setInterval(() => {
          if (Math.random() < 0.6) boom()
        }, 6000)
        // First rumble shortly after start.
        const initialBoom = setTimeout(boom, 700)
        stops.push(() => { clearTimeout(initialBoom) })
        break
      }
    }

    this.active = { master, stops, boomTimer }
  }

  /** Stop playback and release every node. */
  stop(): void {
    const active = this.active
    this.active = undefined
    if (active === undefined) return
    for (const stop of active.stops) {
      try { stop() } catch { /* already stopped */ }
    }
    if (active.boomTimer !== undefined) clearInterval(active.boomTimer)
    try { active.master.disconnect() } catch { /* already disconnected */ }
    if (this.context !== undefined) void this.context.suspend()
  }

  /** Set the master volume (0..1); applies to the active session. */
  setVolume(volume: number): void {
    this.volume = volume
    if (this.active !== undefined) {
      this.active.master.gain.value = volume
    }
  }
}
