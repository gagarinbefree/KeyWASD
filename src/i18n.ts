import en from '../public/_locales/en/messages.json' with { type: 'json' }
import ru from '../public/_locales/ru/messages.json' with { type: 'json' }

const catalogs = { en, ru }
type Language = keyof typeof catalogs

/** Starts each tester page in English and switches its language on button clicks. */
export function installLanguageSwitch(button: HTMLElement, onChange: (language: Language) => void) {
  function select(language: Language) {
    button.lang = language === 'en' ? 'ru' : 'en'
    button.textContent = language === 'en' ? 'Русский' : 'English'
    onChange(language)
  }
  select('en')
  button.addEventListener('click', () => select(button.lang === 'ru' ? 'ru' : 'en'))
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
