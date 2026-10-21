// R1 e R3: leitura de valores em reais e de datas de nascimento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor } from '../ajuda.mjs';
const { numero, idade } = Motor;

test('lê renda do jeito que as pessoas digitam', () => {
  const casos = { '1.500': 1500, '1.500,50': 1500.5, 'R$ 900': 900, '900,5': 900.5, '1500.75': 1500.75, '1.234.567': 1234567, '800': 800, ' 1 200 ': 1200, '0': 0, '': 0, 'abc': 0 };
  for (const [entrada, esperado] of Object.entries(casos)) assert.equal(numero(entrada), esperado, 'entrada ' + JSON.stringify(entrada));
});
test('nunca devolve número negativo, infinito ou NaN', () => {
  for (const v of ['-500', -500, NaN, Infinity, -Infinity, null, undefined, {}, [], '1e999', '--', '.,.,']) {
    const n = numero(v);
    assert.ok(Number.isFinite(n) && n >= 0, 'entrada ' + String(v) + ' deu ' + n);
  }
});
test('idade conta o aniversário certo', () => {
  assert.equal(idade('1961-10-21', '2026-10-21'), 65);   // faz 65 hoje
  assert.equal(idade('1961-10-22', '2026-10-21'), 64);   // faz 65 amanhã
  assert.equal(idade('2008-02-29', '2026-02-28'), 17);   // bissexto
  assert.equal(idade('2026-10-21', '2026-10-21'), 0);    // nasceu hoje
});
test('data vazia, inválida, no futuro ou absurda vira idade desconhecida', () => {
  for (const d of ['', null, undefined, 'abc', '2026-13-01', '2026-02-30', '2030-01-01', '1800-01-01', '21/10/1990', '1990-1-1']) {
    assert.equal(idade(d, '2026-10-21'), null, 'data ' + d);
  }
});
