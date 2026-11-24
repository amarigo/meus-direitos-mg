// Segurança dos dados: criptografia com senha (AES-GCM + PBKDF2) e conferência da assinatura
// das atualizações de regras (ECDSA P-256). Usa só a criptografia do próprio navegador (Web Crypto).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(globalThis.crypto);
  else raiz.Seguranca = fabrica(raiz.crypto);
})(typeof self !== 'undefined' ? self : this, function (cripto) {
  'use strict';
  const ITERACOES = 310000; // recomendação OWASP para PBKDF2-SHA256
  const enc = new TextEncoder(), dec = new TextDecoder();

  function paraB64(buf) {
    const b = new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deB64(s) {
    const bin = atob(String(s || '').trim()); const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function disponivel() { return !!(cripto && cripto.subtle && cripto.getRandomValues); }

  async function derivarChave(senha, sal, iteracoes) {
    const base = await cripto.subtle.importKey('raw', enc.encode(String(senha)), 'PBKDF2', false, ['deriveKey']);
    return cripto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iteracoes || ITERACOES, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  // Cria uma chave nova a partir da senha. Devolve {chave, sal} para guardar só na memória.
  async function novaChave(senha, iteracoes) {
    const sal = cripto.getRandomValues(new Uint8Array(16));
    return { chave: await derivarChave(senha, sal, iteracoes), sal, iteracoes: iteracoes || ITERACOES };
  }
  async function cifrar(obj, ctx) {
    const iv = cripto.getRandomValues(new Uint8Array(12));
    const ct = await cripto.subtle.encrypt({ name: 'AES-GCM', iv }, ctx.chave, enc.encode(JSON.stringify(obj)));
    return { cifrado: 1, alg: 'AES-GCM-256/PBKDF2-SHA256', it: ctx.iteracoes, sal: paraB64(ctx.sal), iv: paraB64(iv), dados: paraB64(ct) };
  }
  function ehCifrado(p) { return !!(p && typeof p === 'object' && p.cifrado === 1 && p.sal && p.iv && p.dados); }
  // Abre o pacote com a senha. Senha errada ou dados alterados → lança erro.
  async function abrir(pacote, senha) {
    if (!ehCifrado(pacote)) throw new Error('pacote inválido');
    const sal = deB64(pacote.sal);
    const it = Number(pacote.it) || ITERACOES;
    if (it < 100000 || it > 5000000) throw new Error('parâmetros inválidos');
    const chave = await derivarChave(senha, sal, it);
    const pt = await cripto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(pacote.iv) }, chave, deB64(pacote.dados));
    return { dados: JSON.parse(dec.decode(pt)), ctx: { chave, sal, iteracoes: it } };
  }

  // Confere se o texto do arquivo de regras foi assinado pela chave privada do projeto.
  async function conferirAssinatura(texto, assinaturaB64, chavePublicaJwk) {
    try {
      const chave = await cripto.subtle.importKey('jwk', chavePublicaJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await cripto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, chave, deB64(assinaturaB64), enc.encode(texto));
    } catch (e) { return false; }
  }

  return { disponivel, novaChave, cifrar, abrir, ehCifrado, conferirAssinatura, paraB64, deB64, ITERACOES };
});
