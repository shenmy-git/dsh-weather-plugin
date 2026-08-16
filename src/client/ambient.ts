/**
 * Full-page ambient weather layer. The plugin body owns this overlay (fixed,
 * pointer-events: none, above the app frame but below dialogs), so the whole
 * home page shows the current weather: a translucent per-condition wash, the
 * new soft sun or moon and stars, drifting clouds, falling rain or snow,
 * scheduled lightning flashes for thunderstorms, and seasonal particles
 * (petals in spring, light dots in summer, leaves in autumn). Fog renders on
 * a separate canvas as slow-drifting gradient blobs. The token layer retints
 * every component; this layer paints the motion. All DOM work is imperative
 * and effect-scoped — there is no slot for a full-page backdrop, so the
 * plugin body manages the layer as its own presentation surface.
 */
import type { WeatherResult } from '../weather.ts'
import { seasonOf, type Season } from './companions.ts'
import styles from './weather-effects.module.css'

const DROP_COUNT = 18
const FLAKE_COUNT = 16
const CLOUD_COUNT = 3
const STAR_COUNT = 24
const PETAL_COUNT = 10
const LEAF_COUNT = 8
const LIGHT_DOT_COUNT = 10

function element(className: string, style: Record<string, string> = {}): HTMLElement {
  const node = document.createElement('div')
  node.className = className
  for (const [key, value] of Object.entries(style)) node.style.setProperty(key, value)
  return node
}

/** Build one SVG element from trusted static markup. */
function svgFrom(markup: string): SVGSVGElement {
  const holder = document.createElement('div')
  holder.innerHTML = markup
  return holder.firstElementChild as SVGSVGElement
}

/** The refined drifting cloud (gradient ellipses). */
function cloudSvg(scale: number): SVGSVGElement {
  return svgFrom(
    `<svg viewBox="0 0 150 54" width="${150 * scale}" height="${54 * scale}" fill="none">`
    + '<defs><linearGradient id="dsh-w-cg" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="rgba(245,248,252,0.9)"/>'
    + '<stop offset="1" stop-color="rgba(200,212,228,0.5)"/>'
    + '</linearGradient></defs>'
    + '<g fill="url(#dsh-w-cg)">'
    + '<ellipse cx="45" cy="38" rx="30" ry="14"/>'
    + '<ellipse cx="80" cy="28" rx="34" ry="18"/>'
    + '<ellipse cx="112" cy="38" rx="26" ry="12"/>'
    + '</g></svg>',
  )
}

/** Rainbow arc for the drizzle condition. */
function rainbowSvg(): SVGSVGElement {
  return svgFrom(
    '<svg viewBox="0 0 180 90">'
    + '<defs><linearGradient id="dsh-w-rainbow-g" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="#ff5e5e"/><stop offset="0.2" stop-color="#ffb347"/>'
    + '<stop offset="0.4" stop-color="#ffe14d"/><stop offset="0.6" stop-color="#6ee07a"/>'
    + '<stop offset="0.8" stop-color="#5aa9ff"/><stop offset="1" stop-color="#b07bff"/>'
    + '</linearGradient></defs>'
    + '<path d="M20,90 A70,70 0 0 1 160,90" fill="none" stroke="url(#dsh-w-rainbow-g)" '
    + 'stroke-width="10" stroke-linecap="round" opacity="0.8"/>'
    + '</svg>',
  )
}

/** Canvas fog: slow-drifting radial-gradient blobs. */
class FogCanvas {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private blobs: Array<{
    x: number; y: number; r: number; vx: number; vy: number; a: number
  }> = []
  private raf: number | undefined
  private running = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.className = styles.fogCanvas
    this.canvas.style.position = 'fixed'
    this.canvas.style.inset = '0'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '1000'
    this.ctx = this.canvas.getContext('2d')!
  }

  /** Show fog for the current weather; hidden for every other condition. */
  setVisible(visible: boolean): void {
    if (visible && !this.running) {
      this.resize()
      this.canvas.style.display = 'block'
      this.running = true
      const step = (t: number): void => {
        if (!this.running) return
        this.draw(t / 1000)
        this.raf = requestAnimationFrame(step)
      }
      this.raf = requestAnimationFrame(step)
    } else if (!visible && this.running) {
      this.running = false
      if (this.raf !== undefined) cancelAnimationFrame(this.raf)
      this.canvas.style.display = 'none'
    }
  }

  /** Rebuild blobs for the current viewport. */
  resize(): void {
    const w = this.canvas.width = window.innerWidth
    const h = this.canvas.height = window.innerHeight
    this.blobs = []
    for (let i = 0; i < 7; i++) {
      this.blobs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 180 + Math.random() * 260,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 6,
        a: 0.028 + Math.random() * 0.03,
      })
    }
  }

  /** Remove the canvas (plugin dispose). */
  dispose(): void {
    this.setVisible(false)
    this.canvas.remove()
  }

  private draw(t: number): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (const b of this.blobs) {
      b.x += b.vx * 0.016
      b.y += b.vy * 0.016 + Math.sin(t * 0.4 + b.x * 0.01) * 0.12
      if (b.x < -b.r) b.x = this.canvas.width + b.r
      if (b.x > this.canvas.width + b.r) b.x = -b.r
      if (b.y < -b.r) b.y = this.canvas.height + b.r
      if (b.y > this.canvas.height + b.r) b.y = -b.r
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
      g.addColorStop(0, `rgba(214,220,230,${b.a})`)
      g.addColorStop(1, 'rgba(214,220,230,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** The full-page ambient layer, rebuilt per weather reading. */
export class AmbientWeather {
  private root: HTMLDivElement | undefined
  private flash: HTMLDivElement | undefined
  private flashTimer: ReturnType<typeof setInterval> | undefined
  private readonly fog = new FogCanvas()

  /** Render the overlay for one weather reading; replaces the previous scene. */
  setWeather(weather: WeatherResult): void {
    this.clearScene()
    const root = this.root ?? this.mountRoot()
    const wash = element(styles.wash, {})
    wash.classList.add(styles[weather.conditionKey])
    root.appendChild(wash)

    switch (weather.conditionKey) {
      case 'clear':
        if (weather.isDay) {
          root.appendChild(element(styles.sunV2))
          root.appendChild(element(styles.sunBeams))
        } else {
          root.appendChild(element(styles.moon))
          for (let i = 0; i < STAR_COUNT; i++) {
            root.appendChild(element(styles.star, {
              left: `${Math.random() * 96}%`,
              top: `${Math.random() * 55}%`,
              'animation-delay': `${Math.random() * 2.4}s`,
            }))
          }
        }
        break
      case 'partly':
      case 'cloudy': {
        if (weather.isDay) {
          const glow = element(styles.sunV2)
          glow.style.opacity = weather.conditionKey === 'cloudy' ? '0.35' : '0.6'
          glow.style.transform = 'scale(0.65)'
          root.appendChild(glow)
        }
        const count = weather.conditionKey === 'cloudy' ? CLOUD_COUNT : 2
        for (let i = 0; i < count; i++) {
          const cloud = cloudSvg(0.8 + Math.random() * 0.6)
          cloud.classList.add(styles.cloud)
          cloud.style.top = `${6 + i * 16}%`
          cloud.style.animationDelay = `${-i * 15}s`
          cloud.style.animationDuration = `${38 + i * 12}s`
          root.appendChild(cloud)
        }
        break
      }
      case 'fog':
        this.fog.setVisible(true)
        root.appendChild(element(styles.groundFog))
        break
      case 'drizzle':
        root.appendChild(element(styles.rainbow)).appendChild(rainbowSvg())
        root.appendChild(element(styles.rainSheet, { opacity: '0.55' }))
        this.drops(DROP_COUNT / 2, 1.6)
        break
      case 'rain':
        root.appendChild(element(styles.rainSheet))
        this.drops(DROP_COUNT + 8, 0.7)
        this.splashes()
        root.appendChild(element(styles.groundFog))
        break
      case 'snow':
        for (let i = 0; i < FLAKE_COUNT + 6; i++) {
          root.appendChild(element(styles.flake, {
            left: `${Math.random() * 98}%`,
            'animation-delay': `${-Math.random() * 7}s`,
            'animation-duration': `${5 + Math.random() * 5}s`,
          }))
        }
        break
      case 'thunder':
        root.appendChild(element(styles.rainSheet))
        root.appendChild(element(styles.darkClouds))
        this.drops(DROP_COUNT + 8, 0.7)
        this.splashes()
        root.appendChild(element(styles.groundFog))
        this.armLightning()
        break
    }

    this.seasonalParticles(seasonOf(weather))
  }

  /** Hide the scene while keeping the overlay mounted (ambience toggle). */
  clear(): void {
    this.clearScene()
  }

  /** Remove the overlay and every timer (plugin dispose). */
  dispose(): void {
    this.clearScene()
    for (const node of [this.root, this.flash]) {
      if (node !== undefined && node.parentNode !== null) node.parentNode.removeChild(node)
    }
    this.fog.dispose()
    this.root = undefined
    this.flash = undefined
  }

  private mountRoot(): HTMLDivElement {
    const root = element(styles.overlay) as HTMLDivElement
    const flash = element(styles.flashLayer) as HTMLDivElement
    document.body.appendChild(root)
    document.body.appendChild(flash)
    document.body.appendChild(this.fog.canvas)
    this.root = root
    this.flash = flash
    return root
  }

  private clearScene(): void {
    if (this.flashTimer !== undefined) {
      clearInterval(this.flashTimer)
      this.flashTimer = undefined
    }
    this.fog.setVisible(false)
    this.flash?.classList.remove(styles.flashing)
    this.root?.replaceChildren()
  }

  private drops(count: number, duration: number): void {
    const root = this.root
    if (root === undefined) return
    for (let i = 0; i < count; i++) {
      root.appendChild(element(styles.drop, {
        left: `${Math.random() * 100}%`,
        'animation-delay': `${-Math.random() * duration}s`,
        'animation-duration': `${duration * (0.7 + Math.random() * 0.6)}s`,
      }))
    }
  }

  private seasonalParticles(season: Season): void {
    const root = this.root
    if (root === undefined) return
    if (season === 'spring') {
      for (let i = 0; i < PETAL_COUNT; i++) {
        root.appendChild(element(styles.petal, {
          left: `${Math.random() * 98}%`,
          'animation-delay': `${-Math.random() * 9}s`,
          'animation-duration': `${7 + Math.random() * 5}s`,
        }))
      }
    } else if (season === 'summer') {
      for (let i = 0; i < LIGHT_DOT_COUNT; i++) {
        root.appendChild(element(styles.lightDot, {
          left: `${Math.random() * 96}%`,
          'animation-delay': `${-Math.random() * 8}s`,
          'animation-duration': `${6 + Math.random() * 5}s`,
        }))
      }
    } else if (season === 'autumn') {
      for (let i = 0; i < LEAF_COUNT; i++) {
        root.appendChild(element(styles.leafParticle, {
          left: `${Math.random() * 98}%`,
          'animation-delay': `${-Math.random() * 11}s`,
          'animation-duration': `${8 + Math.random() * 6}s`,
        }))
      }
    }
  }

  private splashes(): void {
    const root = this.root
    if (root === undefined) return
    for (let i = 0; i < 9; i++) {
      root.appendChild(element(styles.splash, {
        left: `${4 + i * 11 + Math.random() * 5}%`,
        'animation-delay': `${-Math.random() * 0.8}s`,
        'animation-duration': `${0.6 + Math.random() * 0.5}s`,
      }))
    }
  }

  private armLightning(): void {
    const flash = () => {
      const layer = this.flash
      if (layer === undefined) return
      layer.classList.remove(styles.flashing)
      // Restart the animation by forcing a reflow between class toggles.
      void layer.offsetWidth
      layer.classList.add(styles.flashing)
    }
    this.flashTimer = setInterval(() => {
      if (Math.random() < 0.65) {
        flash()
        // Double strike shortly after the first flash.
        setTimeout(flash, 260)
      }
    }, 3500)
    // A first strike shortly after the scene appears.
    setTimeout(flash, 1200)
  }
}
