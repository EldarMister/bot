export const PARSE_SCOPE_ALL = 'all'
export const PARSE_SCOPE_DOMESTIC = 'domestic'
export const PARSE_SCOPE_IMPORTED = 'imported'
export const PARSE_SCOPE_JAPANESE = 'japanese'
export const PARSE_SCOPE_GERMAN = 'german'

export const FILTER_MODE_SCOPE = 'scope'
export const FILTER_MODE_BRAND = 'brand'
export const FILTER_MODE_CUSTOM = 'custom'

export const BRAND_FILTER_MIN_YEAR = 2000
export const BRAND_FILTER_MAX_YEAR = 2026

export const YEAR_OPTIONS = Object.freeze(
  Array.from(
    { length: BRAND_FILTER_MAX_YEAR - BRAND_FILTER_MIN_YEAR + 1 },
    (_, index) => BRAND_FILTER_MAX_YEAR - index,
  ),
)

export const MONTH_OPTIONS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => index + 1),
)

const DEFAULT_BRAND_YEAR = 2019
const DEFAULT_BRAND_MONTH = 1

const JAPANESE_MANUFACTURER_TOKENS = [
  '도요타',
  '렉서스',
  '혼다',
  '닛산',
  '인피니티',
  '마쯔다',
  '스바루',
  '미쓰비시',
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
  { key: 'chevrolet', label: 'Chevrolet', button: '🇰🇷 Chevrolet', manufacturerTokens: ['쉐보레(GM대우)', '쉐보레'], scope: PARSE_SCOPE_DOMESTIC, signals: ['chevrolet', '쉐보레'] },
  { key: 'renault-samsung', label: 'Renault Samsung', button: '🇰🇷 Renault Samsung', manufacturerTokens: ['르노코리아(삼성)', '르노코리아', '르노삼성'], scope: PARSE_SCOPE_DOMESTIC, signals: ['renault', 'renaultsamsung', 'renaultkorea', 'reunokoria', '르노코리아', '르노삼성', 'samsung', 'samseong'] },
  { key: 'kg-mobility', label: 'KG Mobility', button: '🇰🇷 KG Mobility', manufacturerTokens: ['KG모빌리티(쌍용)', 'KG모빌리티', '쌍용'], scope: PARSE_SCOPE_DOMESTIC, signals: ['kgmobility', 'kgmobilriti', '쌍용', 'ssangyong'] },
  { key: 'toyota', label: 'Toyota', button: '🇯🇵 Toyota', manufacturerTokens: ['도요타'], scope: PARSE_SCOPE_IMPORTED, signals: ['toyota', '도요타'] },
  { key: 'lexus', label: 'Lexus', button: '🇯🇵 Lexus', manufacturerTokens: ['렉서스'], scope: PARSE_SCOPE_IMPORTED, signals: ['lexus', '렉서스'] },
  { key: 'honda', label: 'Honda', button: '🇯🇵 Honda', manufacturerTokens: ['혼다'], scope: PARSE_SCOPE_IMPORTED, signals: ['honda', '혼다'] },
  { key: 'nissan', label: 'Nissan', button: '🇯🇵 Nissan', manufacturerTokens: ['닛산'], scope: PARSE_SCOPE_IMPORTED, signals: ['nissan', '닛산'] },
  { key: 'subaru', label: 'Subaru', button: '🇯🇵 Subaru', manufacturerTokens: ['스바루'], scope: PARSE_SCOPE_IMPORTED, signals: ['subaru', '스바루'] },
  { key: 'mazda', label: 'Mazda', button: '🇯🇵 Mazda', manufacturerTokens: ['마쯔다'], scope: PARSE_SCOPE_IMPORTED, signals: ['mazda', '마쯔다', '마쯔다'] },
  { key: 'infiniti', label: 'Infiniti', button: '🇯🇵 Infiniti', manufacturerTokens: ['인피니티'], scope: PARSE_SCOPE_IMPORTED, signals: ['infiniti', '인피니티'] },
  { key: 'bmw', label: 'BMW', button: '🇩🇪 BMW', manufacturerTokens: ['BMW'], scope: PARSE_SCOPE_IMPORTED, signals: ['bmw'] },
  { key: 'mercedes-benz', label: 'Mercedes-Benz', button: '🇩🇪 Mercedes', manufacturerTokens: ['벤츠'], scope: PARSE_SCOPE_IMPORTED, signals: ['mercedes', 'mercedesbenz', 'benz', '벤츠'] },
  { key: 'audi', label: 'Audi', button: '🇩🇪 Audi', manufacturerTokens: ['아우디'], scope: PARSE_SCOPE_IMPORTED, signals: ['audi', '아우디'] },
  { key: 'volkswagen', label: 'Volkswagen', button: '🇩🇪 VW', manufacturerTokens: ['폭스바겐'], scope: PARSE_SCOPE_IMPORTED, signals: ['volkswagen', 'vw', '폭스바겐'] },
  { key: 'porsche', label: 'Porsche', button: '🇩🇪 Porsche', manufacturerTokens: ['포르쉐'], scope: PARSE_SCOPE_IMPORTED, signals: ['porsche', '포르쉐'] },
  { key: 'mini', label: 'MINI', button: '🇩🇪 MINI', manufacturerTokens: ['미니'], scope: PARSE_SCOPE_IMPORTED, signals: ['mini', '미니'] },
  { key: 'ford', label: 'Ford', button: '🇺🇸 Ford', manufacturerTokens: ['포드'], scope: PARSE_SCOPE_IMPORTED, signals: ['ford', '포드'] },
  { key: 'cadillac', label: 'Cadillac', button: '🇺🇸 Cadillac', manufacturerTokens: ['캐딜락'], scope: PARSE_SCOPE_IMPORTED, signals: ['cadillac', '캐딜락'] },
  { key: 'lincoln', label: 'Lincoln', button: '🇺🇸 Lincoln', manufacturerTokens: ['링컨'], scope: PARSE_SCOPE_IMPORTED, signals: ['lincoln', '링컨'] },
  { key: 'tesla', label: 'Tesla', button: '⚡ Tesla', manufacturerTokens: ['테슬라'], scope: PARSE_SCOPE_IMPORTED, signals: ['tesla', '테슬라'] },
  { key: 'volvo', label: 'Volvo', button: '🇸🇪 Volvo', manufacturerTokens: ['볼보'], scope: PARSE_SCOPE_IMPORTED, signals: ['volvo', '볼보'] },
  { key: 'land-rover', label: 'Land Rover', button: '🇬🇧 Rover', manufacturerTokens: ['랜드로버'], scope: PARSE_SCOPE_IMPORTED, signals: ['landrover', 'land rover', '랜드로버'] },
  { key: 'jaguar', label: 'Jaguar', button: '🇬🇧 Jaguar', manufacturerTokens: ['재규어'], scope: PARSE_SCOPE_IMPORTED, signals: ['jaguar', '재규어'] },
  { key: 'bentley', label: 'Bentley', button: '🇬🇧 Bentley', manufacturerTokens: ['벤틀리'], scope: PARSE_SCOPE_IMPORTED, signals: ['bentley', '벤틀리'] },
  { key: 'peugeot', label: 'Peugeot', button: '🇫🇷 Peugeot', manufacturerTokens: ['푸조'], scope: PARSE_SCOPE_IMPORTED, signals: ['peugeot', '푸조'] },
  { key: 'mitsubishi', label: 'Mitsubishi', button: '🇯🇵 Mitsubishi', manufacturerTokens: ['미쓰비시'], scope: PARSE_SCOPE_IMPORTED, signals: ['mitsubishi', '미쓰비시'] },
  { key: 'jeep', label: 'Jeep', button: '🇺🇸 Jeep', manufacturerTokens: ['지프'], scope: PARSE_SCOPE_IMPORTED, signals: ['jeep', '지프'] },
])

const BRAND_PRESET_MAP = new Map(BRAND_PRESETS.map((preset) => [preset.key, preset]))

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanMultilineText(value) {
  return String(value || '').trim()
}

function escapeQueryToken(value) {
  return cleanText(value).replace(/\./g, '')
}

function normalizeSignal(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9\uac00-\ud7a3]+/g, '')
}

function normalizeStoredUrl(value) {
  return String(value || '').trim()
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

function buildRangeMarker(year = DEFAULT_BRAND_YEAR, month = DEFAULT_BRAND_MONTH) {
  const normalizedYear = normalizeBrandYear(year, 0)
  if (!normalizedYear) return ''

  const normalizedMonth = normalizeBrandMonth(month, 0)
  return `${normalizedYear}${String(normalizedMonth || 0).padStart(2, '0')}`
}

function buildMinimumRangeClause(year = DEFAULT_BRAND_YEAR, month = DEFAULT_BRAND_MONTH) {
  const rangeStart = buildRangeMarker(year, month)
  return rangeStart ? `Year.range(${rangeStart}..).` : ''
}

function buildExactSelectionRangeClause(year = DEFAULT_BRAND_YEAR, month = DEFAULT_BRAND_MONTH) {
  const normalizedYear = normalizeBrandYear(year, 0)
  if (!normalizedYear) return ''

  const normalizedMonth = normalizeBrandMonth(month, 0)
  if (normalizedMonth) {
    const marker = `${normalizedYear}${String(normalizedMonth).padStart(2, '0')}`
    return `Year.range(${marker}..${marker}).`
  }

  return `Year.range(${normalizedYear}01..${normalizedYear}12).`
}

function buildScopedQuery(scopePrefix, manufacturerTokens = [], rangeClause = '') {
  const manufacturerOr = buildManufacturerOrQuery(manufacturerTokens)
  const clauses = []

  if (rangeClause) {
    clauses.push(rangeClause)
  }

  if (manufacturerOr) {
    clauses.push(manufacturerOr)
  }

  if (!clauses.length) {
    const normalizedPrefix = scopePrefix.endsWith('._')
      ? `${scopePrefix.slice(0, -2)}.`
      : scopePrefix
    return `${normalizedPrefix})`
  }
  return `${scopePrefix}.${clauses.join('_.')})`
}

function buildScopeListQuery(parseScope = PARSE_SCOPE_ALL) {
  const normalizedScope = normalizeParseScope(parseScope)
  if (normalizedScope === PARSE_SCOPE_DOMESTIC) return '(And.Hidden.N._.CarType.Y._.Year.range(201900..).)'
  if (normalizedScope === PARSE_SCOPE_IMPORTED) return '(And.Hidden.N._.CarType.N._.Year.range(201900..).)'
  if (normalizedScope === PARSE_SCOPE_JAPANESE) return buildScopedQuery('(And.Hidden.N._.CarType.N._', JAPANESE_MANUFACTURER_TOKENS, buildMinimumRangeClause(2019, 1))
  if (normalizedScope === PARSE_SCOPE_GERMAN) return buildScopedQuery('(And.Hidden.N._.CarType.N._', GERMAN_MANUFACTURER_TOKENS, buildMinimumRangeClause(2019, 1))
  return '(And.Hidden.N._.Year.range(201900..).)'
}

function buildBrandListQuery(brandKey = '', year = DEFAULT_BRAND_YEAR, month = DEFAULT_BRAND_MONTH) {
  const preset = getBrandPreset(brandKey)
  if (!preset) return buildScopeListQuery(PARSE_SCOPE_ALL)
  const rangeClause = buildExactSelectionRangeClause(year, month)
  const manufacturerTokens = Array.isArray(preset.manufacturerTokens) ? preset.manufacturerTokens : []

  if (preset.scope === PARSE_SCOPE_DOMESTIC) {
    return buildScopedQuery('(And.Hidden.N._.CarType.Y._', manufacturerTokens, rangeClause)
  }

  if (preset.scope === PARSE_SCOPE_IMPORTED) {
    return buildScopedQuery('(And.Hidden.N._.CarType.N._', manufacturerTokens, rangeClause)
  }

  return buildScopedQuery('(And.Hidden.N._', manufacturerTokens, rangeClause)
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

function decodeQueryValue(value) {
  let result = cleanText(value)
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(result)
      if (!decoded || decoded === result) break
      result = cleanText(decoded)
    } catch {
      break
    }
  }
  return result
}

function normalizeQueryText(value) {
  const query = decodeQueryValue(value)
  if (!query) return ''
  if (query.startsWith('q=')) return normalizeQueryText(query.slice(2))
  return query
}

function extractStructuredQueryCandidate(value) {
  const normalizedValue = normalizeQueryText(value)
  if (!normalizedValue) return ''

  if (normalizedValue.startsWith('(') && normalizedValue.endsWith(')')) {
    return normalizedValue
  }

  if (!(normalizedValue.startsWith('{') && normalizedValue.endsWith('}'))) {
    return ''
  }

  try {
    const parsed = JSON.parse(normalizedValue)
    const nestedCandidates = [
      parsed?.action,
      parsed?.q,
      parsed?.query,
      parsed?.search,
      parsed?.payload?.action,
      parsed?.payload?.q,
      parsed?.payload?.query,
    ]

    for (const nestedCandidate of nestedCandidates) {
      const nestedQuery = normalizeQueryText(nestedCandidate)
      if (nestedQuery.startsWith('(') && nestedQuery.endsWith(')')) {
        return nestedQuery
      }
    }
  } catch {
    return ''
  }

  return ''
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

  const queryCandidates = [
    url.searchParams.get('q'),
    url.searchParams.get('query'),
    url.searchParams.get('search'),
  ]

  if (url.hash) {
    const hash = url.hash.slice(1)
    queryCandidates.push(hash)
    if (hash.includes('?')) {
      const hashParams = new URLSearchParams(hash.slice(hash.indexOf('?') + 1))
      queryCandidates.push(hashParams.get('q'))
      queryCandidates.push(hashParams.get('query'))
    }
    if (hash.includes('q=')) {
      const matched = hash.match(/(?:^|[?&#])q=([^&#]+)/i)
      if (matched?.[1]) queryCandidates.push(matched[1])
    }
  }

  for (const candidateQuery of queryCandidates) {
    const normalizedQuery = extractStructuredQueryCandidate(candidateQuery)
    if (normalizedQuery.startsWith('(') && normalizedQuery.endsWith(')')) {
      return {
        id: `custom_${hashText(normalizedQuery)}`,
        url: url.toString(),
        query: normalizedQuery,
      }
    }
  }

  return null
}

function extractRawQueryCandidates(value) {
  const raw = cleanMultilineText(value)
  if (!raw) return []

  const candidates = []
  const rawStructuredQuery = extractStructuredQueryCandidate(raw)
  if (rawStructuredQuery) {
    candidates.push(rawStructuredQuery)
  }

  const queryMatch = raw.match(/(?:^|[?&#\s])q=([^&#\s]+)/i)
  if (queryMatch?.[1]) {
    const normalizedQuery = extractStructuredQueryCandidate(queryMatch[1])
    if (normalizedQuery) {
      candidates.push(normalizedQuery)
    }
  }

  const searchMatch = raw.match(/(?:^|[?&#\s])search=([^&#\s]+)/i)
  if (searchMatch?.[1]) {
    const normalizedQuery = extractStructuredQueryCandidate(searchMatch[1])
    if (normalizedQuery) {
      candidates.push(normalizedQuery)
    }
  }

  return candidates.filter((item) => item.startsWith('(') && item.endsWith(')'))
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

export function normalizeBrandYear(value, fallback = DEFAULT_BRAND_YEAR) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < BRAND_FILTER_MIN_YEAR || parsed > BRAND_FILTER_MAX_YEAR) return fallback
  return parsed
}

export function normalizeBrandMonth(value, fallback = DEFAULT_BRAND_MONTH) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < 1 || parsed > 12) return fallback
  return parsed
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

export function getBrandSelectionKey(selection = {}) {
  const brandKey = normalizeBrandKey(selection?.brandKey)
  const year = normalizeBrandYear(selection?.year, 0)
  const month = year ? normalizeBrandMonth(selection?.month, 0) : 0
  return brandKey ? `${brandKey}:${year || 'all'}:${month || 'all'}` : ''
}

export function normalizeBrandSelections(value, legacyBrandKey = '') {
  const rawSelections = Array.isArray(value) ? value : []
  const selections = []
  const seenKeys = new Set()

  for (const selection of rawSelections) {
    const brandKey = normalizeBrandKey(selection?.brandKey)
    if (!brandKey) continue

    const normalized = {
      brandKey,
      year: normalizeBrandYear(selection?.year, 0),
      month: normalizeBrandYear(selection?.year, 0)
        ? normalizeBrandMonth(selection?.month, 0)
        : 0,
    }

    const uniqueKey = getBrandSelectionKey(normalized)
    if (!uniqueKey || seenKeys.has(uniqueKey)) continue
    seenKeys.add(uniqueKey)
    selections.push(normalized)
  }

  const legacyKey = normalizeBrandKey(legacyBrandKey)
  if (!selections.length && legacyKey) {
    selections.push({
      brandKey: legacyKey,
      year: 0,
      month: 0,
    })
  }

  return selections
}

export function normalizeCustomFilters(value, legacyCustomFilterUrl = '', legacyCustomFilterQuery = '') {
  const rawFilters = Array.isArray(value) ? value : []
  const filters = []
  const seenQueries = new Set()

  for (const filter of rawFilters) {
    const query = normalizeQueryText(filter?.query)
    if (!query || !query.startsWith('(') || !query.endsWith(')')) continue
    if (seenQueries.has(query)) continue
    seenQueries.add(query)

    filters.push({
      id: cleanText(filter?.id) || `custom_${hashText(query)}`,
      url: normalizeStoredUrl(filter?.url),
      query,
    })
  }

  const legacyQuery = normalizeQueryText(legacyCustomFilterQuery)
  if (!filters.length && legacyQuery.startsWith('(') && legacyQuery.endsWith(')')) {
    filters.push({
      id: `custom_${hashText(legacyQuery)}`,
      url: normalizeStoredUrl(legacyCustomFilterUrl),
      query: legacyQuery,
    })
  }

  return filters
}

export function getBrandSelectionLabel(selection = {}) {
  const preset = getBrandPreset(selection?.brandKey)
  const year = normalizeBrandYear(selection?.year, 0)
  const month = year ? normalizeBrandMonth(selection?.month, 0) : 0
  const baseLabel = preset?.label || selection?.brandKey || 'Марка'

  if (!year) return baseLabel
  if (!month) return `${baseLabel} с ${year}`
  return `${baseLabel} с ${month.toString().padStart(2, '0')}.${year}`
}

export function getCustomFilterLabel(filter = {}, index = 0) {
  const prefix = index > 0 ? `${index}. ` : ''
  if (cleanText(filter?.url)) return `${prefix}${cleanText(filter.url)}`
  return `${prefix}${cleanText(filter?.query).slice(0, 80)}`
}

export function getFilterSummary(session = {}) {
  const filterMode = normalizeFilterMode(session?.filterMode)
  const brandSelections = normalizeBrandSelections(session?.brandSelections, session?.brandKey)
  const customFilters = normalizeCustomFilters(session?.customFilters, session?.customFilterUrl, session?.customFilterQuery)

  if (filterMode === FILTER_MODE_BRAND) {
    return brandSelections.length ? `Марки: ${brandSelections.length}` : 'Все машины'
  }

  if (filterMode === FILTER_MODE_CUSTOM) {
    return customFilters.length ? `Свои ссылки: ${customFilters.length}` : 'Все машины'
  }

  return 'Все машины'
}

export function getSessionFilterEntries(session = {}) {
  const filterMode = normalizeFilterMode(session?.filterMode)
  const brandSelections = normalizeBrandSelections(session?.brandSelections, session?.brandKey)
  const customFilters = normalizeCustomFilters(session?.customFilters, session?.customFilterUrl, session?.customFilterQuery)

  if (filterMode === FILTER_MODE_BRAND && brandSelections.length) {
    return brandSelections.map((selection) => ({
      filterMode: FILTER_MODE_BRAND,
      filterKey: `brand:${getBrandSelectionKey(selection)}`,
      query: buildBrandListQuery(selection.brandKey, selection.year, selection.month),
      brandKey: selection.brandKey,
      year: selection.year,
      month: selection.month,
      label: getBrandSelectionLabel(selection),
    }))
  }

  if (filterMode === FILTER_MODE_CUSTOM && customFilters.length) {
    return customFilters.map((filter) => ({
      filterMode: FILTER_MODE_CUSTOM,
      filterKey: `custom:${hashText(filter.query)}`,
      query: filter.query,
      customFilterId: filter.id,
      url: filter.url,
      label: filter.url || filter.query,
    }))
  }

  return [{
    filterMode: FILTER_MODE_SCOPE,
    filterKey: `scope:${PARSE_SCOPE_ALL}`,
    query: buildScopeListQuery(PARSE_SCOPE_ALL),
    parseScope: PARSE_SCOPE_ALL,
    label: 'Все машины',
  }]
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

  return haystack.some((value) => preset.signals.some((signal) => {
    const normalizedSignal = normalizeSignal(signal)
    return value.includes(normalizedSignal) || normalizedSignal.includes(value)
  }))
}

export function parseCustomFilterInputs(value) {
  const raw = cleanMultilineText(value)
  if (!raw) return []

  const entries = []
  const seenQueries = new Set()
  const urlCandidates = raw.match(/(?:https?:\/\/|www\.)\S+/gi) || []

  for (const urlCandidate of urlCandidates) {
    const parsed = extractCustomQueryFromUrl(urlCandidate)
    if (!parsed?.query || seenQueries.has(parsed.query)) continue
    seenQueries.add(parsed.query)
    entries.push(parsed)
  }

  for (const rawCandidate of extractRawQueryCandidates(raw)) {
    if (seenQueries.has(rawCandidate)) continue
    seenQueries.add(rawCandidate)
    entries.push({
      id: `custom_${hashText(rawCandidate)}`,
      url: '',
      query: rawCandidate,
    })
  }

  return entries
}

export function parseCustomFilterInput(value) {
  return parseCustomFilterInputs(value)[0] || null
}
