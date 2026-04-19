import axios from 'axios'

const PROXY_AUTH_FAILURE_COOLDOWN_MS = 6 * 60 * 60 * 1000
const PROXY_GENERIC_FAILURE_COOLDOWN_MS = 30 * 60 * 1000
const DIRECT_BLOCK_COOLDOWN_MS = 15 * 60 * 1000
const DIRECT_CONSECUTIVE_FAIL_THRESHOLD = 3

// Per-proxy URL suppression (supports multiple proxies)
const proxyUrlSuppressedUntil = new Map()
let directSuppressedUntil = 0
let directConsecutiveFailures = 0

const lastHealthySources = new Map([
  ['list', 'direct'],
  ['detail', 'direct'],
])

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeSourceChannel(channel) {
  const normalized = cleanText(channel).toLowerCase()
  return normalized || 'default'
}

function extractProxyMeta(error) {
  const data = error?.response?.data
  const region = cleanText(data?.region)
  const upstreamOrigin = cleanText(data?.upstreamOrigin || data?.origin)
  const upstreamStatus = Number(data?.encarStatus || data?.upstreamStatus) || null
  const proxyCode = cleanText(data?.code || data?.proxyCode)
  const upstreamSnippet = cleanText(data?.upstreamSnippet)

  return {
    region,
    upstreamOrigin,
    upstreamStatus,
    proxyCode,
    upstreamSnippet,
  }
}

// Parse all configured proxy URLs (ENCAR_PROXY_URLS comma-separated + ENCAR_PROXY_URL single)
export function getEncarProxyUrls(env = globalThis.process?.env) {
  const urls = new Set()
  const single = cleanText(env?.ENCAR_PROXY_URL || '').replace(/\/$/, '')
  if (single) urls.add(single)
  const multi = cleanText(env?.ENCAR_PROXY_URLS || '')
  if (multi) {
    for (const part of multi.split(',')) {
      const url = cleanText(part).replace(/\/$/, '')
      if (url) urls.add(url)
    }
  }
  return [...urls]
}

// Backward-compat: returns first configured proxy URL
export function getEncarProxyUrl(env = globalThis.process?.env) {
  return getEncarProxyUrls(env)[0] || ''
}

export function hasEncarProxy(env = globalThis.process?.env) {
  return getEncarProxyUrls(env).length > 0
}

// Per-URL suppression
function isProxyUrlSuppressed(url) {
  const until = proxyUrlSuppressedUntil.get(url) || 0
  return until > Date.now()
}

function suppressProxyUrl(url, status = 0) {
  if (!url) return
  const durationMs = status === 401 || status === 403 || status === 404 || status === 407
    ? PROXY_AUTH_FAILURE_COOLDOWN_MS
    : PROXY_GENERIC_FAILURE_COOLDOWN_MS
  const current = proxyUrlSuppressedUntil.get(url) || 0
  proxyUrlSuppressedUntil.set(url, Math.max(current, Date.now() + durationMs))
}

// Pick a random non-suppressed proxy URL; null if all suppressed or none configured
export function getActiveProxyUrl(env = globalThis.process?.env) {
  const urls = getEncarProxyUrls(env)
  const available = urls.filter((url) => !isProxyUrlSuppressed(url))
  if (!available.length) return null
  return available[Math.floor(Math.random() * available.length)]
}

// All proxy URLs are suppressed (or none configured)
export function isEncarProxySuppressed(env = globalThis.process?.env) {
  const urls = getEncarProxyUrls(env)
  if (!urls.length) return false
  return urls.every((url) => isProxyUrlSuppressed(url))
}

export function getEncarProxySuppressedUntil() {
  // Return earliest expiry among all suppressed URLs for display
  const now = Date.now()
  let earliest = 0
  for (const [, until] of proxyUrlSuppressedUntil) {
    if (until > now && (earliest === 0 || until < earliest)) earliest = until
  }
  return earliest > now ? new Date(earliest).toISOString() : ''
}

// Suppress all proxy URLs (legacy API kept for compat)
export function suppressEncarProxy(status = 0) {
  const urls = getEncarProxyUrls()
  for (const url of urls) suppressProxyUrl(url, status)
}

export function isEncarDirectSuppressed(env = globalThis.process?.env) {
  return hasEncarProxy(env) && directSuppressedUntil > Date.now()
}

export function getEncarDirectSuppressedUntil() {
  return directSuppressedUntil > Date.now() ? new Date(directSuppressedUntil).toISOString() : ''
}

export function recordEncarDirectFailure(status = 0, env = globalThis.process?.env) {
  if (!hasEncarProxy(env)) {
    directConsecutiveFailures = 0
    directSuppressedUntil = 0
    return
  }
  const isBlockingStatus = status === 403 || status === 407 || status === 429 || status >= 500
  if (!isBlockingStatus) {
    directConsecutiveFailures = 0
    return
  }
  directConsecutiveFailures += 1
  if (directConsecutiveFailures >= DIRECT_CONSECUTIVE_FAIL_THRESHOLD) {
    directSuppressedUntil = Math.max(directSuppressedUntil, Date.now() + DIRECT_BLOCK_COOLDOWN_MS)
  }
}

export function recordEncarDirectSuccess() {
  directConsecutiveFailures = 0
  directSuppressedUntil = 0
}

export function resetEncarDirectSuppression() {
  directConsecutiveFailures = 0
  directSuppressedUntil = 0
}

export function rememberHealthyEncarSource(channel, source) {
  if (source !== 'direct' && source !== 'proxy') return
  lastHealthySources.set(normalizeSourceChannel(channel), source)
}

export function getPreferredEncarSource(channel, fallback = 'direct') {
  return lastHealthySources.get(normalizeSourceChannel(channel)) || fallback
}

export function shouldRetryViaAlternateEncarSource(error) {
  const status = Number(error?.response?.status) || Number(error?.encarDiagnostic?.httpStatus) || 0
  if (!status) return true
  if (status === 403 || status === 407 || status === 408 || status === 425 || status === 429) return true
  return status >= 500
}

export function buildEncarSourceDiagnostic(source, error, reason = '') {
  const proxyMeta = extractProxyMeta(error)

  const diagnostic = {
    source: cleanText(source) || 'unknown',
    reason: cleanText(reason),
    code: cleanText(error?.code),
    httpStatus: Number(error?.response?.status) || Number(error?.encarDiagnostic?.httpStatus) || null,
    message: cleanText(error?.message),
  }

  if (proxyMeta.region) diagnostic.region = proxyMeta.region
  if (proxyMeta.upstreamOrigin) diagnostic.upstreamOrigin = proxyMeta.upstreamOrigin
  if (proxyMeta.upstreamStatus) diagnostic.upstreamStatus = proxyMeta.upstreamStatus
  if (proxyMeta.proxyCode) diagnostic.proxyCode = proxyMeta.proxyCode
  if (proxyMeta.upstreamSnippet) diagnostic.upstreamSnippet = proxyMeta.upstreamSnippet

  return diagnostic
}

export function buildEncarSourceFailureSummary(sourceDiagnostics = []) {
  return sourceDiagnostics
    .map((item) => {
      const bits = [
        cleanText(item?.source || 'unknown'),
        item?.httpStatus ? `http=${item.httpStatus}` : '',
        item?.upstreamStatus ? `upstream=${item.upstreamStatus}` : '',
        cleanText(item?.code || ''),
        cleanText(item?.reason || ''),
      ].filter(Boolean)
      return bits.join(':')
    })
    .filter(Boolean)
    .join(', ')
}

export function decorateEncarSourceError(error, channel = 'list', env = globalThis.process?.env) {
  if (!error) return error

  const status = Number(error?.response?.status) || Number(error?.encarDiagnostic?.httpStatus) || 0
  const sourceDiagnostics = Array.isArray(error?.fetchSourceDiagnostics) ? error.fetchSourceDiagnostics : []
  const failureSummary = buildEncarSourceFailureSummary(sourceDiagnostics)
  const proxyConfigured = hasEncarProxy(env)
  const proxyFailed = sourceDiagnostics.some((item) => item?.source?.startsWith('proxy'))
  const directFailed = sourceDiagnostics.some((item) => item?.source?.startsWith('direct'))
  const suppressedUntil = getEncarProxySuppressedUntil()

  if (status === 407) {
    if (proxyConfigured && proxyFailed && directFailed) {
      error.message = `Both direct and proxy Encar routes returned 407. ${cleanText(error.message)}`
    } else if (proxyConfigured && proxyFailed && !directFailed) {
      error.message = `Encar proxy route returned 407 and was suppressed temporarily${suppressedUntil ? ` until ${suppressedUntil}` : ''}. ${cleanText(error.message)}`
    } else if (proxyConfigured && directFailed) {
      error.message = `Encar ${channel} request returned 407. Automatic direct/proxy failover is active. ${cleanText(error.message)}`
    } else if (!proxyConfigured) {
      error.message = `Encar ${channel} request returned 407 on the direct route. Configure ENCAR_PROXY_URL only if you want a backup path. ${cleanText(error.message)}`
    }
  }

  if (failureSummary && !cleanText(error.message).includes(failureSummary)) {
    error.message = `${cleanText(error.message)} [sources: ${failureSummary}]`.trim()
  }

  return error
}

// Fetch via a randomly selected non-suppressed proxy.
// On failure the used proxy URL is individually suppressed.
export async function fetchViaEncarProxy(params = {}, requestConfig = {}, env = globalThis.process?.env) {
  const proxyUrl = getActiveProxyUrl(env)
  if (!proxyUrl) {
    const configured = getEncarProxyUrls(env)
    throw new Error(
      configured.length
        ? 'All configured Encar proxies are currently suppressed'
        : 'ENCAR_PROXY_URL / ENCAR_PROXY_URLS is not configured',
    )
  }

  try {
    const response = await axios.get(proxyUrl, {
      timeout: 25000,
      proxy: false,
      params,
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...requestConfig.headers,
      },
      ...requestConfig,
    })
    return response.data
  } catch (error) {
    const status = Number(error?.response?.status) || 0
    suppressProxyUrl(proxyUrl, status)
    throw error
  }
}
