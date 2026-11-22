import en from '../public/_locales/en/messages.json' with { type: 'json' }
import ru from '../public/_locales/ru/messages.json' with { type: 'json' }

const catalogs = { en, ru }
type Language = keyof typeof catalogs
const preferenceKey = 'keywest.tester.language'

/** Uses the regional default until the user chooses a supported language. */
export function preferredLanguage(browser: Pick<Window, 'localStorage'>, fallback: Language): Language {
  try {
    const saved = browser.localStorage.getItem(preferenceKey)
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    // Browser privacy settings may block storage.
  }
  return fallback
}

/** Remembers the language across visits when the browser allows storage. */
export function saveLanguage(browser: Pick<Window, 'localStorage'>, language: Language) {
  try {
    browser.localStorage.setItem(preferenceKey, language)
  } catch {
    // The selected language still applies to the current page.
  }
}

// Regional identifiers assigned to RU in the IANA time zone database.
const russianZones = new Set([
  'Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Kirov', 'Europe/Volgograd',
  'Europe/Astrakhan', 'Europe/Saratov', 'Europe/Ulyanovsk', 'Europe/Samara',
  'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Barnaul', 'Asia/Tomsk',
  'Asia/Novokuznetsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Chita', 'Asia/Yakutsk',
  'Asia/Khandyga', 'Asia/Vladivostok', 'Asia/Ust-Nera', 'Asia/Magadan', 'Asia/Sakhalin',
  'Asia/Srednekolymsk', 'Asia/Kamchatka', 'Asia/Anadyr', 'W-SU'
])

/** Selects the page language from local region signals without a network request. */
export function pageLanguage(timeZone: string | undefined, locale: string) {
  if (timeZone && russianZones.has(timeZone)) return 'ru'
  if (timeZone?.includes('/') && !timeZone.startsWith('Etc/')) return 'en'
  return new Intl.Locale(locale).region === 'RU' ? 'ru' : 'en'
}

/** Localizes static page elements and returns the same catalog for runtime controls. */
export function localizePage(doc: Document, language: keyof typeof catalogs) {
  const catalog = catalogs[language]
  doc.documentElement.lang = language
  for (const node of doc.querySelectorAll<HTMLElement>('[data-i18n], [data-i18n-label]')) {
    const key = node.dataset.i18n ?? node.dataset.i18nLabel
    if (!key || !Object.hasOwn(catalog, key)) throw new Error('Missing translation: ' + key)
    const { message } = catalog[key as keyof typeof catalog]
    if (node.dataset.i18nLabel) node.setAttribute('aria-label', message)
    else node.textContent = message
  }
  return catalog
}
