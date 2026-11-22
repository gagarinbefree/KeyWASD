import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pageLanguage } from '../src/i18n.ts'

test('the local time zone selects Russian in Russia and English abroad', () => {
  for (const zone of ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Kamchatka']) {
    assert.equal(pageLanguage(zone, 'en-US'), 'ru')
  }
  assert.equal(pageLanguage('Asia/Almaty', 'ru-RU'), 'en')
  assert.equal(pageLanguage('America/New_York', 'ru'), 'en')
})

test('a neutral clock falls back to the browser region, then English', () => {
  assert.equal(pageLanguage('UTC', 'en-RU'), 'ru')
  assert.equal(pageLanguage('Etc/GMT+3', 'ru-KZ'), 'en')
  assert.equal(pageLanguage(undefined, 'ru'), 'en')
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
