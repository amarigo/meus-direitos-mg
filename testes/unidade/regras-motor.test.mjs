// R2, R3, R4, R5: o motor de regras e os cálculos de benefícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, REGRAS, SM, familia, calc, ids, prog } from '../ajuda.mjs';
const { avaliar } = Motor;

test('avaliar: comparações, combinações e operador desconhecido', () => {
  const fx = { a: 10, meioSM: 810.5, s: 'x' };
  assert.equal(avaliar({ f: 'a', op: '<=', v: 10 }, fx), true);
  assert.equal(avaliar({ f: 'a', op: '<', v: 10 }, fx), false);
  assert.equal(avaliar({ f: 'a', op: '<=', v: 'meioSM' }, fx), true);
  assert.equal(avaliar({ all: [{ f: 'a', op: '>', v: 1 }, { not: { f: 's', op: '==', v: 'y' } }] }, fx), true);
  assert.equal(avaliar({ any: [] }, fx), false);
  assert.equal(avaliar({ f: 'a', op: '~=', v: 1 }, fx), false);
  assert.equal(avaliar(null, fx), false);
});
test('valor desconhecido nunca passa numa comparação (evita direito falso)', () => {
  const ctx = { m: { idade: null } };
  assert.equal(avaliar({ f: 'm.idade', op: '<=', v: 5 }, {}, ctx), false);
  assert.equal(avaliar({ f: 'm.idade', op: '>=', v: 0 }, {}, ctx), false);
  assert.equal(avaliar({ f: 'naoExiste', op: '<', v: 1 }, {}, {}), false);
});
test('criança sem data de nascimento não ganha vaga de creche nem BPC por idade', () => {
  const f = familia([{ renda: 0 }, { nome: 'Bebê' }]);
  assert.ok(!ids(f).includes('creche'));
  assert.ok(!ids(f).includes('bpc_idoso'));
});

test('Bolsa Família: limite exato de R$ 218 por pessoa', () => {
  const lim = REGRAS.parametros.linhaPobrezaBF;
  assert.equal(prog(familia([{ idade: 30, renda: lim * 2 }, { idade: 30 }]), 'bolsa_familia')?.status, 'sim');
  assert.equal(prog(familia([{ idade: 30, renda: lim * 2 + 0.02 }, { idade: 30 }]), 'bolsa_familia'), undefined);
});
test('Bolsa Família: Regra de Proteção só para quem já recebe e até meio salário', () => {
  const quemRecebe = familia([{ idade: 30, renda: 600 }, { idade: 30 }], { bf: 'sim' });
  const p = prog(quemRecebe, 'bolsa_familia');
  assert.equal(p.status, 'talvez');
  assert.equal(p.mensal, 300);
  assert.equal(prog(familia([{ idade: 30, renda: 600 }, { idade: 30 }], { bf: 'nao' }), 'bolsa_familia'), undefined);
  assert.equal(prog(familia([{ idade: 30, renda: SM + 2 }, { idade: 30 }], { bf: 'sim' }), 'bolsa_familia'), undefined);
});
test('Bolsa Família: valores conhecidos', () => {
  const v = f => prog(f, 'bolsa_familia').mensal;
  assert.equal(v(familia([{ idade: 40, renda: 0 }])), 600);                                     // mínimo
  assert.equal(v(familia([{ idade: 38, renda: 800 }, { idade: 16 }, { idade: 4 }, { idade: 71 }])), 800); // 600 + 150 + 50
  assert.equal(v(familia([{ idade: 30, renda: 0 }, { idade: 30 }, { idade: 30 }, { idade: 30 }, { idade: 30 }, { idade: 30 }])), 852); // 6 × 142
  assert.equal(v(familia([{ idade: 25, renda: 0, sexo: 'F', gestante: true }, { idade: 0 }])), 600 + 50 + 150);
  assert.equal(v(familia([{ idade: 25, renda: 0, sexo: 'F', nutriz: true }, { idade: 0 }])), 600 + 50 + 150);
  assert.equal(v(familia([{ idade: 25, renda: 0, sexo: 'M', gestante: true }])), 600);          // homem marcado grávido não conta
});
test('BPC idoso: limite de 1/4 do salário mínimo por pessoa', () => {
  const quarto = SM / 4;
  assert.equal(prog(familia([{ idade: 65, renda: 0 }, { idade: 40, renda: quarto * 2 }]), 'bpc_idoso')?.status, 'sim');
  assert.equal(prog(familia([{ idade: 65, renda: 0 }, { idade: 40, renda: quarto * 2 + 1 }]), 'bpc_idoso')?.status, 'talvez');
  assert.equal(prog(familia([{ idade: 65, renda: 0 }, { idade: 40, renda: SM + 1 }]), 'bpc_idoso'), undefined);
  assert.equal(prog(familia([{ idade: 64, renda: 0 }]), 'bpc_idoso'), undefined);
});
test('BPC: aposentadoria de 1 salário do outro idoso não entra na conta (LOAS art. 20 §14)', () => {
  const casal = renda => familia([{ idade: 67, renda: 0 }, { idade: 70, renda, fonte: 'aposentadoria' }]);
  const r = prog(casal(SM), 'bpc_idoso');
  assert.equal(r.status, 'sim');
  assert.deepEqual(r.quem, ['P1']);
  assert.equal(prog(casal(SM * 1.5), 'bpc_idoso'), undefined);        // acima de 1 SM conta
  const naoIdoso = familia([{ idade: 67, renda: 0 }, { idade: 50, renda: SM, fonte: 'aposentadoria' }]);
  assert.equal(prog(naoIdoso, 'bpc_idoso')?.status, 'talvez');         // aposentado com 50 anos conta: 1621/2 > 1/4
});
test('BPC: quem já recebe não aparece de novo, e ninguém recebe dois BPC', () => {
  assert.equal(prog(familia([{ idade: 70, renda: SM, fonte: 'bpc' }]), 'bpc_idoso'), undefined);
  const f = familia([{ idade: 70, renda: 0, pcd: true }]);
  const idoso = prog(f, 'bpc_idoso'), pcd = prog(f, 'bpc_pcd');
  assert.equal(idoso.status, 'sim');
  assert.equal(pcd, undefined);
  assert.equal(calc(f).res.filter(r => r.pr.id.startsWith('bpc')).reduce((s, r) => s + r.mensal, 0), SM);
});
test('BPC pessoa com deficiência: criança também tem direito', () => {
  const r = prog(familia([{ idade: 30, renda: 300 }, { idade: 6, nome: 'Lia', pcd: true }]), 'bpc_pcd');
  assert.equal(r.status, 'sim');
  assert.deepEqual(r.quem, ['Lia']);
});
test('Tarifa social e desconto social de energia não aparecem juntos', () => {
  for (const renda of [0, 500, SM, SM * 1.2, SM * 2, SM * 3]) {
    const l = ids(familia([{ idade: 30, renda }, { idade: 30 }]));
    assert.ok(!(l.includes('tarifa_social_luz') && l.includes('desconto_social_luz')), 'renda ' + renda);
  }
  assert.ok(ids(familia([{ idade: 30, renda: SM * 1.5 }, { idade: 30 }])).includes('desconto_social_luz'));
});
test('Copasa: 65% até R$ 218 por pessoa, 55% até meio salário', () => {
  assert.match(prog(familia([{ idade: 30, renda: 400 }, { idade: 3 }], { agua: 'copasa' }), 'copasa_social').valor, /65%/);
  assert.match(prog(familia([{ idade: 30, renda: 1500 }, { idade: 3 }], { agua: 'copasa' }), 'copasa_social').valor, /55%/);
  assert.equal(prog(familia([{ idade: 30, renda: 1500 }, { idade: 3 }], { agua: 'outra' }), 'copasa_social'), undefined);
});
test('Pé-de-Meia: só ensino médio público, 14 a 24 anos, até meio salário', () => {
  const f = (idade, estudo, rede, renda) => familia([{ idade: 40, renda }, { idade, nome: 'E', estudo, rede }]);
  assert.equal(prog(f(16, 'medio', 'publica', 1000), 'pe_de_meia')?.status, 'sim');
  assert.equal(prog(f(16, 'medio', 'particular', 1000), 'pe_de_meia'), undefined);
  assert.equal(prog(f(13, 'medio', 'publica', 1000), 'pe_de_meia'), undefined);
  assert.equal(prog(f(16, 'medio', 'publica', SM + 2), 'pe_de_meia'), undefined);
  assert.equal(prog(f(20, 'eja', 'publica', 0), 'pe_de_meia')?.status, 'sim');
  assert.equal(prog(f(18, 'eja', 'publica', 0), 'pe_de_meia'), undefined);
});
test('CadÚnico aparece sempre que outro programa precisa dele, e avisa cadastro velho', () => {
  const f = familia([{ idade: 40, renda: SM * 3.5 }, { idade: 70, nome: 'Vó' }], { cad: 'velho' }); // só a Carteira da Pessoa Idosa pede CadÚnico
  const r = calc(f).res;
  assert.ok(r.some(x => x.pr.id === 'cadunico'));
  const g = familia([{ idade: 30, renda: 0 }], { cad: 'velho' });
  assert.ok(prog(g, 'cadunico').avisos.some(a => /mais de 2 anos/.test(a)));
});
test('Farmácia Popular não depende de renda', () => {
  assert.equal(prog(familia([{ idade: 50, renda: SM * 10, doencas: ['pressao'] }]), 'farmacia_popular')?.status, 'sim');
});
test('Resultado vem com prováveis primeiro e por prioridade', () => {
  const r = calc(familia([{ idade: 38, renda: 800 }, { idade: 16, estudo: 'medio' }, { idade: 4 }, { idade: 71 }], { bf: 'sim' })).res;
  const i = r.findIndex(x => x.status === 'talvez');
  if (i >= 0) assert.ok(r.slice(i).every(x => x.status === 'talvez'));
});
test('preencher troca {campos} e mantém os desconhecidos', () => {
  assert.equal(Motor.preencher('R$ {salarioMinimo} e {x}', { salarioMinimo: 1621 }), 'R$ 1.621 e {x}');
  assert.equal(Motor.preencher('{meioSM}', { meioSM: 810.5 }), '810,50');
});
