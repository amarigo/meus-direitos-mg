import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
export const Motor = require('../src/motor.js');
export const Seguranca = require('../src/seguranca.js');
export const REGRAS = JSON.parse(readFileSync(new URL('../src/regras.json', import.meta.url), 'utf8'));
export const HOJE = '2026-10-21';
export const SM = REGRAS.parametros.salarioMinimo;
// Data de nascimento para alguém com essa idade em HOJE (aniversário em 1º de janeiro).
export const nasc = idade => (2026 - idade) + '-01-01';
// Monta uma família: pessoas = [{idade, renda, fonte, ...}]
export function familia(pessoas, extra = {}) {
  const f = Motor.familiaVazia();
  f.pessoas = pessoas.map((p, i) => {
    const n = Motor.novaPessoa(i === 0);
    const { idade, ...resto } = p;
    Object.assign(n, { nome: p.nome || 'P' + (i + 1), nasc: idade === undefined ? '' : nasc(idade) }, resto);
    if (p.renda !== undefined && !p.fonte) n.fonte = 'informal';
    if (p.renda !== undefined) n.renda = String(p.renda);
    return n;
  });
  return Object.assign(f, extra);
}
export function calc(f, regras = REGRAS) { return Motor.calcular(f, regras, HOJE); }
export function ids(f, status) { return calc(f).res.filter(r => !status || r.status === status).map(r => r.pr.id); }
export function prog(f, id) { return calc(f).res.find(r => r.pr.id === id); }
