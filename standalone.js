import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  BRAND_PRESETS,
  FILTER_MODE_BRAND,
  FILTER_MODE_CUSTOM,
  FILTER_MODE_SCOPE,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  getBrandPreset,
  getBrandSelectionLabel,
  getCustomFilterLabel,
  getFilterSummary,
  normalizeBrandKey,
  normalizeBrandSelections,
  normalizeCustomFilters,
  normalizeFilterMode,
  parseCustomFilterInputs,
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

const BUTTON_START = '🚀 Запустить парсинг'
const BUTTON_STOP = '⏹️ Остановить парсинг'
const BUTTON_STATUS = '📊 Статус'
const BUTTON_FILTERS = '🎯 Фильтры'
const BUTTON_BRAND_FILTERS = '🏷️ Фильтр по марке'
const BUTTON_CUSTOM_FILTER = '🔗 Свой фильтр'
const BUTTON_ADD_LINK = '➕ Добавить ссылку'
const BUTTON_BACK = '⬅️ Назад'

const KEYBOARD_SECTION_MAIN = 'main'
const KEYBOARD_SECTION_FILTERS = 'filters'
const KEYBOARD_SECTION_BRANDS = 'brands'
const KEYBOARD_SECTION_BRAND_YEARS = 'brand_years'
const KEYBOARD_SECTION_BRAND_MONTHS = 'brand_months'
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

function normalizeMessageId(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function isPersistentControlSection(section = '') {
  return section === KEYBOARD_SECTION_MAIN || section === KEYBOARD_SECTION_FILTERS
}

function getSessionBrandSelections(session = {}) {
  return normalizeBrandSelections(session?.brandSelections, session?.brandKey)
}

function getSessionCustomFilters(session = {}) {
  return normalizeCustomFilters(session?.customFilters, session?.customFilterUrl, session?.customFilterQuery)
}

function getPendingBrandMonthSelections(session = {}) {
  const brandKey = normalizeBrandKey(session?.pendingBrandKey)
  const year = Number.parseInt(String(session?.pendingBrandYear || ''), 10)
  if (!brandKey || !Number.isFinite(year) || year <= 0) return []

  return getSessionBrandSelections(session)
    .filter((selection) => normalizeBrandKey(selection?.brandKey) === brandKey && Number(selection?.year) === year)
}

function formatCurrentFilterLabel(session) {
  return getFilterSummary(session)
}

function buildButtonRows(buttons = [], columns = 2) {
  const rows = []
  for (let index = 0; index < buttons.length; index += columns) {
    rows.push(buttons.slice(index, index + columns).map((text) => ({ text })))
  }
  return rows
}

function getBrandButtonLabel(brandKey, session = {}) {
  const preset = getBrandPreset(brandKey)
  const baseLabel = preset?.button || preset?.label || brandKey
  const isSelected = getSessionBrandSelections(session)
    .some((selection) => normalizeBrandKey(selection?.brandKey) === normalizeBrandKey(brandKey))
  return isSelected ? `✅ ${baseLabel}` : baseLabel
}

function getBrandFiltersButtonLabel(session = {}) {
  return normalizeFilterMode(session?.filterMode) === FILTER_MODE_BRAND
    && getSessionBrandSelections(session).length
    ? `✅ ${BUTTON_BRAND_FILTERS}`
    : BUTTON_BRAND_FILTERS
}

function getCustomFilterButtonLabel(session = {}) {
  return normalizeFilterMode(session?.filterMode) === FILTER_MODE_CUSTOM
    && getSessionCustomFilters(session).length
    ? `✅ ${BUTTON_CUSTOM_FILTER}`
    : BUTTON_CUSTOM_FILTER
}

function getDeleteLinkButtonLabel(index) {
  return `🗑 ${index}`
}

function parseDeleteLinkButton(text) {
  const match = cleanText(text).match(/^🗑\s*(\d+)$/u)
  if (!match) return 0
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getDeleteFilterButtons(session = {}) {
  const filterMode = normalizeFilterMode(session?.filterMode)
  if (filterMode === FILTER_MODE_BRAND) {
    return getSessionBrandSelections(session)
      .map((_, index) => getDeleteLinkButtonLabel(index + 1))
  }

  if (filterMode === FILTER_MODE_CUSTOM) {
    return getSessionCustomFilters(session)
      .map((_, index) => getDeleteLinkButtonLabel(index + 1))
  }

  return []
}

function parseYearButton(text) {
  const parsed = Number.parseInt(cleanText(text), 10)
  return YEAR_OPTIONS.includes(parsed) ? parsed : 0
}

function parseMonthButton(text) {
  const parsed = Number.parseInt(cleanText(text), 10)
  return MONTH_OPTIONS.includes(parsed) ? parsed : 0
}

function getMonthButtonLabel(month, session = {}) {
  const normalizedMonth = Number.parseInt(String(month || ''), 10)
  const baseLabel = String(normalizedMonth).padStart(2, '0')
  const isSelected = getPendingBrandMonthSelections(session)
    .some((selection) => Number(selection?.month) === normalizedMonth)
  return isSelected ? `✅ ${baseLabel}` : baseLabel
}

function formatInteger(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  return Math.round(number).toLocaleString('ru-RU')
}

function formatMileage(value) {
  const formatted = formatInteger(value)
  return formatted ? `${formatted} км` : ''
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

  if (section === KEYBOARD_SECTION_FILTERS) {
    return {
      keyboard: [
        [{ text: getBrandFiltersButtonLabel(session) }, { text: getCustomFilterButtonLabel(session) }],
        [{ text: BUTTON_BACK }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  if (section === KEYBOARD_SECTION_BRANDS) {
    const rows = buildButtonRows(
      BRAND_PRESETS.map((preset) => getBrandButtonLabel(preset.key, session)),
      3,
    )
    rows.push([{ text: BUTTON_BACK }])

    return {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  if (section === KEYBOARD_SECTION_BRAND_YEARS) {
    const rows = buildButtonRows(YEAR_OPTIONS.map((year) => String(year)), 3)
    rows.push([{ text: BUTTON_BACK }])

    return {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  if (section === KEYBOARD_SECTION_BRAND_MONTHS) {
    const rows = buildButtonRows(MONTH_OPTIONS.map((month) => getMonthButtonLabel(month, session)), 3)
    rows.push([{ text: BUTTON_BACK }])

    return {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  }

  if (section === KEYBOARD_SECTION_CUSTOM) {
    const deleteButtons = getSessionCustomFilters(session)
      .map((_, index) => getDeleteLinkButtonLabel(index + 1))

    return {
      keyboard: [
        [{ text: BUTTON_ADD_LINK }],
        ...buildButtonRows(deleteButtons, 3),
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
      ...buildButtonRows(getDeleteFilterButtons(session), 3),
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }
}

function buildBrandSelectionsLines(session = {}) {
  const selections = getSessionBrandSelections(session)
  if (!selections.length) {
    return ['🚗 По умолчанию бот ищет по всем машинам.']
  }

  return [
    '🏷️ Выбранные марки:',
    ...selections.map((selection, index) => `${index + 1}. ${getBrandSelectionLabel(selection)}`),
  ]
}

function buildCustomFiltersLines(session = {}) {
  const filters = getSessionCustomFilters(session)
  if (!filters.length) {
    return ['🔗 Своих Encar-ссылок пока нет.']
  }

  return [
    '🔗 Сохранённые ссылки:',
    ...filters.map((filter, index) => getCustomFilterLabel(filter, index + 1)),
  ]
}

function buildStatusText(session) {
  const isActive = Boolean(session?.isActive)
  const filterMode = normalizeFilterMode(session?.filterMode)
  const lines = [
    '🤖 Парсинг Encar через Telegram',
    `📊 Статус: ${isActive ? '🟢 включен' : '🔴 выключен'}`,
    `✅ Текущий фильтр: ${formatCurrentFilterLabel(session)}`,
    '',
  ]

  if (filterMode === FILTER_MODE_BRAND) {
    lines.push(...buildBrandSelectionsLines(session))
  } else if (filterMode === FILTER_MODE_CUSTOM) {
    lines.push(...buildCustomFiltersLines(session))
  } else {
    lines.push('🚗 По умолчанию бот ищет по всем машинам.')
  }

  lines.push('', `🔘 Действие: ${isActive ? BUTTON_STOP : BUTTON_START}`)
  if (getDeleteFilterButtons(session).length) {
    lines.push('', '🗑 Удаление фильтров: кнопки ниже.')
  }

  return lines.join('\n')
}

function buildFiltersText(session) {
  return [
    '🎯 Настройте фильтр:',
    `✅ Сейчас активно: ${formatCurrentFilterLabel(session)}`,
    '',
    '🚗 Если ничего не выбрать, бот будет искать по всем машинам.',
    '',
    `${getBrandFiltersButtonLabel(session)}`,
    `${getCustomFilterButtonLabel(session)}`,
  ].join('\n')
}

function buildBrandsText(session) {
  return [
    '🏷️ Выберите марку.',
    'После выбора марки бот попросит год, затем месяц.',
    'Можно добавить несколько марок подряд.',
    '',
    ...buildBrandSelectionsLines(session),
  ].join('\n')
}

function buildBrandYearsText(session) {
  const preset = getBrandPreset(session?.pendingBrandKey)
  return [
    `📅 Выберите год для ${preset?.label || 'марки'}.`,
    'Диапазон: 2000-2026.',
  ].join('\n')
}

function buildBrandMonthsText(session) {
  const preset = getBrandPreset(session?.pendingBrandKey)
  return [
    `🗓️ Выберите месяц для ${preset?.label || 'марки'}.`,
    `Год: ${session?.pendingBrandYear || '-'}.`,
  ].join('\n')
}

function buildPendingBrandMonthsText(session) {
  const preset = getBrandPreset(session?.pendingBrandKey)
  const selectedMonths = getPendingBrandMonthSelections(session)
    .filter((selection) => Number(selection?.month) > 0)
    .map((selection) => String(selection.month).padStart(2, '0'))

  return [
    `🗓️ Выберите месяц для ${preset?.label || 'марки'}.`,
    `Год: ${session?.pendingBrandYear || '-'}.`,
    'Можно выбрать несколько месяцев.',
    ...(selectedMonths.length ? ['', `Уже выбрано: ${selectedMonths.join(', ')}.`] : []),
  ].join('\n')
}

function buildCustomFilterText(session) {
  return [
    'Нажмите «➕ Добавить ссылку», затем пришлите одну или несколько ссылок Encar.',
  ].join('\n')
}

function buildAwaitingCustomFilterText(session) {
  return [
    '➕ Пришлите одну или несколько Encar-ссылок.',
  ].join('\n')
}

function buildListingMessage(listing) {
  return [
    '🆕 Свежее объявление',
    `🚘 ${cleanText(listing?.name) || '-'}`,
    `📦 Комплектация: ${cleanText(listing?.trimLevel) || '-'}`,
    `⛽ Тип топлива: ${cleanText(listing?.fuelType) || '-'}`,
    `📅 Год: ${cleanText(listing?.year) || '-'}`,
    `🛣 Пробег: ${formatMileage(listing?.mileage) || '-'}`,
    `💰 Цена: ${formatKrw(listing?.priceKrw) || '-'}`,
    `👀 Просмотры: ${Math.max(0, Number(listing?.manage?.viewCount) || 0)}`,
    `📞 Звонки: ${Math.max(0, Number(listing?.manage?.callCount) || 0)}`,
    `🔗 Encar: ${cleanText(listing?.encarUrl) || '-'}`,
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
  return cleanText(text).replace(/^✅\s*/u, '')
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
    const response = await axios.post(
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
    return response?.data?.result || null
  }

  async function deleteTelegramMessage(chatId, messageId) {
    const normalizedMessageId = normalizeMessageId(messageId)
    if (!normalizedMessageId) return false

    try {
      await axios.post(
        getTelegramApiUrl(botToken, 'deleteMessage'),
        {
          chat_id: chatId,
          message_id: normalizedMessageId,
        },
        {
          timeout: TELEGRAM_TIMEOUT_MS,
        },
      )
      return true
    } catch {
      return false
    }
  }

  async function sendControlMessage(chatId, text, session, section = KEYBOARD_SECTION_MAIN, { deleteMessageIds = [] } = {}) {
    const keyboard = buildControlKeyboard(session, section)
    const existingTransientMessageId = normalizeMessageId(session?.lastControlMessageId)
    const existingMainMessageId = normalizeMessageId(session?.lastMainMessageId)
    const existingFiltersMessageId = normalizeMessageId(session?.lastFiltersMessageId)
    const controlMessage = await sendTelegramMessage(chatId, text, { keyboard })
    const nextMessageId = normalizeMessageId(controlMessage?.message_id)
    const persistentMessageId = section === KEYBOARD_SECTION_MAIN
      ? existingMainMessageId
      : section === KEYBOARD_SECTION_FILTERS
        ? existingFiltersMessageId
        : 0
    const messageIdsToDelete = Array.from(
      new Set(
        [existingTransientMessageId, persistentMessageId, ...deleteMessageIds]
          .map((value) => normalizeMessageId(value))
          .filter((value) => value && value !== nextMessageId),
      ),
    )

    if (messageIdsToDelete.length) {
      await Promise.allSettled(
        messageIdsToDelete.map((messageId) => deleteTelegramMessage(chatId, messageId)),
      )
    }

    const nextSession = stateStore.upsertSession(chatId, {
      lastControlMessageId: isPersistentControlSection(section) ? 0 : nextMessageId,
      lastMainMessageId: section === KEYBOARD_SECTION_MAIN ? nextMessageId : existingMainMessageId,
      lastFiltersMessageId: section === KEYBOARD_SECTION_FILTERS ? nextMessageId : existingFiltersMessageId,
      currentSection: section,
    })
    await stateStore.flush()
    return nextSession
  }

  async function sendListingMessage(chatId, listing) {
    await sendTelegramMessage(chatId, buildListingMessage(listing))
  }

  async function respondWithControl(message, text, session, section = KEYBOARD_SECTION_MAIN) {
    const chatId = normalizeChatId(message?.chat?.id)
    const sourceMessageId = normalizeMessageId(message?.message_id)
    return sendControlMessage(chatId, text, session, section, {
      deleteMessageIds: sourceMessageId ? [sourceMessageId] : [],
    })
  }

  async function handleIncomingControl(message) {
    const chatId = normalizeChatId(message?.chat?.id)
    if (!chatId) return

    const rawText = String(message?.text || '')
    const text = normalizeIncomingText(rawText)
    const currentSession = stateStore.getSession(chatId)
    const command = getSubscriptionCommand(text)
    const selectedBrand = BRAND_PRESETS.find((preset) => preset.button === text || preset.label === text) || null
    const selectedYear = currentSession?.awaitingBrandYear ? parseYearButton(text) : 0
    const selectedMonth = currentSession?.awaitingBrandMonth ? parseMonthButton(text) : 0
    const deleteCustomIndex = parseDeleteLinkButton(text)
    const parsedCustomFilters = parseCustomFilterInputs(rawText)

    const commonUserFields = {
      firstName: cleanText(message?.from?.first_name),
      lastName: cleanText(message?.from?.last_name),
      username: cleanText(message?.from?.username),
    }

    if (command === 'start') {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_MAIN,
      })
      await stateStore.flush()
      await respondWithControl(message, buildStatusText(session), session, KEYBOARD_SECTION_MAIN)
      return
    }

    if (command === 'stop' || text === BUTTON_STOP) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        isActive: false,
        currentSection: KEYBOARD_SECTION_MAIN,
      })
      await stateStore.flush()
      wakeParserLoop()
      await respondWithControl(
        message,
        [
          '⏹️ Парсинг остановлен.',
          `🎯 Фильтр сохранён: ${formatCurrentFilterLabel(session)}.`,
        ].join('\n'),
        session,
        KEYBOARD_SECTION_MAIN,
      )
      return
    }

    if (text === BUTTON_START) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        isActive: true,
        currentSection: KEYBOARD_SECTION_MAIN,
      })
      await stateStore.flush()
      wakeParserLoop()
      await respondWithControl(
        message,
        [
          '🚀 Парсинг запущен.',
          `🎯 Фильтр: ${formatCurrentFilterLabel(session)}.`,
          '🔄 Поиск будет идти непрерывно, пока вы не нажмёте стоп.',
        ].join('\n'),
        session,
        KEYBOARD_SECTION_MAIN,
      )
      return
    }

    if (text === BUTTON_STATUS) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_MAIN,
      })
      await stateStore.flush()
      await respondWithControl(message, buildStatusText(session), session, KEYBOARD_SECTION_MAIN)
      return
    }

    if (text === BUTTON_FILTERS) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_FILTERS,
        awaitingCustomFilter: false,
      })
      await stateStore.flush()
      await respondWithControl(message, buildFiltersText(session), session, KEYBOARD_SECTION_FILTERS)
      return
    }

    if (text === BUTTON_BRAND_FILTERS) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_BRANDS,
        awaitingCustomFilter: false,
        awaitingBrandYear: false,
        awaitingBrandMonth: false,
        pendingBrandKey: '',
        pendingBrandYear: 0,
      })
      await stateStore.flush()
      await respondWithControl(message, buildBrandsText(session), session, KEYBOARD_SECTION_BRANDS)
      return
    }

    if (text === BUTTON_CUSTOM_FILTER) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_CUSTOM,
        awaitingCustomFilter: false,
        awaitingBrandYear: false,
        awaitingBrandMonth: false,
        pendingBrandKey: '',
        pendingBrandYear: 0,
      })
      await stateStore.flush()
      await respondWithControl(message, buildCustomFilterText(session), session, KEYBOARD_SECTION_CUSTOM)
      return
    }

    if (text === BUTTON_ADD_LINK) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_CUSTOM,
        awaitingCustomFilter: true,
      })
      await stateStore.flush()
      await respondWithControl(message, buildAwaitingCustomFilterText(session), session, KEYBOARD_SECTION_CUSTOM)
      return
    }

    if (text === BUTTON_BACK) {
      if (currentSession?.awaitingBrandMonth || currentSession?.currentSection === KEYBOARD_SECTION_BRAND_MONTHS) {
        const hasSelectedMonths = getPendingBrandMonthSelections(currentSession)
          .some((selection) => Number(selection?.month) > 0)

        if (currentSession?.pendingBrandKey && currentSession?.pendingBrandYear && !hasSelectedMonths) {
          const fallbackSelection = {
            brandKey: currentSession.pendingBrandKey,
            year: currentSession.pendingBrandYear,
            month: 0,
          }
          const nextSelections = normalizeBrandSelections([
            ...getSessionBrandSelections(currentSession),
            fallbackSelection,
          ])

          const session = stateStore.upsertSession(chatId, {
            ...commonUserFields,
            filterMode: FILTER_MODE_BRAND,
            brandSelections: nextSelections,
            brandKey: currentSession.pendingBrandKey,
            currentSection: KEYBOARD_SECTION_BRAND_YEARS,
            awaitingBrandMonth: false,
            awaitingBrandYear: true,
            pendingBrandYear: 0,
          })
          await stateStore.flush()
          wakeParserLoop()
          await respondWithControl(
            message,
            [
              `✅ Добавлен фильтр: ${getBrandSelectionLabel(fallbackSelection)}.`,
              '',
              buildBrandYearsText(session),
            ].join('\n'),
            session,
            KEYBOARD_SECTION_BRAND_YEARS,
          )
          return
        }

        const session = stateStore.upsertSession(chatId, {
          ...commonUserFields,
          currentSection: KEYBOARD_SECTION_BRAND_YEARS,
          awaitingBrandMonth: false,
          awaitingBrandYear: true,
          pendingBrandYear: 0,
        })
        await stateStore.flush()
        await respondWithControl(message, buildBrandYearsText(session), session, KEYBOARD_SECTION_BRAND_YEARS)
        return
      }

      if (currentSession?.awaitingBrandYear || currentSession?.currentSection === KEYBOARD_SECTION_BRAND_YEARS) {
        if (currentSession?.pendingBrandKey) {
          const fallbackSelection = {
            brandKey: currentSession.pendingBrandKey,
            year: 0,
            month: 0,
          }
          const nextSelections = normalizeBrandSelections([
            ...getSessionBrandSelections(currentSession),
            fallbackSelection,
          ])

          const session = stateStore.upsertSession(chatId, {
            ...commonUserFields,
            filterMode: FILTER_MODE_BRAND,
            brandSelections: nextSelections,
            brandKey: currentSession.pendingBrandKey,
            currentSection: KEYBOARD_SECTION_BRANDS,
            awaitingBrandYear: false,
            pendingBrandYear: 0,
            pendingBrandKey: '',
          })
          await stateStore.flush()
          wakeParserLoop()
          await respondWithControl(
            message,
            [
              `✅ Добавлен фильтр: ${getBrandSelectionLabel(fallbackSelection)}.`,
              '',
              buildBrandsText(session),
            ].join('\n'),
            session,
            KEYBOARD_SECTION_BRANDS,
          )
          return
        }

        const session = stateStore.upsertSession(chatId, {
          ...commonUserFields,
          currentSection: KEYBOARD_SECTION_BRANDS,
          awaitingBrandYear: false,
          pendingBrandYear: 0,
          pendingBrandKey: '',
        })
        await stateStore.flush()
        await respondWithControl(message, buildBrandsText(session), session, KEYBOARD_SECTION_BRANDS)
        return
      }

      if (currentSession?.awaitingCustomFilter) {
        const session = stateStore.upsertSession(chatId, {
          ...commonUserFields,
          currentSection: KEYBOARD_SECTION_CUSTOM,
          awaitingCustomFilter: false,
        })
        await stateStore.flush()
        await respondWithControl(message, buildCustomFilterText(session), session, KEYBOARD_SECTION_CUSTOM)
        return
      }

      if (currentSession?.currentSection === KEYBOARD_SECTION_BRANDS || currentSession?.currentSection === KEYBOARD_SECTION_CUSTOM) {
        const session = stateStore.upsertSession(chatId, {
          ...commonUserFields,
          currentSection: KEYBOARD_SECTION_FILTERS,
        })
        await stateStore.flush()
        await respondWithControl(message, buildFiltersText(session), session, KEYBOARD_SECTION_FILTERS)
        return
      }

      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: currentSession?.currentSection === KEYBOARD_SECTION_FILTERS
          ? KEYBOARD_SECTION_MAIN
          : KEYBOARD_SECTION_FILTERS,
      })
      await stateStore.flush()
      if (session.currentSection === KEYBOARD_SECTION_FILTERS) {
        await respondWithControl(message, buildFiltersText(session), session, KEYBOARD_SECTION_FILTERS)
      } else {
        await respondWithControl(message, buildStatusText(session), session, KEYBOARD_SECTION_MAIN)
      }
      return
    }

    if (deleteCustomIndex > 0 && normalizeFilterMode(currentSession?.filterMode) === FILTER_MODE_BRAND) {
      const currentBrands = getSessionBrandSelections(currentSession)
      if (deleteCustomIndex <= currentBrands.length) {
        const nextBrands = currentBrands.filter((_, index) => index !== deleteCustomIndex - 1)
        const nextFilterMode = nextBrands.length
          ? FILTER_MODE_BRAND
          : getSessionCustomFilters(currentSession).length
            ? FILTER_MODE_CUSTOM
            : FILTER_MODE_SCOPE

        const session = stateStore.upsertSession(chatId, {
          ...commonUserFields,
          filterMode: nextFilterMode,
          brandSelections: nextBrands,
          brandKey: nextBrands.at(-1)?.brandKey || '',
          currentSection: KEYBOARD_SECTION_MAIN,
        })
        await stateStore.flush()
        wakeParserLoop()
        await respondWithControl(
          message,
          [
            `🗑 Фильтр ${deleteCustomIndex} удалён.`,
            '',
            buildStatusText(session),
          ].join('\n'),
          session,
          KEYBOARD_SECTION_MAIN,
        )
        return
      }
    }

    if (deleteCustomIndex > 0) {
      const currentCustomFilters = getSessionCustomFilters(currentSession)
      if (deleteCustomIndex <= currentCustomFilters.length) {
        const nextCustomFilters = currentCustomFilters.filter((_, index) => index !== deleteCustomIndex - 1)
        const nextFilterMode = nextCustomFilters.length
          ? FILTER_MODE_CUSTOM
          : getSessionBrandSelections(currentSession).length
            ? FILTER_MODE_BRAND
            : FILTER_MODE_SCOPE
        const nextSection = currentSession?.currentSection === KEYBOARD_SECTION_CUSTOM
          ? KEYBOARD_SECTION_CUSTOM
          : KEYBOARD_SECTION_MAIN

        const session = stateStore.upsertSession(chatId, {
          ...commonUserFields,
          filterMode: nextFilterMode,
          customFilters: nextCustomFilters,
          currentSection: nextSection,
          awaitingCustomFilter: false,
          customFilterUrl: nextCustomFilters.at(-1)?.url || '',
          customFilterQuery: nextCustomFilters.at(-1)?.query || '',
        })
        await stateStore.flush()
        wakeParserLoop()
        await respondWithControl(
          message,
          [
            `🗑 Ссылка ${deleteCustomIndex} удалена.`,
            '',
            nextSection === KEYBOARD_SECTION_CUSTOM ? buildCustomFilterText(session) : buildStatusText(session),
          ].join('\n'),
          session,
          nextSection,
        )
        return
      }
    }

    if (selectedBrand) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_BRAND_YEARS,
        pendingBrandKey: selectedBrand.key,
        pendingBrandYear: 0,
        awaitingBrandYear: true,
        awaitingBrandMonth: false,
      })
      await stateStore.flush()
      await respondWithControl(message, buildBrandYearsText(session), session, KEYBOARD_SECTION_BRAND_YEARS)
      return
    }

    if (selectedYear) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_BRAND_MONTHS,
        pendingBrandYear: selectedYear,
        awaitingBrandYear: false,
        awaitingBrandMonth: true,
      })
      await stateStore.flush()
      await respondWithControl(message, buildPendingBrandMonthsText(session), session, KEYBOARD_SECTION_BRAND_MONTHS)
      return
    }

    if (selectedMonth && currentSession?.pendingBrandKey && currentSession?.pendingBrandYear) {
      const currentSelections = getSessionBrandSelections(currentSession)
      const nextSelections = normalizeBrandSelections([
        ...currentSelections,
        {
          brandKey: currentSession.pendingBrandKey,
          year: currentSession.pendingBrandYear,
          month: selectedMonth,
        },
      ])
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        filterMode: FILTER_MODE_BRAND,
        brandSelections: nextSelections,
        brandKey: currentSession.pendingBrandKey,
        currentSection: KEYBOARD_SECTION_BRAND_MONTHS,
        awaitingBrandYear: false,
        awaitingBrandMonth: true,
      })
      await stateStore.flush()
      wakeParserLoop()
      await respondWithControl(
        message,
        [
          `✅ Добавлен фильтр: ${getBrandSelectionLabel(nextSelections.at(-1))}.`,
          '',
          buildPendingBrandMonthsText(session),
        ].join('\n'),
        session,
        KEYBOARD_SECTION_BRAND_MONTHS,
      )
      return
    }

    if (parsedCustomFilters.length && (currentSession?.awaitingCustomFilter || /encar\.com|q=\(|^\s*\(/i.test(rawText))) {
      const nextCustomFilters = normalizeCustomFilters([
        ...getSessionCustomFilters(currentSession),
        ...parsedCustomFilters,
      ])

      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        filterMode: FILTER_MODE_CUSTOM,
        customFilters: nextCustomFilters,
        customFilterUrl: nextCustomFilters.at(-1)?.url || '',
        customFilterQuery: nextCustomFilters.at(-1)?.query || '',
        awaitingCustomFilter: false,
        currentSection: KEYBOARD_SECTION_CUSTOM,
      })
      await stateStore.flush()
      wakeParserLoop()
      await respondWithControl(
        message,
        [
          `✅ Добавлено ссылок: ${parsedCustomFilters.length}.`,
          '',
          buildCustomFilterText(session),
        ].join('\n'),
        session,
        KEYBOARD_SECTION_CUSTOM,
      )
      return
    }

    if (currentSession?.awaitingCustomFilter) {
      const session = stateStore.upsertSession(chatId, {
        ...commonUserFields,
        currentSection: KEYBOARD_SECTION_CUSTOM,
      })
      await stateStore.flush()
      await respondWithControl(
        message,
        [
          '⚠️ Не смог разобрать ссылку.',
          'Пришлите одну или несколько Encar-ссылок либо raw `q=(And...)`.',
          '',
          buildAwaitingCustomFilterText(session),
        ].join('\n'),
        session,
        KEYBOARD_SECTION_CUSTOM,
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
    console.error(error)
    process.exitCode = 1
  })
}
