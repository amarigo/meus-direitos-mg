import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
export const { chromium } = pw;

// Preenche o formulário inteiro como uma pessoa faria.
export async function preencherFamilia(pg, { cidade = 'Itajubá', pessoas, cad = 'nao', agua = 'copasa' }) {
  await pg.click('#comecar');
  await pg.fill('#cidade', cidade);
  await pg.check('input[name=moradia][value=alugada]');
  await pg.check(`input[name=agua][value=${agua}]`);
  await pg.check('input[name=luz][value=familia]');
  await pg.click('#avancar');
  for (let i = 0; i < pessoas.length; i++) {
    if (i > 0) await pg.click('#add-pessoa');
    const p = pessoas[i];
    await pg.fill(`#p${i}_nome`, p.nome);
    if (p.nasc) await pg.fill(`#p${i}_nasc`, p.nasc);
    if (p.sexo) await pg.selectOption(`#p${i}_sexo`, p.sexo);
    if (p.fonte) await pg.selectOption(`#p${i}_fonte`, p.fonte);
    if (p.renda) await pg.fill(`#p${i}_renda`, p.renda);
    if (p.estudo) await pg.selectOption(`#p${i}_estudo`, p.estudo);
    if (p.cpf) { await pg.click(`#p${i}_nome >> xpath=ancestor::section//summary`); await pg.fill(`#p${i}_cpf`, p.cpf); }
  }
  await pg.click('#avancar');
  await pg.click('#avancar');
  await pg.check(`input[name=cad][value=${cad}]`);
  await pg.check('input[name=bf][value=nao]');
  await pg.click('#avancar');
  await pg.waitForSelector('#n-sim');
}
export async function semRolagemLateral(pg) {
  return pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
