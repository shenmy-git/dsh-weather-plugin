/**
 * IP-based city location. Both providers are free HTTPS endpoints without an
 * API key; the chain tries ipwho.is first and falls back to ipapi.co.
 * Failure returns null so the caller can fall back to the default city.
 */

/** One resolved IP location. */
export interface IpLocation {
  readonly city: string
  readonly country?: string
  readonly latitude: number
  readonly longitude: number
}

interface IpwhoisResponse {
  readonly success?: boolean
  readonly city?: string
  readonly country?: string
  readonly latitude?: number
  readonly longitude?: number
}

interface IpapiCoResponse {
  readonly city?: string
  readonly country_name?: string
  readonly latitude?: number
  readonly longitude?: number
  readonly error?: boolean
}

/** ipwho.is primary endpoint (external spec, stays fixed). */
const IPWHOIS_URL = 'https://ipwho.is/'
/** ipapi.co fallback endpoint (external spec, stays fixed). */
const IPAPI_CO_URL = 'https://ipapi.co/json/'

async function tryIpwhois(timeoutMs: number): Promise<IpLocation | null> {
  const response = await fetch(IPWHOIS_URL, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) return null
  const payload = await response.json() as IpwhoisResponse
  if (payload.success === false || typeof payload.city !== 'string' || typeof payload.latitude !== 'number') {
    return null
  }
  return {
    city: payload.city,
    ...payload.country === undefined ? {} : { country: payload.country },
    latitude: payload.latitude,
    longitude: payload.longitude ?? 0,
  }
}

async function tryIpapiCo(timeoutMs: number): Promise<IpLocation | null> {
  const response = await fetch(IPAPI_CO_URL, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) return null
  const payload = await response.json() as IpapiCoResponse
  if (payload.error === true || typeof payload.city !== 'string' || typeof payload.latitude !== 'number') {
    return null
  }
  return {
    city: payload.city,
    ...payload.country_name === undefined ? {} : { country: payload.country_name },
    latitude: payload.latitude,
    longitude: payload.longitude ?? 0,
  }
}

/**
 * Locate the host machine's city from its public IP address.
 * @param timeoutMs - per-provider timeout.
 * @returns the resolved location, or null when every provider failed.
 */
export async function locateByIp(timeoutMs: number): Promise<IpLocation | null> {
  const primary = await tryIpwhois(timeoutMs)
  if (primary !== null) return primary
  return tryIpapiCo(timeoutMs)
}
