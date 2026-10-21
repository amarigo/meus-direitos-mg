// R7, R8, R10, R12: proteção do texto, dados estragados e validação das regras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, REGRAS } from '../ajuda.mjs';
const copia = () => JSON.parse(JSON.stringify(REGRAS));

test('esc neutraliza HTML perigoso', () => {
  const ataque = '<img src=x onerror="alert(1)">\'"&';
  const s = Motor.esc(ataque);
  assert.ok(!/[<>"']/.test(s));
  assert.equal(s, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&quot;&amp;');
  assert.equal(Motor.esc(null), '');
});
test('normalizarFamilia recupera qualquer coisa estragada', () => {
  for (const lixo of [null, undefined, 42, 'texto', [], [1, 2], { pessoas: 'x' }, { pessoas: [null, 3, {}] }, { saude: 5, sit: null, cidade: 7 }, { pessoas: [{ nome: 9, renda: 1500, doencas: 'pressao', fonte: null }] }]) {
    const f = Motor.normalizarFamilia(lixo);
    assert.ok(Array.isArray(f.pessoas) && f.pessoas.length >= 1);
    for (const p of f.pessoas) { assert.equal(typeof p.nome, 'string'); assert.ok(Array.isArray(p.doencas)); assert.equal(typeof p.renda, 'string'); assert.ok(p.fonte); }
    assert.equal(typeof f.saude, 'object'); assert.equal(typeof f.sit, 'object');
    assert.doesNotThrow(() => Motor.calcular(f, REGRAS, '2026-10-21'));
  }
});
test('normalizarFamilia mantém os dados bons', () => {
  const f = Motor.normalizarFamilia({ cidade: 'Itajubá', pessoas: [{ nome: 'Ana', renda: 1500 }] });
  assert.equal(f.cidade, 'Itajubá'); assert.equal(f.pessoas[0].nome, 'Ana'); assert.equal(f.pessoas[0].renda, '1500');
});
test('o arquivo de regras atual passa na validação', () => {
  assert.deepEqual(Motor.validarRegras(REGRAS), []);
});
test('validação recusa regras estragadas', () => {
  const casos = [
    ['versão vazia', r => { r.versao = ''; }],
    ['salário zero', r => { r.parametros.salarioMinimo = 0; }],
    ['salário absurdo', r => { r.parametros.salarioMinimo = 1621000; }],
    ['sem programas', r => { r.programas = []; }],
    ['fato inventado', r => { r.programas[1].condicao = { f: 'rendaInventada', op: '<=', v: 1 }; }],
    ['limite inventado', r => { r.programas[1].condicao = { f: 'rpc', op: '<=', v: 'metadeDoSalario' }; }],
    ['fato de pessoa fora de porMembro', r => { r.programas[1].condicao = { f: 'm.idade', op: '>=', v: 65 }; }],
    ['canal inexistente', r => { r.programas[1].ondeIr = ['nada']; }],
    ['documento inexistente', r => { r.programas[1].documentos = ['passaporte']; }],
    ['link sem https', r => { r.programas[1].fonte.url = 'javascript:alert(1)'; }],
    ['id repetido', r => { r.programas[2].id = r.programas[1].id; }],
    ['sem cadunico', r => { r.programas = r.programas.filter(p => p.id !== 'cadunico'); }],
    ['cálculo inexistente', r => { r.programas[1].calculo = 'roubar'; }],
    ['município fora de MG', r => { r.municipios = { '3550308': { extras: [] } }; }],
    ['CRAS sem endereço', r => { r.municipios['3132404'].cras = [{ nome: 'x' }]; }],
    ['fonte da cidade sem https', r => { r.municipios['3132404'].fonte.url = 'http://x'; }],
    ['operador inválido', r => { r.programas[1].condicao = { f: 'rpc', op: '=~', v: 1 }; }]
  ];
  for (const [nome, estraga] of casos) { const r = copia(); estraga(r); assert.ok(Motor.validarRegras(r).length > 0, nome); }
  assert.ok(Motor.validarRegras(null).length > 0);
  assert.ok(Motor.validarRegras('texto').length > 0);
});
test('cmpVersao compara números, não texto', () => {
  assert.ok(Motor.cmpVersao('2026.10.10', '2026.10.9') > 0);
  assert.ok(Motor.cmpVersao('2026.9.1', '2026.10.1') < 0);
  assert.equal(Motor.cmpVersao('2026.10.1', '2026.10.1'), 0);
});
