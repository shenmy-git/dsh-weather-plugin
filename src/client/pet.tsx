/**
 * The weather pet: DeepSeek's official FishLogo whale, drawn on canvas with
 * the exact logo silhouette path (src/client/assets/fish-logo.ts) and the
 * same part-split animation as the harness WhalePet. The one-path silhouette
 * is clipped into body (x 0..18) and tail (x 15..23.16) so the tail wags
 * around its joint at (15.5, 8.5); the dorsal and pectoral fins are separate
 * moving parts; the fill is the official vertical gradient; the eye is a
 * white dot with a blue pupil that blinks and wanders; a cartoon fountain
 * rises from the blowhole at (5.2, 5.8). The whale faces LEFT in the logo's
 * own space, so the pet mirrors on X when moving right. Weather rides small
 * vector accessories drawn in the same space, so parts, accessories and the
 * spout all mirror and tilt together. Zero third-party assets.
 */
import { useEffect, useRef } from 'react'
import type { WeatherConditionKey } from '../weather.ts'
import { FISH_D } from './assets/fish-logo.ts'
import styles from './pet.module.css'

export interface PetProps {
  readonly condition: WeatherConditionKey
  readonly isDay: boolean
  /** Swim cycle (bobbing + tail) vs gentle idle. */
  readonly walking?: boolean
  /** Direction of travel; -1 faces the logo's native left. */
  readonly dir?: 1 | -1
}

/** The logo's own coordinate space (FishLogo viewBox). */
const VIEW_W = 23.16
const VIEW_H = 17.04
const CANVAS_W = 120
const CANVAS_H = 90
/** Logo space → canvas px (full-bleed scale). */
const S = CANVAS_W / VIEW_W
/** The pet itself: ~67% of full-bleed — a small whale, not a billboard. */
const PET_S = S * 0.67

/** Blowhole spot (on the head, not the tail) in logo space. */
const SPOUT_BX = 5.2
const SPOUT_BY = 5.8
const SPOUT_JET_H = 11.5
const SPOUT_ON = 2.8

/** Dorsal fin, rising from the back (base hidden by the body). */
const DORSAL_D = 'M 7.0 1.8 Q 9.0 -2.0 11.3 1.5 Q 9.3 2.8 7.0 1.8 Z'
/** Pectoral fin, flapping on the side. */
const PECTORAL_D = 'M 9.4 10.6 Q 11.6 14.2 8.8 13.6 Q 9.0 11.8 9.4 10.6 Z'

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const easeOutCubic = (p: number): number => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}

/** The official vertical gradient: light rim on top, deep blue under. */
function whaleGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  grad.addColorStop(0, '#8fd6f0')
  grad.addColorStop(0.35, '#2f9cc9')
  grad.addColorStop(0.7, '#1781b3')
  grad.addColorStop(1, '#0b5a84')
  return grad
}

/** Fill the whole logo silhouette (clipped by the caller). */
function fillFish(ctx: CanvasRenderingContext2D, grad: CanvasGradient): void {
  ctx.fillStyle = grad
  ctx.fill(new Path2D(FISH_D))
}

/** Body: the logo's front mass (x 0..18), with a light belly clip. */
function drawBody(ctx: CanvasRenderingContext2D, grad: CanvasGradient): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, 18, VIEW_H)
  ctx.clip()
  fillFish(ctx, grad)
  drawBelly(ctx)
  ctx.restore()
}

/** Tail: the logo's rear lobe (x 15..23.16), wagging around its joint. */
function drawTail(ctx: CanvasRenderingContext2D, grad: CanvasGradient, wag: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(15, 0, 8.16, VIEW_H)
  ctx.clip()
  ctx.translate(15.5, 8.5)
  ctx.rotate(wag)
  ctx.translate(-15.5, -8.5)
  fillFish(ctx, grad)
  drawBelly(ctx)
  ctx.restore()
}

/** Light underbelly, clipped to the logo's lower body. */
function drawBelly(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 9, VIEW_W, 8.2)
  ctx.clip()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#e3f6fd'
  ctx.fill(new Path2D(FISH_D))
  ctx.restore()
}

function drawDorsal(ctx: CanvasRenderingContext2D, grad: CanvasGradient, rot: number): void {
  ctx.save()
  ctx.translate(9.1, 1.6)
  ctx.rotate(rot)
  ctx.translate(-9.1, -1.6)
  ctx.fillStyle = grad
  ctx.fill(new Path2D(DORSAL_D))
  ctx.restore()
}

function drawPectoral(ctx: CanvasRenderingContext2D, rot: number): void {
  ctx.save()
  ctx.translate(9.6, 11)
  ctx.rotate(rot)
  ctx.translate(-9.6, -11)
  ctx.fillStyle = 'rgba(14, 106, 152, 0.85)'
  ctx.fill(new Path2D(PECTORAL_D))
  ctx.restore()
}

function eyeMood(condition: WeatherConditionKey, isDay: boolean): 'happy' | 'scared' | 'sleepy' | 'normal' {
  if (condition === 'thunder') return 'scared'
  if (condition === 'drizzle' || condition === 'cloudy') return 'sleepy'
  if (condition === 'clear' && isDay) return 'happy'
  return 'normal'
}

/** The white-dot eye with blue pupil: blinks and wanders, mood per weather. */
function drawEye(ctx: CanvasRenderingContext2D, t: number, condition: WeatherConditionKey, isDay: boolean): void {
  const mood = eyeMood(condition, isDay)
  const blink = Math.sin(t * 1.35) > 0.97 ? 0.15 : 1
  const moodR = mood === 'happy' ? 0.72 : mood === 'sleepy' ? 0.3 : mood === 'scared' ? 0.78 : 0.6
  const lookX = Math.sin(t * 0.7) * 0.5
  const lookY = Math.cos(t * 0.55) * 0.35
  const ex = 12.1 + lookX
  const ey = 8.3 + lookY
  if (mood === 'scared') {
    // wide white eye, small centered pupil
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex, ey, 0.75 * blink, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0b4a70'
    ctx.beginPath()
    ctx.arc(ex + 0.06, ey + 0.08, 0.3 * blink, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const r = moodR * blink
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(ex, ey, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0b4a70'
  ctx.beginPath()
  ctx.arc(ex + 0.18 * r, ey + 0.22 * r, 0.3 * r, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * A real-fountain spout in the logo's own space (mirrors/tilts with the pet):
 * a rising tapered water column with a bright core, a pulsing water bulb on
 * top, beads falling down both sides and a base splash.
 */
function drawSpout(ctx: CanvasRenderingContext2D, t: number): void {
  const fadeIn = clamp01(t / 0.08)
  const fadeOut = t > 2.6 ? clamp01((SPOUT_ON - t) / 0.4) : 1
  const alpha = Math.min(1, fadeIn * fadeOut)
  const jetP = clamp01((t - 0.04) / 1.0)
  const jetH = SPOUT_JET_H * easeOutCubic(jetP)
  const sway = Math.sin(t * 5.5) * 0.35
  const baseW = 1.15 * (1 - jetP * 0.15)

  ctx.globalAlpha = alpha
  // the rising column
  const grad = ctx.createLinearGradient(0, SPOUT_BY, 0, SPOUT_BY - jetH)
  grad.addColorStop(0, 'rgba(244,252,255,0.95)')
  grad.addColorStop(0.55, 'rgba(214,242,252,0.85)')
  grad.addColorStop(1, 'rgba(200,238,250,0.1)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(SPOUT_BX - baseW / 2, SPOUT_BY)
  ctx.quadraticCurveTo(SPOUT_BX - 0.42, SPOUT_BY - jetH * 0.55, SPOUT_BX + sway, SPOUT_BY - jetH)
  ctx.quadraticCurveTo(SPOUT_BX + 0.42, SPOUT_BY - jetH * 0.55, SPOUT_BX + baseW / 2, SPOUT_BY)
  ctx.closePath()
  ctx.fill()
  // its bright white core
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.moveTo(SPOUT_BX - 0.32, SPOUT_BY)
  ctx.quadraticCurveTo(SPOUT_BX - 0.14, SPOUT_BY - jetH * 0.5, SPOUT_BX + sway * 0.5, SPOUT_BY - jetH + 0.4)
  ctx.quadraticCurveTo(SPOUT_BX + 0.14, SPOUT_BY - jetH * 0.5, SPOUT_BX + 0.32, SPOUT_BY)
  ctx.closePath()
  ctx.fill()
  // the pulsing water bulb on top
  const bp = clamp01((t - 0.45) / 1.0)
  const swell = bp < 0.75 ? easeOutBack(bp / 0.75) : 1 - ((bp - 0.75) / 0.25) * 0.2
  const r = (1.0 + 1.35 * swell) * (1 + Math.sin(t * 20) * 0.05)
  const bx = SPOUT_BX + sway
  const by = SPOUT_BY - jetH + 0.35
  const ball = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r)
  ball.addColorStop(0, 'rgba(255,255,255,0.98)')
  ball.addColorStop(0.55, 'rgba(232,247,253,0.92)')
  ball.addColorStop(1, 'rgba(191,232,248,0.65)')
  ctx.fillStyle = ball
  ctx.beginPath()
  ctx.arc(bx, by, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(bx - r * 0.3, by - r * 0.32, r * 0.24, 0, Math.PI * 2)
  ctx.fill()
  // beads falling down both sides
  for (let i = 0; i < 8; i++) {
    const p = clamp01((t - 0.6 - i * 0.1) / 1.5)
    if (p <= 0 || p >= 1) continue
    const side = i % 2 === 0 ? 1 : -1
    const dx = side * (0.5 + p * 3.0 + Math.sin(t * 7 + i) * 0.3)
    const dy = p * 4.6
    ctx.globalAlpha = alpha * (1 - p * 0.7)
    ctx.fillStyle = '#eaf7ff'
    ctx.beginPath()
    ctx.arc(bx + dx, by + dy, 0.16 + (1 - p) * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  // base splash arcs
  ctx.globalAlpha = alpha * 0.8
  ctx.strokeStyle = 'rgba(190,238,255,0.9)'
  ctx.lineWidth = 0.14
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const p2 = clamp01((t - 0.35 - i * 0.15) / 0.9)
    ctx.beginPath()
    ctx.moveTo(SPOUT_BX + side * 0.5, SPOUT_BY - 0.3)
    ctx.quadraticCurveTo(SPOUT_BX + side * (1.1 + p2 * 1.4), SPOUT_BY - 0.9 - p2 * 1.2, SPOUT_BX + side * (0.4 + p2 * 2.2), SPOUT_BY + 0.3 + p2 * 0.4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Small vector accessories anchored above the head, in logo space. */
function drawAccessory(ctx: CanvasRenderingContext2D, t: number, condition: WeatherConditionKey, isDay: boolean): void {
  if (condition === 'rain') {
    // umbrella over the head, swaying
    ctx.save()
    ctx.translate(4.0, 2.3)
    ctx.rotate(Math.sin(t * 2.4) * 0.12)
    ctx.fillStyle = '#4f8fe6'
    ctx.beginPath()
    ctx.moveTo(-2.0, 0)
    ctx.quadraticCurveTo(0, -2.3, 2.0, 0)
    ctx.quadraticCurveTo(1.0, 0.35, 0, 0.35)
    ctx.quadraticCurveTo(-1.0, 0.35, -2.0, 0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 0.1
    for (const x of [-1, 0, 1]) {
      ctx.beginPath()
      ctx.moveTo(x * 0.66, 0.05)
      ctx.lineTo(x * 0.66, -1.7)
      ctx.stroke()
    }
    ctx.strokeStyle = '#2f5ea8'
    ctx.lineWidth = 0.22
    ctx.beginPath()
    ctx.moveTo(0, 0.32)
    ctx.lineTo(0, 2.6)
    ctx.stroke()
    ctx.restore()
  } else if (condition === 'snow') {
    // scarf around the neck + drifting snowflakes
    ctx.strokeStyle = '#e2545c'
    ctx.lineWidth = 0.7
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(6.4, 5.4)
    ctx.quadraticCurveTo(7.8, 7.2, 9.2, 6.2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(9.2, 6.4)
    ctx.quadraticCurveTo(10.6, 6.8, 11.3, 7.8)
    ctx.stroke()
    ctx.fillStyle = '#eaf7ff'
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.5 + i * 0.21) % 1
      const fx = 1.6 + ph * 7.5
      const fy = -1.6 + Math.sin(t * 2 + i * 1.7) * 0.5 + ph * 2.2
      ctx.globalAlpha = 0.9 - ph * 0.5
      ctx.beginPath()
      ctx.arc(fx, fy, 0.18, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (condition === 'thunder') {
    // bolt flashing above the head
    const flash = Math.sin(t * 7) > 0.3
    ctx.fillStyle = flash ? '#fff3b0' : '#ffd94d'
    ctx.beginPath()
    ctx.moveTo(4.9, -0.3)
    ctx.lineTo(3.6, 1.5)
    ctx.lineTo(4.4, 1.5)
    ctx.lineTo(3.7, 3.3)
    ctx.lineTo(5.4, 0.7)
    ctx.lineTo(4.5, 0.7)
    ctx.closePath()
    ctx.fill()
  } else if (condition === 'clear' && isDay) {
    // sun with rotating rays
    ctx.save()
    ctx.translate(4.0, 1.2)
    ctx.rotate(t * 0.5)
    ctx.strokeStyle = '#ffd94d'
    ctx.lineWidth = 0.28
    ctx.lineCap = 'round'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 1.2, Math.sin(a) * 1.2)
      ctx.lineTo(Math.cos(a) * 1.75, Math.sin(a) * 1.75)
      ctx.stroke()
    }
    ctx.fillStyle = '#ffd94d'
    ctx.beginPath()
    ctx.arc(0, 0, 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  } else if (condition === 'clear' && !isDay) {
    // crescent moon
    ctx.fillStyle = '#e8e4d8'
    ctx.beginPath()
    ctx.arc(4.2, 1.2, 0.95, 0.25 * Math.PI, 1.75 * Math.PI)
    ctx.arc(4.62, 1.05, 0.82, 1.75 * Math.PI, 0.25 * Math.PI, true)
    ctx.closePath()
    ctx.fill()
  } else if (condition === 'partly' || condition === 'cloudy') {
    // small cloud
    ctx.fillStyle = '#dfe8f5'
    ctx.beginPath()
    ctx.arc(3.4, 2.2, 0.7, 0, Math.PI * 2)
    ctx.arc(4.4, 1.8, 0.95, 0, Math.PI * 2)
    ctx.arc(5.3, 2.2, 0.65, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.rect(2.7, 2.0, 3.2, 0.85)
    ctx.fill()
  } else if (condition === 'fog') {
    // drifting mist lines
    ctx.strokeStyle = '#d8dee8'
    ctx.lineWidth = 0.35
    ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const y = 1.1 + i * 0.7 + Math.sin(t * 1.4 + i) * 0.12
      ctx.beginPath()
      ctx.moveTo(1.6, y)
      ctx.lineTo(6.6, y)
      ctx.stroke()
    }
  } else if (condition === 'drizzle') {
    // light rain streaks
    ctx.strokeStyle = '#7fb4f0'
    ctx.lineWidth = 0.22
    for (let i = 0; i < 4; i++) {
      const ph = (t * 1.6 + i * 0.27) % 1
      const x = 2.2 + i * 1.15
      const y = -1.8 + ph * 3.4
      ctx.globalAlpha = 1 - ph * 0.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 0.15, y + 0.6)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

/** One frame of the logo whale at time `t`, facing left (dir = -1). */
function drawWhale(
  ctx: CanvasRenderingContext2D,
  t: number,
  condition: WeatherConditionKey,
  isDay: boolean,
  swimming: boolean,
  spoutAt: number,
  dir: 1 | -1,
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // pet layout: small whale centred horizontally, sitting above the shadow
  const offsetX = (CANVAS_W - VIEW_W * PET_S) / 2
  const offsetY = CANVAS_H - VIEW_H * PET_S - 5
  const whaleBottom = offsetY + VIEW_H * PET_S

  // ground shadow (canvas px, stays put while the whale bobs)
  ctx.fillStyle = 'rgba(8, 60, 120, 0.12)'
  ctx.beginPath()
  ctx.ellipse(CANVAS_W / 2, whaleBottom + 3, 38, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  // mirror when moving right — the logo whale faces left
  if (dir > 0) {
    ctx.translate(CANVAS_W, 0)
    ctx.scale(-1, 1)
  }
  // whole-body motion: bob, spout lift, breathing, gentle bank + S-sway
  const st = t - spoutAt
  const spouting = st >= 0 && st < SPOUT_ON
  const bob = swimming ? Math.sin(t * 2.4) * 1.5 : Math.sin(t * 1.5) * 0.8
  ctx.translate(offsetX, offsetY + (spouting ? -8 : 0) + bob)
  ctx.scale(PET_S, PET_S)
  const breathe = 1 + Math.sin(t * 4.2) * 0.008
  const bank = Math.sin(t * 2.2) * 0.028
  const skew = Math.sin(t * 1.6) * 0.026
  ctx.translate(VIEW_W / 2, VIEW_H / 2)
  ctx.scale(breathe, breathe)
  ctx.rotate(bank)
  ctx.transform(1, 0, skew, 1, 0, 0)
  ctx.translate(-VIEW_W / 2, -VIEW_H / 2)

  // articulated parts: slow, heavy cadence like a real whale
  const wagSpeed = swimming ? 3.9 : 2.6
  const wagAmp = swimming ? 9 : 4
  const toRad = Math.PI / 180
  const wag = Math.sin(t * wagSpeed) * wagAmp * toRad
  const dorsalRot = Math.sin(t * 3.2 + 1) * 2.5 * toRad
  const pectoralRot = Math.sin(t * 3.8 + 2) * 6 * toRad

  const grad = whaleGradient(ctx)
  drawDorsal(ctx, grad, dorsalRot)
  drawBody(ctx, grad)
  drawTail(ctx, grad, wag)
  drawPectoral(ctx, pectoralRot)
  drawEye(ctx, t, condition, isDay)

  // bubbles from the mouth while swimming (head is on the left)
  if (swimming) {
    ctx.fillStyle = '#dcecff'
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.8 + i * 0.33) % 1
      ctx.globalAlpha = 0.8 - ph * 0.6
      ctx.beginPath()
      ctx.arc(2.4 + ph * 0.8, 9.8 - ph * 2.4, 0.18 + (1 - ph) * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  if (spouting) drawSpout(ctx, st)

  // weather accessory rides on top of the head (dim while spouting)
  ctx.globalAlpha = spouting ? 0.4 : 1
  drawAccessory(ctx, t, condition, isDay)
  ctx.globalAlpha = 1

  ctx.restore()
}

/** The weather pet: the official FishLogo whale, cruising along the bottom. */
export function WeatherPet({ condition, isDay, walking = false, dir = 1 }: PetProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    let raf = 0
    const start = performance.now()
    // next spout start, seconds after mount (first spout ~2.5s in)
    const spoutAt = { value: 2.5 }
    const frame = (now: number): void => {
      const t = (now - start) / 1000
      drawWhale(ctx, t, condition, isDay, walking, spoutAt.value, dir)
      if (t - spoutAt.value > SPOUT_ON + 1) {
        spoutAt.value = t + 4.5 + Math.random() * 5
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [condition, isDay, walking, dir])

  return <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className={styles.canvas} aria-hidden="true" />
}
