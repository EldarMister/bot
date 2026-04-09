export const PARSE_SCOPE_ALL = 'all'
export const PARSE_SCOPE_DOMESTIC = 'domestic'
export const PARSE_SCOPE_IMPORTED = 'imported'
export const PARSE_SCOPE_JAPANESE = 'japanese'
export const PARSE_SCOPE_GERMAN = 'german'

export const FILTER_MODE_SCOPE = 'scope'
export const FILTER_MODE_BRAND = 'brand'
export const FILTER_MODE_CUSTOM = 'custom'

const JAPANESE_MANUFACTURER_TOKENS = [
  '도요타',
  '렉서스',
  '혼다',
  '닛산',
  '인피니티',
  '마쯔다',
  '스바루',
  '미쯔비시',
  '스즈키',
  '이스즈',
  '다이하쯔',
  '어큐라',
]

const GERMAN_MANUFACTURER_TOKENS = [
  'BMW',
  '벤츠',
  '아우디',
  '폭스바겐',
  '포르쉐',
  '미니',
  '스마트',
  '마이바흐',
  '오펠',
]

export const BRAND_PRESETS = Object.freeze([
  { key: 'hyundai', label: 'Hyundai', button: '🇰🇷 Hyundai', manufacturerTokens: ['현대'], scope: PARSE_SCOPE_DOMESTIC, signals: ['hyundai', 'hyeondae', '현대'] },
  { key: 'kia', label: 'Kia', button: '🇰🇷 Kia', manufacturerTokens: ['기아'], scope: PARSE_SCOPE_DOMESTIC, signals: ['kia', 'gia', '기아'] },
  { key: 'genesis', label: 'Genesis', button: '🇰🇷 Genesis', manufacturerTokens: ['제네시스'], scope: PARSE_SCOPE_DOMESTIC, signals: ['genesis', 'jenesiseu', '제네시스'] },
  { key: 'chevrolet', label: 'Chevrolet', button: '🇰🇷 Chevrolet', manufacturerTokens: ['쉐보레'], scope: PARSE_SCOPE_DOMESTIC, signals: ['chevrolet', '쉐보레'] },
  { key: 'renault-samsung', label: 'Renault Samsung', button: '🇰🇷 Renault Samsung', manufacturerTokens: ['르노코리아', '르노삼성'], scope: PARSE_SCOPE_DOMESTIC, signals: ['renault', 'renaultsamsung', 'renaultkorea', 'reunokoria', '르노코리아', '르노삼성', 'samsung', 'samseong'] },
  { key: 'kg-mobility', label: 'KG Mobility', button: '🇰🇷 KG Mobility', manufacturerTokens: ['KG모빌리티', '쌍용'], scope: PARSE_SCOPE_DOMESTIC, signals: ['kgmobility', 'kgmobilriti', '쌍용', 'ssangyong'] },
  { key: 'toyota', label: 'Toyota', button: '🇯🇵 Toyota', manufacturerTokens: ['도요타'], scope: PARSE_SCOPE_IMPORTED, signals: ['toyota', '도요타'] },
  { key: 'lexus', label: 'Lexus', button: '🇯🇵 Lexus', manufacturerTokens: ['렉서스'], scope: PARSE_SCOPE_IMPORTED, signals: ['lexus', '렉서스'] },
  { key: 'honda', label: 'Honda', button: '🇯🇵 Honda', manufacturerTokens: ['혼다'], scope: PARSE_SCOPE_IMPORTED, signals: ['honda', '혼다'] },
  { key: 'nissan', label: 'Nissan', button: '🇯🇵 Nissan', manufacturerTokens: ['닛산'], scope: PARSE_SCOPE_IMPORTED, signals: ['nissan', '닛산'] },
  { key: 'bmw', label: 'BMW', button: '🇩🇪 BMW', manufacturerTokens: ['BMW'], scope: PARSE_SCOPE_IMPORTED, signals: ['bmw'] },
  { key: 'mercedes-benz', label: 'Mercedes-Benz', button: '🇩🇪 Mercedes-Benz', manufacturerTokens: ['벤츠'], scope: PARSE_SCOPE_IMPORTED, signals: ['mercedes', 'mercedesbenz', 'benz', '벤츠'] },
  { key: 'audi', label: 'Audi', button: '🇩🇪 Audi', manufacturerTokens: ['아우디'], scope: PARSE_SCOPE_IMPORTED, signals: ['audi', '아우디'] },
  { key: 'volkswagen', label: 'Volkswagen', button: '🇩🇪 Volkswagen', manufacturerTokens: ['폭스바겐'], scope: PARSE_SCOPE_IMPORTED, signals: ['volkswagen', 'vw', '폭스바겐'] },
  { key: 'porsche', label: 'Porsche', button: '🇩🇪 Porsche', manufacturerTokens: ['포르쉐'], scope: PARSE_SCOPE_IMPORTED, signals: ['porsche', '포르쉐'] },
  { key: 'mini', label: 'MINI', button: '🇩🇪 MINI', manufacturerTokens: ['미니'], scope: PARSE_SCOPE_IMPORTED, signals: ['mini', '미니'] },
  { key: 'tesla', label: 'Tesla', button: '⚡ Tesla', manufacturerTokens: ['테슬라'], scope: PARSE_SCOPE_IMPORTED, signals: ['tesla', '테슬라'] },
  { key: 'volvo', label: 'Volvo', button: '🇸🇪 Volvo', manufacturerTokens: ['볼보'], scope: PARSE_SCOPE_IMPORTED, signals: ['volvo', '볼보'] },
  { key: 'land-rover', label: 'Land Rover', button: '🇬🇧 Land Rover', manufacturerTokens: ['랜드로버'], scope: PARSE_SCOPE_IMPORTED, signals: ['landrover', 'land rover', '랜드로버'] },
  { key: 'jeep', label: 'Jeep', button: '🇺🇸 Jeep', manufacturerTokens: ['지프'], scope: PARSE_SCOPE_IMPORTED, signals: ['jeep', '지프'] },
])

const BRAND_PRESET_MAP = new Map(BRAND_PRESETS.map((preset) => [preset.key, preset]))

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function escapeQueryToken(value) {
  return cleanText(value).replace(/\./g, '')
}

function normalizeSignal(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9\uac00-\ud7a3]+/g, '')
}

function buildManufacturerOrQuery(tokens = []) {
  const nodes = tokens
    .map((value) => escapeQueryToken(value))
    .filter(Boolean)
    .map((value) => `Manufacturer.${value}.`)

  if (!nodes.length) return ''
  if (nodes.length === 1) return nodes[0]
  return `(Or.${nodes.join('_.')})`
}

function wrapYearScopedQuery(scopePrefix, manufacturerTokens = []) {
  const manufacturerOr = buildManufacturerOrQuery(manufacturerTokens)
  if (!manufacturerOr) return `${scopePrefix}.Year.range(201900..).)`
  return `${scopePrefix}.Year.range(201900..)._.${manufacturerOr})`
}

function buildScopeListQuery(parseScope = PARSE_SCOPE_ALL) {
  const normalizedScope = normalizeParseScope(parseScope)
  if (normalizedScope === PARSE_SCOPE_DOMESTIC) return '(And.Hidden.N._.CarType.Y._.Year.range(201900..).)'
  if (normalizedScope === PARSE_SCOPE_IMPORTED) return '(And.Hidden.N._.CarType.N._.Year.range(201900..).)'
  if (normalizedScope === PARSE_SCOPE_JAPANESE) return wrapYearScopedQuery('(And.Hidden.N._.CarType.N._', JAPANESE_MANUFACTURER_TOKENS)
  if (normalizedScope === PARSE_SCOPE_GERMAN) return wrapYearScopedQuery('(And.Hidden.N._.CarType.N._', GERMAN_MANUFACTURER_TOKENS)
  return '(And.Hidden.N._.Year.range(201900..).)'
}

function buildBrandListQuery(brandKey = '') {
  const preset = getBrandPreset(brandKey)
  if (!preset) return buildScopeListQuery(PARSE_SCOPE_ALL)

  if (preset.scope === PARSE_SCOPE_DOMESTIC) {
    return wrapYearScopedQuery('(And.Hidden.N._.CarType.Y._', preset.manufacturerTokens)
  }

  if (preset.scope === PARSE_SCOPE_IMPORTED) {
    return wrapYearScopedQuery('(And.Hidden.N._.CarType.N._', preset.manufacturerTokens)
  }

  return wrapYearScopedQuery('(And.Hidden.N._', preset.manufacturerTokens)
}

function hashText(value) {
  const text = cleanText(value)
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function extractCustomQueryFromUrl(rawUrl) {
  let candidate = cleanText(rawUrl)
  if (!candidate) return null
  if (!/^https?:\/\//i.test(candidate) && /encar\.com/i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`
  }

  let url
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  let query = cleanText(url.searchParams.get('q'))
  if (!query && url.hash.includes('?')) {
    const hashQuery = url.hash.slice(url.hash.indexOf('?') + 1)
    const params = new URLSearchParams(hashQuery)
    query = cleanText(params.get('q'))
  }

  if (!query) return null
  return {
    url: url.toString(),
    query,
  }
}

export function normalizeParseScope(value) {
  return value === PARSE_SCOPE_DOMESTIC
    || value === PARSE_SCOPE_IMPORTED
    || value === PARSE_SCOPE_JAPANESE
    || value === PARSE_SCOPE_GERMAN
    ? value
    : PARSE_SCOPE_ALL
}

export function normalizeFilterMode(value) {
  return value === FILTER_MODE_BRAND || value === FILTER_MODE_CUSTOM
    ? value
    : FILTER_MODE_SCOPE
}

export function normalizeBrandKey(value) {
  const normalized = cleanText(value).toLowerCase()
  return BRAND_PRESET_MAP.has(normalized) ? normalized : ''
}

export function getBrandPreset(brandKey = '') {
  return BRAND_PRESET_MAP.get(normalizeBrandKey(brandKey)) || null
}

export function getScopeLabel(parseScope) {
  if (parseScope === PARSE_SCOPE_DOMESTIC) return 'Корейские'
  if (parseScope === PARSE_SCOPE_IMPORTED) return 'Все импортные'
  if (parseScope === PARSE_SCOPE_JAPANESE) return 'Японские'
  if (parseScope === PARSE_SCOPE_GERMAN) return 'Немецкие'
  return 'Все машины'
}

export function getFilterSummary(session = {}) {
  const filterMode = normalizeFilterMode(session?.filterMode)
  if (filterMode === FILTER_MODE_BRAND) {
    const preset = getBrandPreset(session?.brandKey)
    return preset ? `Марка: ${preset.label}` : 'Марка не выбрана'
  }
  if (filterMode === FILTER_MODE_CUSTOM) {
    return 'Свой фильтр Encar'
  }
  return getScopeLabel(normalizeParseScope(session?.parseScope))
}

export function getSessionFilterKey(session = {}) {
  const filterMode = normalizeFilterMode(session?.filterMode)
  if (filterMode === FILTER_MODE_BRAND) {
    const brandKey = normalizeBrandKey(session?.brandKey)
    return brandKey ? `brand:${brandKey}` : `scope:${normalizeParseScope(session?.parseScope)}`
  }

  if (filterMode === FILTER_MODE_CUSTOM) {
    const query = cleanText(session?.customFilterQuery)
    return query ? `custom:${hashText(query)}` : `scope:${normalizeParseScope(session?.parseScope)}`
  }

  return `scope:${normalizeParseScope(session?.parseScope)}`
}

export function resolveSessionListQuery(session = {}) {
  const filterMode = normalizeFilterMode(session?.filterMode)
  if (filterMode === FILTER_MODE_BRAND) {
    return buildBrandListQuery(session?.brandKey)
  }
  if (filterMode === FILTER_MODE_CUSTOM) {
    return cleanText(session?.customFilterQuery) || buildScopeListQuery(session?.parseScope)
  }
  return buildScopeListQuery(session?.parseScope)
}

export function matchesBrandPreset(listing = {}, brandKey = '') {
  const preset = getBrandPreset(brandKey)
  if (!preset) return false

  const haystack = [
    listing?.manufacturer,
    listing?.name,
    listing?.model,
  ].map((value) => normalizeSignal(value))
    .filter(Boolean)

  return haystack.some((value) => preset.signals.some((signal) => value.includes(normalizeSignal(signal)) || normalizeSignal(signal).includes(value)))
}

export function parseCustomFilterInput(value) {
  const raw = cleanText(value)
  if (!raw) return null
  if (raw.startsWith('(') && raw.endsWith(')') && raw.includes('Year.range')) {
    return { url: '', query: raw }
  }
  return extractCustomQueryFromUrl(raw)
}
