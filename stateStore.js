import fs from 'fs/promises'
import path from 'path'
import {
  FILTER_MODE_SCOPE,
  normalizeBrandKey,
  normalizeBrandMonth,
  normalizeBrandSelections,
  normalizeBrandYear,
  normalizeCustomFilters,
  normalizeFilterMode,
  normalizeParseScope,
} from './encarFilters.js'

const DEFAULT_STATE = Object.freeze({
  lastUpdateId: 0,
  sessions: {},
  seenListings: {},
  seenVins: {},
  filterStats: {},
  deliveredListings: {},
  globalStats: {
    totalDelivered: 0,
    totalScans: 0,
    totalPages: 0,
    totalListingsChecked: 0,
    startedAt: '',
  },
})

const SEEN_LISTING_TTL_MS = 14 * 24 * 60 * 60 * 1000
const MAX_SEEN_LISTINGS = 8000
const SEEN_VIN_TTL_MS = 14 * 24 * 60 * 60 * 1000
const MAX_SEEN_VINS = 6000
const MAX_FILTER_STATS = 200
const MAX_DELIVERED_PER_USER = 50

function cloneDefaultState() {
  return {
    lastUpdateId: DEFAULT_STATE.lastUpdateId,
    sessions: {},
    seenListings: {},
    seenVins: {},
    filterStats: {},
    deliveredListings: {},
    globalStats: {
      totalDelivered: 0,
      totalScans: 0,
      totalPages: 0,
      totalListingsChecked: 0,
      startedAt: '',
    },
  }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeChatId(value) {
  const raw = cleanText(value)
  if (!raw) return ''

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? String(parsed) : ''
}

function cloneSession(session) {
  return {
    ...session,
    brandSelections: Array.isArray(session?.brandSelections)
      ? session.brandSelections.map((selection) => ({ ...selection }))
      : [],
    customFilters: Array.isArray(session?.customFilters)
      ? session.customFilters.map((filter) => ({ ...filter }))
      : [],
  }
}

function buildDefaultSession(chatId) {
  return {
    chatId: normalizeChatId(chatId),
    parseScope: normalizeParseScope('all'),
    filterMode: FILTER_MODE_SCOPE,
    currentSection: 'main',
    lastControlMessageId: 0,
    lastMainMessageId: 0,
    lastFiltersMessageId: 0,
    brandKey: '',
    brandSelections: [],
    customFilterUrl: '',
    customFilterQuery: '',
    customFilters: [],
    awaitingCustomFilter: false,
    pendingBrandKey: '',
    pendingBrandYear: 0,
    awaitingBrandYear: false,
    awaitingBrandMonth: false,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function normalizeState(rawState) {
  const state = cloneDefaultState()
  if (!rawState || typeof rawState !== 'object') return state

  state.lastUpdateId = Math.max(0, Number(rawState.lastUpdateId) || 0)

  if (rawState.sessions && typeof rawState.sessions === 'object' && !Array.isArray(rawState.sessions)) {
    for (const [chatId, session] of Object.entries(rawState.sessions)) {
      const normalizedChatId = normalizeChatId(chatId)
      if (!normalizedChatId) continue

      const defaultSession = buildDefaultSession(normalizedChatId)
      state.sessions[normalizedChatId] = {
        ...defaultSession,
        ...session,
        chatId: normalizedChatId,
        parseScope: normalizeParseScope(session?.parseScope),
        filterMode: normalizeFilterMode(session?.filterMode),
        currentSection: cleanText(session?.currentSection) || 'main',
        lastControlMessageId: Math.max(0, Number(session?.lastControlMessageId) || 0),
        lastMainMessageId: Math.max(0, Number(session?.lastMainMessageId) || 0),
        lastFiltersMessageId: Math.max(0, Number(session?.lastFiltersMessageId) || 0),
        brandKey: normalizeBrandKey(session?.brandKey),
        brandSelections: normalizeBrandSelections(session?.brandSelections, session?.brandKey),
        customFilterUrl: cleanText(session?.customFilterUrl),
        customFilterQuery: cleanText(session?.customFilterQuery),
        customFilters: normalizeCustomFilters(session?.customFilters, session?.customFilterUrl, session?.customFilterQuery),
        awaitingCustomFilter: Boolean(session?.awaitingCustomFilter),
        pendingBrandKey: normalizeBrandKey(session?.pendingBrandKey),
        pendingBrandYear: normalizeBrandYear(session?.pendingBrandYear, 0),
        awaitingBrandYear: Boolean(session?.awaitingBrandYear),
        awaitingBrandMonth: Boolean(session?.awaitingBrandMonth),
        isActive: Boolean(session?.isActive),
        username: cleanText(session?.username),
        firstName: cleanText(session?.firstName),
        lastName: cleanText(session?.lastName),
        updatedAt: cleanText(session?.updatedAt) || new Date().toISOString(),
      }
    }
  }

  if (rawState.seenListings && typeof rawState.seenListings === 'object' && !Array.isArray(rawState.seenListings)) {
    for (const [encarId, listing] of Object.entries(rawState.seenListings)) {
      const normalizedEncarId = cleanText(encarId)
      if (!normalizedEncarId) continue

      state.seenListings[normalizedEncarId] = {
        encarId: normalizedEncarId,
        updatedAt: cleanText(listing?.updatedAt) || new Date().toISOString(),
        firstSeenAt: cleanText(listing?.firstSeenAt) || cleanText(listing?.updatedAt) || new Date().toISOString(),
        notifiedAt: cleanText(listing?.notifiedAt),
        priceKrw: Math.max(0, Number(listing?.priceKrw) || 0),
        viewCount: Math.max(0, Number(listing?.viewCount) || 0),
        callCount: Math.max(0, Number(listing?.callCount) || 0),
        subscribeCount: Math.max(0, Number(listing?.subscribeCount) || 0),
        qualifiesFresh: Boolean(listing?.qualifiesFresh),
      }
    }
  }

  if (rawState.seenVins && typeof rawState.seenVins === 'object' && !Array.isArray(rawState.seenVins)) {
    for (const [vin, entry] of Object.entries(rawState.seenVins)) {
      const normalizedVin = cleanText(vin).toUpperCase()
      if (!normalizedVin) continue
      state.seenVins[normalizedVin] = {
        vin: normalizedVin,
        encarId: cleanText(entry?.encarId),
        notifiedAt: cleanText(entry?.notifiedAt) || new Date().toISOString(),
      }
    }
  }

  if (rawState.deliveredListings && typeof rawState.deliveredListings === 'object' && !Array.isArray(rawState.deliveredListings)) {
    for (const [chatId, list] of Object.entries(rawState.deliveredListings)) {
      const normalizedChatId = normalizeChatId(chatId)
      if (!normalizedChatId || !Array.isArray(list)) continue
      state.deliveredListings[normalizedChatId] = list
        .filter((it) => it && typeof it === 'object')
        .map((it) => ({
          encarId: cleanText(it?.encarId),
          title: cleanText(it?.title),
          priceKrw: Math.max(0, Number(it?.priceKrw) || 0),
          year: Math.max(0, Number(it?.year) || 0),
          mileage: Math.max(0, Number(it?.mileage) || 0),
          filterLabel: cleanText(it?.filterLabel),
          filterKey: cleanText(it?.filterKey),
          deliveredAt: cleanText(it?.deliveredAt) || new Date().toISOString(),
          link: cleanText(it?.link),
        }))
        .slice(-MAX_DELIVERED_PER_USER)
    }
  }

  if (rawState.globalStats && typeof rawState.globalStats === 'object' && !Array.isArray(rawState.globalStats)) {
    state.globalStats = {
      totalDelivered: Math.max(0, Number(rawState.globalStats?.totalDelivered) || 0),
      totalScans: Math.max(0, Number(rawState.globalStats?.totalScans) || 0),
      totalPages: Math.max(0, Number(rawState.globalStats?.totalPages) || 0),
      totalListingsChecked: Math.max(0, Number(rawState.globalStats?.totalListingsChecked) || 0),
      startedAt: cleanText(rawState.globalStats?.startedAt),
    }
  }

  if (rawState.filterStats && typeof rawState.filterStats === 'object' && !Array.isArray(rawState.filterStats)) {
    for (const [filterKey, stats] of Object.entries(rawState.filterStats)) {
      const key = cleanText(filterKey)
      if (!key) continue
      state.filterStats[key] = {
        filterKey: key,
        label: cleanText(stats?.label),
        scans: Math.max(0, Number(stats?.scans) || 0),
        pagesProcessed: Math.max(0, Number(stats?.pagesProcessed) || 0),
        listingsChecked: Math.max(0, Number(stats?.listingsChecked) || 0),
        filtered: Math.max(0, Number(stats?.filtered) || 0),
        freshHits: Math.max(0, Number(stats?.freshHits) || 0),
        vinDupes: Math.max(0, Number(stats?.vinDupes) || 0),
        networkErrors: Math.max(0, Number(stats?.networkErrors) || 0),
        lastScanAt: cleanText(stats?.lastScanAt),
        lastFreshAt: cleanText(stats?.lastFreshAt),
      }
    }
  }

  return state
}

export class LocalStateStore {
  constructor(filePath) {
    this.filePath = filePath
    this.state = cloneDefaultState()
    this.loaded = false
    this.flushPromise = Promise.resolve()
  }

  async load() {
    if (this.loaded) return this.state

    let shouldCreateStateFile = false
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      this.state = normalizeState(JSON.parse(raw))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      this.state = cloneDefaultState()
      shouldCreateStateFile = true
    }

    this.loaded = true
    this.pruneSeenListings()
    if (shouldCreateStateFile) {
      await this.flush()
    }
    return this.state
  }

  async flush() {
    await this.load()
    const payload = JSON.stringify(this.state, null, 2)
    const directory = path.dirname(this.filePath)

    this.flushPromise = this.flushPromise
      .catch(() => null)
      .then(async () => {
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(this.filePath, payload, 'utf8')
      })

    return this.flushPromise
  }

  getLastUpdateId() {
    return Math.max(0, Number(this.state.lastUpdateId) || 0)
  }

  setLastUpdateId(updateId) {
    this.state.lastUpdateId = Math.max(0, Number(updateId) || 0)
  }

  getSession(chatId) {
    const normalizedChatId = normalizeChatId(chatId)
    if (!normalizedChatId) return null

    if (!this.state.sessions[normalizedChatId]) {
      this.state.sessions[normalizedChatId] = buildDefaultSession(normalizedChatId)
    }

    return cloneSession(this.state.sessions[normalizedChatId])
  }

  upsertSession(chatId, patch = {}) {
    const normalizedChatId = normalizeChatId(chatId)
    if (!normalizedChatId) return null

    const current = this.state.sessions[normalizedChatId] || buildDefaultSession(normalizedChatId)
    const next = {
      ...current,
      ...patch,
      chatId: normalizedChatId,
      parseScope: normalizeParseScope(patch.parseScope ?? current.parseScope),
      filterMode: normalizeFilterMode(patch.filterMode ?? current.filterMode),
      currentSection: cleanText(patch.currentSection ?? current.currentSection) || 'main',
      lastControlMessageId: Math.max(0, Number(patch.lastControlMessageId ?? current.lastControlMessageId) || 0),
      lastMainMessageId: Math.max(0, Number(patch.lastMainMessageId ?? current.lastMainMessageId) || 0),
      lastFiltersMessageId: Math.max(0, Number(patch.lastFiltersMessageId ?? current.lastFiltersMessageId) || 0),
      brandKey: normalizeBrandKey(patch.brandKey ?? current.brandKey),
      brandSelections: normalizeBrandSelections(
        patch.brandSelections ?? current.brandSelections,
        patch.brandKey ?? current.brandKey,
      ),
      customFilterUrl: cleanText(patch.customFilterUrl ?? current.customFilterUrl),
      customFilterQuery: cleanText(patch.customFilterQuery ?? current.customFilterQuery),
      customFilters: normalizeCustomFilters(
        patch.customFilters ?? current.customFilters,
        patch.customFilterUrl ?? current.customFilterUrl,
        patch.customFilterQuery ?? current.customFilterQuery,
      ),
      awaitingCustomFilter: typeof patch.awaitingCustomFilter === 'boolean'
        ? patch.awaitingCustomFilter
        : Boolean(current.awaitingCustomFilter),
      pendingBrandKey: normalizeBrandKey(patch.pendingBrandKey ?? current.pendingBrandKey),
      pendingBrandYear: normalizeBrandYear(
        patch.pendingBrandYear ?? current.pendingBrandYear,
        current.pendingBrandYear ? normalizeBrandYear(current.pendingBrandYear, 0) : 0,
      ),
      awaitingBrandYear: typeof patch.awaitingBrandYear === 'boolean'
        ? patch.awaitingBrandYear
        : Boolean(current.awaitingBrandYear),
      awaitingBrandMonth: typeof patch.awaitingBrandMonth === 'boolean'
        ? patch.awaitingBrandMonth
        : Boolean(current.awaitingBrandMonth),
      isActive: typeof patch.isActive === 'boolean' ? patch.isActive : Boolean(current.isActive),
      username: cleanText(patch.username ?? current.username),
      firstName: cleanText(patch.firstName ?? current.firstName),
      lastName: cleanText(patch.lastName ?? current.lastName),
      updatedAt: new Date().toISOString(),
    }

    this.state.sessions[normalizedChatId] = next
    return cloneSession(next)
  }

  deactivateSession(chatId) {
    return this.upsertSession(chatId, { isActive: false })
  }

  getActiveSessions() {
    return Object.values(this.state.sessions)
      .filter((session) => session?.isActive)
      .map((session) => cloneSession(session))
  }

  getSeenListing(encarId) {
    const normalizedEncarId = cleanText(encarId)
    if (!normalizedEncarId) return null
    const listing = this.state.seenListings[normalizedEncarId]
    return listing ? { ...listing } : null
  }

  rememberListing(encarId, payload = {}) {
    const normalizedEncarId = cleanText(encarId)
    if (!normalizedEncarId) return null

    const nowIso = new Date().toISOString()
    const current = this.state.seenListings[normalizedEncarId] || {
      encarId: normalizedEncarId,
      firstSeenAt: nowIso,
    }

    const next = {
      ...current,
      ...payload,
      encarId: normalizedEncarId,
      priceKrw: Math.max(0, Number(payload?.priceKrw ?? current.priceKrw) || 0),
      viewCount: Math.max(0, Number(payload?.viewCount ?? current.viewCount) || 0),
      callCount: Math.max(0, Number(payload?.callCount ?? current.callCount) || 0),
      subscribeCount: Math.max(0, Number(payload?.subscribeCount ?? current.subscribeCount) || 0),
      qualifiesFresh: Boolean(payload?.qualifiesFresh ?? current.qualifiesFresh),
      notifiedAt: cleanText(payload?.notifiedAt ?? current.notifiedAt),
      updatedAt: nowIso,
    }

    this.state.seenListings[normalizedEncarId] = next
    this.pruneSeenListings()
    return { ...next }
  }

  pruneSeenListings() {
    const now = Date.now()
    const seenEntries = Object.entries(this.state.seenListings)
    const filteredEntries = seenEntries.filter(([, listing]) => {
      const updatedAtMs = new Date(listing?.updatedAt || 0).getTime()
      return Number.isFinite(updatedAtMs) && now - updatedAtMs <= SEEN_LISTING_TTL_MS
    })

    filteredEntries.sort((left, right) => {
      const rightMs = new Date(right[1]?.updatedAt || 0).getTime()
      const leftMs = new Date(left[1]?.updatedAt || 0).getTime()
      return rightMs - leftMs
    })

    this.state.seenListings = Object.fromEntries(filteredEntries.slice(0, MAX_SEEN_LISTINGS))
  }

  getSeenVin(vin) {
    const key = cleanText(vin).toUpperCase()
    if (!key) return null
    const entry = this.state.seenVins[key]
    return entry ? { ...entry } : null
  }

  rememberVin(vin, encarId) {
    const key = cleanText(vin).toUpperCase()
    if (!key) return null
    const entry = {
      vin: key,
      encarId: cleanText(encarId),
      notifiedAt: new Date().toISOString(),
    }
    this.state.seenVins[key] = entry
    this.pruneSeenVins()
    return { ...entry }
  }

  pruneSeenVins() {
    const now = Date.now()
    const entries = Object.entries(this.state.seenVins).filter(([, entry]) => {
      const notifiedAtMs = new Date(entry?.notifiedAt || 0).getTime()
      return Number.isFinite(notifiedAtMs) && now - notifiedAtMs <= SEEN_VIN_TTL_MS
    })

    entries.sort((left, right) => {
      const rightMs = new Date(right[1]?.notifiedAt || 0).getTime()
      const leftMs = new Date(left[1]?.notifiedAt || 0).getTime()
      return rightMs - leftMs
    })

    this.state.seenVins = Object.fromEntries(entries.slice(0, MAX_SEEN_VINS))
  }

  getFilterStats(filterKey) {
    const key = cleanText(filterKey)
    if (!key) return null
    const stats = this.state.filterStats[key]
    return stats ? { ...stats } : null
  }

  getAllFilterStats() {
    return Object.values(this.state.filterStats).map((stats) => ({ ...stats }))
  }

  updateFilterStats(filterKey, patch = {}) {
    const key = cleanText(filterKey)
    if (!key) return null

    const nowIso = new Date().toISOString()
    const current = this.state.filterStats[key] || {
      filterKey: key,
      label: '',
      scans: 0,
      pagesProcessed: 0,
      listingsChecked: 0,
      filtered: 0,
      freshHits: 0,
      vinDupes: 0,
      networkErrors: 0,
      lastScanAt: '',
      lastFreshAt: '',
    }

    const next = {
      ...current,
      ...patch,
      filterKey: key,
      label: cleanText(patch?.label ?? current.label),
      scans: Math.max(0, Number(patch?.scans ?? current.scans) || 0),
      pagesProcessed: Math.max(0, Number(patch?.pagesProcessed ?? current.pagesProcessed) || 0),
      listingsChecked: Math.max(0, Number(patch?.listingsChecked ?? current.listingsChecked) || 0),
      filtered: Math.max(0, Number(patch?.filtered ?? current.filtered) || 0),
      freshHits: Math.max(0, Number(patch?.freshHits ?? current.freshHits) || 0),
      vinDupes: Math.max(0, Number(patch?.vinDupes ?? current.vinDupes) || 0),
      networkErrors: Math.max(0, Number(patch?.networkErrors ?? current.networkErrors) || 0),
      lastScanAt: cleanText(patch?.lastScanAt ?? current.lastScanAt) || nowIso,
      lastFreshAt: cleanText(patch?.lastFreshAt ?? current.lastFreshAt),
    }

    this.state.filterStats[key] = next
    this.pruneFilterStats()
    return { ...next }
  }

  incrementFilterStats(filterKey, label, increments = {}) {
    const key = cleanText(filterKey)
    if (!key) return null

    const current = this.state.filterStats[key] || {
      filterKey: key,
      label: '',
      scans: 0,
      pagesProcessed: 0,
      listingsChecked: 0,
      filtered: 0,
      freshHits: 0,
      vinDupes: 0,
      networkErrors: 0,
      lastScanAt: '',
      lastFreshAt: '',
    }

    const patch = {
      label: label || current.label,
      scans: current.scans + (Number(increments?.scans) || 0),
      pagesProcessed: current.pagesProcessed + (Number(increments?.pagesProcessed) || 0),
      listingsChecked: current.listingsChecked + (Number(increments?.listingsChecked) || 0),
      filtered: current.filtered + (Number(increments?.filtered) || 0),
      freshHits: current.freshHits + (Number(increments?.freshHits) || 0),
      vinDupes: current.vinDupes + (Number(increments?.vinDupes) || 0),
      networkErrors: current.networkErrors + (Number(increments?.networkErrors) || 0),
      lastScanAt: increments?.lastScanAt || new Date().toISOString(),
      lastFreshAt: increments?.lastFreshAt || current.lastFreshAt,
    }

    return this.updateFilterStats(key, patch)
  }

  pruneFilterStats() {
    const entries = Object.entries(this.state.filterStats)
    if (entries.length <= MAX_FILTER_STATS) return

    entries.sort((left, right) => {
      const rightMs = new Date(right[1]?.lastScanAt || 0).getTime()
      const leftMs = new Date(left[1]?.lastScanAt || 0).getTime()
      return rightMs - leftMs
    })

    this.state.filterStats = Object.fromEntries(entries.slice(0, MAX_FILTER_STATS))
  }

  getAllSessions() {
    return Object.values(this.state.sessions).map((session) => cloneSession(session))
  }

  recordDelivered(chatId, payload = {}) {
    const normalizedChatId = normalizeChatId(chatId)
    if (!normalizedChatId) return null

    const nowIso = new Date().toISOString()
    const entry = {
      encarId: cleanText(payload?.encarId),
      title: cleanText(payload?.title),
      priceKrw: Math.max(0, Number(payload?.priceKrw) || 0),
      year: Math.max(0, Number(payload?.year) || 0),
      mileage: Math.max(0, Number(payload?.mileage) || 0),
      filterLabel: cleanText(payload?.filterLabel),
      filterKey: cleanText(payload?.filterKey),
      deliveredAt: nowIso,
      link: cleanText(payload?.link),
    }

    const list = Array.isArray(this.state.deliveredListings[normalizedChatId])
      ? this.state.deliveredListings[normalizedChatId]
      : []
    list.push(entry)
    if (list.length > MAX_DELIVERED_PER_USER) {
      list.splice(0, list.length - MAX_DELIVERED_PER_USER)
    }
    this.state.deliveredListings[normalizedChatId] = list

    this.state.globalStats = {
      ...this.state.globalStats,
      totalDelivered: (Number(this.state.globalStats?.totalDelivered) || 0) + 1,
    }
    return entry
  }

  getDeliveredForChat(chatId) {
    const normalizedChatId = normalizeChatId(chatId)
    if (!normalizedChatId) return []
    const list = this.state.deliveredListings[normalizedChatId]
    return Array.isArray(list) ? list.slice().reverse() : []
  }

  getGlobalStats() {
    return { ...(this.state.globalStats || {}) }
  }

  incrementGlobalStats(increments = {}) {
    const current = this.state.globalStats || {}
    this.state.globalStats = {
      totalDelivered: Math.max(0, Number(current.totalDelivered) || 0) + (Number(increments.totalDelivered) || 0),
      totalScans: Math.max(0, Number(current.totalScans) || 0) + (Number(increments.totalScans) || 0),
      totalPages: Math.max(0, Number(current.totalPages) || 0) + (Number(increments.totalPages) || 0),
      totalListingsChecked: Math.max(0, Number(current.totalListingsChecked) || 0) + (Number(increments.totalListingsChecked) || 0),
      startedAt: cleanText(current.startedAt) || new Date().toISOString(),
    }
    return { ...this.state.globalStats }
  }

  getSeenListingsSummary() {
    const values = Object.values(this.state.seenListings || {})
    const notified = values.filter((it) => cleanText(it?.notifiedAt)).length
    return {
      total: values.length,
      notified,
      vinsTracked: Object.keys(this.state.seenVins || {}).length,
    }
  }
}
