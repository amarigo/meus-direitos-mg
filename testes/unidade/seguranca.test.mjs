// R6 e R8: criptografia dos dados e assinatura das atualizações.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Seguranca as S } from '../ajuda.mjs';
const IT = 100000; // mínimo aceito; deixa o teste rápido

test('cifra e abre com a senha certa', async () => {
  const ctx = await S.novaChave('minhasenha', IT);
  const pac = await S.cifrar({ nome: 'Ana', cpf: '123.456.789-00' }, ctx);
  assert.ok(S.ehCifrado(pac));
  assert.ok(!JSON.stringify(pac).includes('Ana') && !JSON.stringify(pac).includes('123.456'));
  const { dados } = await S.abrir(pac, 'minhasenha');
  assert.equal(dados.nome, 'Ana');
});
test('senha errada ou dados alterados não abrem', async () => {
  const ctx = await S.novaChave('certa123', IT);
  const pac = await S.cifrar({ a: 1 }, ctx);
  await assert.rejects(S.abrir(pac, 'errada123'));
  const b = S.deB64(pac.dados); b[0] ^= 1;
  await assert.rejects(S.abrir({ ...pac, dados: S.paraB64(b) }, 'certa123'));
  await assert.rejects(S.abrir({ ...pac, it: 10 }, 'certa123'));      // ataque que baixa a proteção
  await assert.rejects(S.abrir({ cifrado: 1 }, 'certa123'));
});
test('cada gravação usa sal e vetor novos', async () => {
  const a = await S.novaChave('x12345', IT), b = await S.novaChave('x12345', IT);
  assert.notEqual(S.paraB64(a.sal), S.paraB64(b.sal));
  const p1 = await S.cifrar({ a: 1 }, a), p2 = await S.cifrar({ a: 1 }, a);
  assert.notEqual(p1.iv, p2.iv); assert.notEqual(p1.dados, p2.dados);
});
test('assinatura: aceita a certa e recusa adulteração, outra chave e lixo', async () => {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const outro = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', par.publicKey);
  const texto = '{"versao":"2026.11.1"}';
  const assina = async (k, t) => S.paraB64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(t)));
  const sig = await assina(par.privateKey, texto);
  assert.equal(await S.conferirAssinatura(texto, sig, pub), true);
  assert.equal(await S.conferirAssinatura(texto.replace('11', '12'), sig, pub), false);
  assert.equal(await S.conferirAssinatura(texto, await assina(outro.privateKey, texto), pub), false);
  for (const lixo of ['', 'abc', '!!!', null]) assert.equal(await S.conferirAssinatura(texto, lixo, pub), false);
  assert.equal(await S.conferirAssinatura(texto, sig, { kty: 'EC' }), false);
});
