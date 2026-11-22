import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { installLanguageSwitch } from '../src/i18n.ts'

test('each tester page starts in English and switches languages only on click', () => {
  const open = () => {
    const button = new EventTarget()
    const languages = []
    installLanguageSwitch(button, language => languages.push(language))
    return { button, languages }
  }
  const first = open()
  assert.deepEqual(first.languages, ['en'])
  assert.equal(first.button.textContent, 'Русский')
  first.button.dispatchEvent(new Event('click'))
  assert.deepEqual(first.languages, ['en', 'ru'])
  assert.equal(first.button.textContent, 'English')
  assert.deepEqual(open().languages, ['en'])
  first.button.dispatchEvent(new Event('click'))
  assert.deepEqual(first.languages, ['en', 'ru', 'en'])
})

test('both locale catalogs cover the page and localized manifest fields', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const en = JSON.parse(read('public/_locales/en/messages.json'))
  const ru = JSON.parse(read('public/_locales/ru/messages.json'))
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort())
  const html = read('index.html')
  const manifest = read('public/manifest.json')
  const keys = [...html.matchAll(/data-i18n(?:-label)?="(\w+)"/g), ...manifest.matchAll(/__MSG_(\w+)__/g)]
  assert.ok(keys.length > 10)
  for (const [, key] of keys) assert.ok(en[key]?.message && ru[key]?.message, key)
})
