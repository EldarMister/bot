import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  BRAND_PRESETS,
  FILTER_MODE_BRAND,
  FILTER_MODE_CUSTOM,
  FILTER_MODE_SCOPE,
  PARSE_SCOPE_ALL,
  PARSE_SCOPE_DOMESTIC,
  PARSE_SCOPE_GERMAN,
  PARSE_SCOPE_IMPORTED,
  PARSE_SCOPE_JAPANESE,
  getBrandPreset,
  getFilterSummary,
  getScopeLabel,
  normalizeBrandKey,
  normalizeFilterMode,
  normalizeParseScope,
  parseCustomFilterInput,
} from './encarFilters.js'
import { LocalStateStore } from './stateStore.js'
import { createStandaloneEncarClient } from './encarStandaloneClient.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TELEGRAM_API_BASE = 'https://api.telegram.org'
const TELEGRAM_TIMEOUT_MS = 20000
const TELEGRAM_ALLOWED_UPDATES = ['message', 'edited_message']
const DEFAULT_STATE_FILE = path.join(__dirname, 'data', 'state.json')
const DEFAULT_ACTIVE_DELAY_MS = 750
const DEFAULT_IDLE_DELAY_MS = 1500

const BUTTON_START = '\uD83D\uDE80 \u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u043f\u0430\u0440\u0441\u0438\u043d\u0433'
const BUTTON_STOP = '\u23F9\uFE0F \u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0430\u0440\u0441\u0438\u043D\u0433'
const BUTTON_STATUS = '\uD83D\uDCCA \u0421\u0442\u0430\u0442\u0443\u0441'
const BUTTON_FILTERS = '\uD83C\uDFAF \u0424\u0438\u043B\u044C\u0442\u0440\u044B'
const BUTTON_BRAND_FILTERS = '\uD83C\uDFF7\uFE0F \u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u043C\u0430\u0440\u043A\u0435'
const BUTTON_CUSTOM_FILTER = '\uD83D\uDD17 \u0421\u0432\u043E\u0439 \u0444\u0438\u043B\u044C\u0442\u0440'
const BUTTON_BACK = '\u2B05\uFE0F \u041D\u0430\u0437\u0430\u0434'

const FILTER_BUTTONS = Object.freeze({
  [PARSE_SCOPE_ALL]: '\uD83D\uDE97 \u0412\u0441\u0435 \u043c\u0430\u0448\u0438\u043d\u044b',
  [PARSE_SCOPE_DOMESTIC]: '\uD83C\uDDF0\uD83C\uDDF7 \u041A\u043E\u0440\u0435\u0439\u0441\u043A\u0438\u0435',
  [PARSE_SCOPE_IMPORTED]: '\uD83C\uDF0D \u0412\u0441\u0435 \u0438\u043C\u043F\u043E\u0440\u0442\u043D\u044B\u0435',
  [PARSE_SCOPE_JAPANESE]: '\uD83C\uDDEF\uD83C\uDDF5 \u042F\u043F\u043E\u043D\u0441\u043A\u0438\u0435',
  [PARSE_SCOPE_GERMAN]: '\uD83C\uDDE9\uD83C\uDDEA \u041D\u0435\u043C\u0435\u0446\u043A\u0438\u0435',
})

const KEYBOARD_SECTION_MAIN = 'main'
const KEYBOARD_SECTION_FILTERS = 'filters'
const KEYBOARD_SECTION_BRANDS = 'brands'
const KEYBOARD_SECTION_CUSTOM = 'custom'

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function readEnv() {
  return globalThis.process?.env || {}
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeChatId(value) {
  const raw = cleanText(value)
  if (!raw) return ''

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? String(parsed) : ''
}

function formatCurrentFilterLabel(session) {
  return getFilterSummary(session)
}

function getFilterButtonLabel(parseScope, activeScope = '') {
  const baseLabel = FILTER_BUTTONS[parseScope] || FILTER_BUTTONS[PARSE_SCOPE_ALL]
  return parseScope === normalizeParseScope(activeScope)
    ? `\u2705 ${baseLabel}`
    : baseLabel
}

function getBrandButtonLabel(brandKey, activeSession = null) {
  const preset = getBrandPreset(brandKey)
  const baseLabel = preset?.button || preset?.label || brandKey
  const isActive = normalizeFilterMode(activeSession?.filterMode) === FILTER_MODE_BRAND
    && normalizeBrandKey(activeSession?.brandKey) === normalizeBrandKey(brandKey)
  return isActive ? `\u2705 ${baseLabel}` : baseLabel
}

function getBrandFiltersButtonLabel(session = null) {
  return normalizeFilterMode(session?.filterMode) === FILTER_MODE_BRAND
    ? `\u2705 ${BUTTON_BRAND_FILTERS}`
    : BUTTON_BRAND_FILTERS
}

function getCustomFilterButtonLabel(session = null) {
  return normalizeFilterMode(session?.filterMode) === FILTER_MODE_CUSTOM
    ? `\u2705 ${BUTTON_CUSTOM_FILTER}`
    : BUTTON_CUSTOM_FILTER
}

function formatInteger(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  return Math.round(number).toLocaleString('ru-RU')
}

function formatMileage(value) {
  const formatted = formatInteger(value)
  return formatted ? `${formatted} \u043A\u043C` : ''
}

function formatKrw(value) {
  const formatted = formatInteger(value)
  return formatted ? `${formatted} KRW` : ''
}

function getTelegramApiUrl(botToken, method) {
  return `${TELEGRAM_API_BASE}/bot${botToken}/${method}`
}

function buildControlKeyboard(session = null, section = KEYBOARD_SECTION_MAIN) {
  const isActive = Boolean(session?.isActive)
  const toggleButtonLabel = isActive ? BUTTON_STOP : BUTTON_START
  const activeScope = normalizeFilterMode(session?.filterMode) === FILTER_MODE_SCOPE
    ? normalizeParseScope(session?.parseScope)
    : ''

  if (section === KEYBOARD_SECTION_FILTERS) {
    return {
      keyboard: [
        [{ text: getFilterButtonLabel(PARSE_SCOPE_ALL, activeScope) }, { text: getFilterButtonLabel(PARSE_SCOPE_DOMESTIC, activeScope) }],
        [{ text: getFilterButtonLabel(PARSE_SCOPE_IMPORTED, activeScope) }, { text: getFilterButtonLabel(PARSE_SCOPE_JAPANESE, activeScope) }],
        [{ text: getFilterButtonLabel(PARSE_SCOPE_GERMAN, activeScope) }],
        [{ text: getBrandFiltersButtonLabel(session) }, { text: getCustomFilterButtonLabel(session) }],
        [{ text: BUTTON_BACK }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  if (section === KEYBOARD_SECTION_BRANDS) {
    const rows = []
    for (let index = 0; index < BRAND_PRESETS.length; index += 2) {
      const current = BRAND_PRESETS[index]
      const next = BRAND_PRESETS[index + 1]
      rows.push([
        { text: getBrandButtonLabel(current.key, session) },
        ...(next ? [{ text: getBrandButtonLabel(next.key, session) }] : []),
      ])
    }
    rows.push([{ text: BUTTON_BACK }])

    return {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  if (section === KEYBOARD_SECTION_CUSTOM) {
    return {
      keyboard: [
        [{ text: BUTTON_BACK }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  return {
    keyboard: [
      [{ text: toggleButtonLabel }],
      [{ text: BUTTON_STATUS }, { text: BUTTON_FILTERS }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }
}

function buildStatusText(session) {
  const isActive = Boolean(session?.isActive)

  return [
    '\uD83E\uDD16 \u041F\u0430\u0440\u0441\u0438\u043D\u0433 Encar \u0447\u0435\u0440\u0435\u0437 Telegram',
    `\uD83D\uDCCA \u0421\u0442\u0430\u0442\u0443\u0441: ${isActive ? '\uD83D\uDFE2 \u0432\u043A\u043B\u044E\u0447\u0435\u043D' : '\uD83D\uDD34 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D'}`,
    `\u2705 \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0444\u0438\u043B\u044C\u0442\u0440: ${formatCurrentFilterLabel(session)}`,
    `\uD83D\uDD18 \u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435: ${isActive ? BUTTON_STOP : BUTTON_START}`,
  ].join('\n')
}

function buildFiltersText(session) {
  const activeScope = normalizeFilterMode(session?.filterMode) === FILTER_MODE_SCOPE
    ? normalizeParseScope(session?.parseScope)
    : ''

  return [
    '\uD83C\uDFAF \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0438\u043B\u044C\u0442\u0440:',
    `\u2705 \u0421\u0435\u0439\u0447\u0430\u0441 \u0430\u043A\u0442\u0438\u0432\u0435\u043D: ${formatCurrentFilterLabel(session)}`,
    '',
    `${getFilterButtonLabel(PARSE_SCOPE_ALL, activeScope)}`,
    `${getFilterButtonLabel(PARSE_SCOPE_DOMESTIC, activeScope)}`,
    `${getFilterButtonLabel(PARSE_SCOPE_IMPORTED, activeScope)}`,
    `${getFilterButtonLabel(PARSE_SCOPE_JAPANESE, activeScope)}`,
    `${getFilterButtonLabel(PARSE_SCOPE_GERMAN, activeScope)}`,
    '',
    `${getBrandFiltersButtonLabel(session)}`,
    `${getCustomFilterButtonLabel(session)}`,
  ].join('\n')
}

function buildBrandsText(session) {
  const activeBrand = getBrandPreset(session?.brandKey)

  return [
    '\uD83C\uDFF7\uFE0F \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0440\u043A\u0443:',
    `\u2705 \u0421\u0435\u0439\u0447\u0430\u0441 \u0430\u043A\u0442\u0438\u0432\u0435\u043D: ${activeBrand ? `Марка: ${activeBrand.label}` : formatCurrentFilterLabel(session)}`,
    '',
    ...BRAND_PRESETS.map((preset) => getBrandButtonLabel(preset.key, session)),
  ].join('\n')
}

function buildCustomFilterText(session) {
  return [
    '\uD83D\uDD17 \u0421\u0432\u043E\u0439 \u0444\u0438\u043B\u044C\u0442\u0440 Encar',
    '\u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u0444\u0438\u043B\u044C\u0442\u0440 Encar, \u0438 \u0431\u043E\u0442 \u0431\u0443\u0434\u0435\u0442 \u0438\u0441\u043A\u0430\u0442\u044C \u0441\u0432\u0435\u0436\u0438\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0438\u043C\u0435\u043D\u043D\u043E \u043F\u043E \u043D\u0435\u043C\u0443.',
    '\u041C\u043E\u0436\u043D\u043E \u043F\u0440\u0438\u0441\u043B\u0430\u0442\u044C \u043F\u043E\u043B\u043D\u0443\u044E Encar-\u0441\u0441\u044B\u043B\u043A\u0443 \u0438\u043B\u0438 raw `q=(And...)`.',
    '',
    `\uD83D\uDCBE \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0444\u0438\u043B\u044C\u0442\u0440: ${formatCurrentFilterLabel(session)}`,
    session?.customFilterUrl ? `\uD83D\uDD17 \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430: ${cleanText(session.customFilterUrl)}` : '',
  ].filter(Boolean).join('\n')
}

function buildListingMessage(listing) {
  return [
    '\uD83C\uDD95 \u0421\u0432\u0435\u0436\u0435\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u0435',
    `\uD83D\uDE98 ${cleanText(listing?.name) || '-'}`,
    `\uD83D\uDCE6 \u041A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0430\u0446\u0438\u044F: ${cleanText(listing?.trimLevel) || '-'}`,
    `\u26FD \u0422\u0438\u043F \u0442\u043E\u043F\u043B\u0438\u0432\u0430: ${cleanText(listing?.fuelType) || '-'}`,
    `\uD83D\uDCC5 \u0413\u043E\u0434: ${cleanText(listing?.year) || '-'}`,
    `\uD83D\uDEE3 \u041F\u0440\u043E\u0431\u0435\u0433: ${formatMileage(listing?.mileage) || '-'}`,
    `\uD83D\uDCB0 \u0426\u0435\u043D\u0430: ${formatKrw(listing?.priceKrw) || '-'}`,
    `\uD83D\uDC40 \u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u044B: ${Math.max(0, Number(listing?.manage?.viewCount) || 0)}`,
    `\uD83D\uDCDE \u0417\u0432\u043E\u043D\u043A\u0438: ${Math.max(0, Number(listing?.manage?.callCount) || 0)}`,
    `\uD83D\uDD17 Encar: ${cleanText(listing?.encarUrl) || '-'}`,
  ].join('\n')
}

function getSubscriptionCommand(text) {
  const command = cleanText(text).split(/\s+/, 1)[0].toLowerCase()
  if (!command) return ''
  if (command === '/start') return 'start'
  if (command === '/stop') return 'stop'
  return ''
}

function normalizeIncomingText(text) {
  return cleanText(text).replace(/^\u2705\s*/u, '')
}

function shouldDeactivateChat(error) {
  const httpStatus = Number(error?.response?.status) || 0
  const description = cleanText(error?.response?.data?.description || error?.message).toLowerCase()

  if (httpStatus === 403) return true
  return description.includes('bot was blocked by the user')
    || description.includes('user is deactivated')
    || description.includes('chat not found')
}

function isDirectRun() {
  const argvPath = globalThis.process?.argv?.[1]
  if (!argvPath) return false
  return import.meta.url === pathToFileURL(path.resolve(argvPath)).href
}

export async function startStandaloneTelegramFreshBot() {
  const env = readEnv()
  const botToken = cleanText(env.TELEGRAM_BOT_TOKEN)
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required')
  }

  const stateFile = cleanText(env.TELEGRAM_STATE_FILE) || DEFAULT_STATE_FILE
  const activeDelayMs = readPositiveInteger(env.TELEGRAM_FRESH_ACTIVE_DELAY_MS, DEFAULT_ACTIVE_DELAY_MS)
  const idleDelayMs = readPositiveInteger(env.TELEGRAM_FRESH_IDLE_DELAY_MS, DEFAULT_IDLE_DELAY_MS)

  const stateStore = new LocalStateStore(stateFile)
  await stateStore.load()

  const encarClient = createStandaloneEncarClient(env)

  let wakeParserResolver = null
  let stopRequested = false

  function wakeParserLoop() {
    if (wakeParserResolver) {
      const resolve = wakeParserResolver
      wakeParserResolver = null
      resolve()
    }
  }

  async function waitForWakeOrTimeout(ms) {
    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, ms)),
      new Promise((resolve) => {
        wakeParserResolver = resolve
      }),
    ])

    wakeParserResolver = null
  }

  async function sendTelegramMessage(chatId, text, { keyboard = null } = {}) {
    await axios.post(
      getTelegramApiUrl(botToken, 'sendMessage'),
      {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(keyboard ? { reply_markup: keyboard } : {}),
      },
      {
        timeout: TELEGRAM_TIMEOUT_MS,
      },
    )
  }

  async function sendControlMessage(chatId, text, session, section = KEYBOARD_SECTION_MAIN) {
    await sendTelegramMessage(chatId, text, {
      keyboard: buildControlKeyboard(session, section),
    })
  }

  async function sendListingMessage(chatId, listing) {
    await sendTelegramMessage(chatId, buildListingMessage(listing))
  }

  async function handleIncomingControl(message) {
    const chatId = normalizeChatId(message?.chat?.id)
    if (!chatId) return

    const rawText = cleanText(message?.text)
    const text = normalizeIncomingText(rawText)
    const currentSession = stateStore.getSession(chatId)
    const command = getSubscriptionCommand(text)
    const selectedBrand = BRAND_PRESETS.find((preset) => preset.button === text || preset.label === text) || null

    if (command === 'start') {
      const session = stateStore.upsertSession(chatId, {
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      await sendControlMessage(chatId, buildStatusText(session), session)
      return
    }

    if (command === 'stop' || text === BUTTON_STOP) {
      const session = stateStore.upsertSession(chatId, {
        isActive: false,
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      wakeParserLoop()
      await sendControlMessage(
        chatId,
        [
          '\u23F9\uFE0F \u041F\u0430\u0440\u0441\u0438\u043D\u0433 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D.',
          `\uD83C\uDFAF \u0424\u0438\u043B\u044C\u0442\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D: ${formatCurrentFilterLabel(session)}.`,
        ].join('\n'),
        session,
      )
      return
    }

    if (text === BUTTON_START) {
      const session = stateStore.upsertSession(chatId, {
        isActive: true,
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      wakeParserLoop()
      await sendControlMessage(
        chatId,
        [
          '\uD83D\uDE80 \u041F\u0430\u0440\u0441\u0438\u043D\u0433 \u0437\u0430\u043F\u0443\u0449\u0435\u043D.',
          `\uD83C\uDFAF \u0424\u0438\u043B\u044C\u0442\u0440: ${formatCurrentFilterLabel(session)}.`,
          '\u2728 \u041F\u043E\u0438\u0441\u043A \u0431\u0443\u0434\u0435\u0442 \u0438\u0434\u0442\u0438 \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u043E, \u043F\u043E\u043A\u0430 \u0432\u044B \u043D\u0435 \u043D\u0430\u0436\u043C\u0451\u0442\u0435 \u0441\u0442\u043E\u043F.',
        ].join('\n'),
        session,
      )
      return
    }

    if (text === BUTTON_STATUS) {
      await sendControlMessage(chatId, buildStatusText(currentSession), currentSession)
      return
    }

    if (text === BUTTON_FILTERS) {
      await sendControlMessage(chatId, buildFiltersText(currentSession), currentSession, KEYBOARD_SECTION_FILTERS)
      return
    }

    if (text === BUTTON_BRAND_FILTERS) {
      await sendControlMessage(chatId, buildBrandsText(currentSession), currentSession, KEYBOARD_SECTION_BRANDS)
      return
    }

    if (text === BUTTON_CUSTOM_FILTER) {
      const session = stateStore.upsertSession(chatId, {
        awaitingCustomFilter: true,
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      await sendControlMessage(chatId, buildCustomFilterText(session), session, KEYBOARD_SECTION_CUSTOM)
      return
    }

    if (text === BUTTON_BACK) {
      let session = currentSession
      if (currentSession?.awaitingCustomFilter) {
        session = stateStore.upsertSession(chatId, { awaitingCustomFilter: false })
        await stateStore.flush()
      }
      await sendControlMessage(chatId, buildStatusText(session), session)
      return
    }

    if (selectedBrand) {
      const session = stateStore.upsertSession(chatId, {
        filterMode: FILTER_MODE_BRAND,
        brandKey: selectedBrand.key,
        parseScope: selectedBrand.scope,
        customFilterUrl: '',
        customFilterQuery: '',
        awaitingCustomFilter: false,
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      wakeParserLoop()
      await sendControlMessage(
        chatId,
        [
          `\u2705 \u041C\u0430\u0440\u043A\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u0430: ${selectedBrand.label}.`,
          session?.isActive
            ? '\uD83D\uDE9A \u041D\u043E\u0432\u044B\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0439\u0434\u0443\u0442 \u043F\u043E \u044D\u0442\u043E\u0439 \u043C\u0430\u0440\u043A\u0435.'
            : '\uD83D\uDCBE \u041C\u0430\u0440\u043E\u0447\u043D\u044B\u0439 \u0444\u0438\u043B\u044C\u0442\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D.',
        ].join('\n'),
        session,
        KEYBOARD_SECTION_BRANDS,
      )
      return
    }

    if (currentSession?.awaitingCustomFilter) {
      const customFilter = parseCustomFilterInput(rawText)
      if (!customFilter?.query) {
        await sendControlMessage(
          chatId,
          [
            '\u26A0\uFE0F \u041D\u0435 \u0441\u043C\u043E\u0433 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440.',
            '\u041F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 \u043F\u043E\u043B\u043D\u0443\u044E Encar-\u0441\u0441\u044B\u043B\u043A\u0443 \u0441 `q=` \u0438\u043B\u0438 raw query \u0432\u0438\u0434\u0430 `(And...)`.',
          ].join('\n'),
          currentSession,
          KEYBOARD_SECTION_CUSTOM,
        )
        return
      }

      const session = stateStore.upsertSession(chatId, {
        filterMode: FILTER_MODE_CUSTOM,
        brandKey: '',
        customFilterUrl: customFilter.url || rawText,
        customFilterQuery: customFilter.query,
        awaitingCustomFilter: false,
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      wakeParserLoop()
      await sendControlMessage(
        chatId,
        [
          '\u2705 \u0421\u0432\u043E\u0439 \u0444\u0438\u043B\u044C\u0442\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D.',
          session?.customFilterUrl ? `\uD83D\uDD17 ${session.customFilterUrl}` : '',
          session?.isActive
            ? '\uD83D\uDE9A \u041D\u043E\u0432\u044B\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0442\u0435\u043F\u0435\u0440\u044C \u043F\u043E\u0439\u0434\u0443\u0442 \u043F\u043E \u0432\u0430\u0448\u0435\u0439 Encar-\u0441\u0441\u044B\u043B\u043A\u0435.'
            : '\uD83D\uDCBE \u0424\u0438\u043B\u044C\u0442\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u043F\u0430\u0440\u0441\u0438\u043D\u0433.',
        ].filter(Boolean).join('\n'),
        session,
      )
      return
    }

    const filterScope = Object.entries(FILTER_BUTTONS).find(([, label]) => label === text)?.[0] || ''
    if (filterScope) {
      const session = stateStore.upsertSession(chatId, {
        filterMode: FILTER_MODE_SCOPE,
        parseScope: filterScope,
        brandKey: '',
        customFilterUrl: '',
        customFilterQuery: '',
        awaitingCustomFilter: false,
        firstName: cleanText(message?.from?.first_name),
        lastName: cleanText(message?.from?.last_name),
        username: cleanText(message?.from?.username),
      })
      await stateStore.flush()
      wakeParserLoop()
      await sendControlMessage(
        chatId,
        [
          `\u2705 \u0424\u0438\u043B\u044C\u0442\u0440 \u0432\u044B\u0431\u0440\u0430\u043D: ${getScopeLabel(filterScope)}.`,
          session?.isActive
            ? '\uD83D\uDE9A \u041D\u043E\u0432\u044B\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0439\u0434\u0443\u0442 \u043F\u043E \u043D\u043E\u0432\u043E\u043C\u0443 \u0444\u0438\u043B\u044C\u0442\u0440\u0443.'
            : '\uD83D\uDCBE \u0424\u0438\u043B\u044C\u0442\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u043F\u0430\u0440\u0441\u0438\u043D\u0433.',
        ].join('\n'),
        session,
        KEYBOARD_SECTION_FILTERS,
      )
    }
  }

  async function fetchTelegramUpdates(offset) {
    const response = await axios.get(
      getTelegramApiUrl(botToken, 'getUpdates'),
      {
        params: {
          offset,
          timeout: 25,
          allowed_updates: JSON.stringify(TELEGRAM_ALLOWED_UPDATES),
        },
        timeout: TELEGRAM_TIMEOUT_MS + 5000,
      },
    )

    return Array.isArray(response?.data?.result) ? response.data.result : []
  }

  async function pollTelegramLoop() {
    while (!stopRequested) {
      try {
        const updates = await fetchTelegramUpdates(stateStore.getLastUpdateId() + 1)
        if (!updates.length) continue

        for (const update of updates) {
          const updateId = Math.max(0, Number(update?.update_id) || 0)
          if (updateId > stateStore.getLastUpdateId()) {
            stateStore.setLastUpdateId(updateId)
          }

          const message = update?.message || update?.edited_message || null
          if (!message?.chat?.id) continue
          if (cleanText(message?.chat?.type) !== 'private') continue

          try {
            await handleIncomingControl(message)
          } catch (error) {
            console.warn(`TELEGRAM_CONTROL_FAILED | chat_id=${normalizeChatId(message?.chat?.id)} | ${cleanText(error?.message) || 'unknown error'}`)
          }
        }

        await stateStore.flush()
      } catch (error) {
        console.warn(`TELEGRAM_POLL_FAILED | ${cleanText(error?.message) || 'unknown error'}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  async function parserLoop() {
    while (!stopRequested) {
      const activeSessions = stateStore.getActiveSessions()
      if (!activeSessions.length) {
        await waitForWakeOrTimeout(idleDelayMs)
        continue
      }

      try {
        const result = await encarClient.scanFreshListings({
          getActiveSessions: () => stateStore.getActiveSessions(),
          stateStore,
          onLog: (line) => console.warn(line),
          onFreshListing: async (listing, chatIds) => {
            for (const chatId of chatIds) {
              const latestSession = stateStore.getSession(chatId)
              if (!latestSession?.isActive) continue

              try {
                await sendListingMessage(chatId, listing)
              } catch (error) {
                console.warn(`TELEGRAM_DELIVERY_FAILED | chat_id=${chatId} | encar_id=${listing?.encarId || '-'} | ${cleanText(error?.message) || 'unknown error'}`)
                if (shouldDeactivateChat(error)) {
                  stateStore.deactivateSession(chatId)
                }
              }
            }
          },
        })

        await stateStore.flush()
        if (result?.newFreshCount) {
          console.log(`STANDALONE_FRESH_SCAN_DONE | pages=${result.pagesProcessed} | new=${result.newFreshCount}`)
        }
      } catch (error) {
        console.warn(`STANDALONE_FRESH_SCAN_FAILED | ${cleanText(error?.message) || 'unknown error'}`)
      }

      await waitForWakeOrTimeout(activeDelayMs)
    }
  }

  const loops = [pollTelegramLoop(), parserLoop()]

  console.log(`Standalone Telegram fresh bot started | state=${stateFile}`)
  await Promise.all(loops)
}

if (isDirectRun()) {
  startStandaloneTelegramFreshBot().catch((error) => {
    console.error(`STANDALONE_TELEGRAM_BOT_FATAL | ${cleanText(error?.message) || error}`)
    globalThis.process?.exit?.(1)
  })
}
