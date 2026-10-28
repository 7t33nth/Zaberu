// Словари трёх языков должны идти нога в ногу: пропущенный ключ не падает, а тихо
// показывает русский текст (см. translate в i18n/index.js), поэтому проверяем состав.
import test from 'node:test';
import assert from 'node:assert/strict';
import ru from '../src/lib/i18n/ru.js';
import kk from '../src/lib/i18n/kk.js';
import en from '../src/lib/i18n/en.js';

const dicts = { ru, kk, en };
const sortedKeys = (dict) => Object.keys(dict).sort();
const placeholders = (str) => [...str.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('во всех языках одинаковый набор ключей', () => {
  for (const [lang, dict] of Object.entries(dicts)) {
    assert.deepEqual(sortedKeys(dict), sortedKeys(ru), `рассинхрон ключей в ${lang}`);
  }
});

test('нет пустых переводов', () => {
  for (const [lang, dict] of Object.entries(dicts)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${lang}:${key} — не строка`);
      assert.ok(value.trim().length > 0, `${lang}:${key} — пустая строка`);
    }
  }
});

test('плейсхолдеры {var} совпадают между языками', () => {
  for (const key of sortedKeys(ru)) {
    const expected = placeholders(ru[key]);
    for (const [lang, dict] of Object.entries(dicts)) {
      assert.deepEqual(placeholders(dict[key]), expected, `${lang}:${key}`);
    }
  }
});
