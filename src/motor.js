// Motor de cálculo dos direitos. Sem dependências e sem acesso à tela,
// para poder ser testado sozinho (Node) e usado no navegador (window.Motor).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Motor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function brl(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  // Lê valores em reais do jeito que as pessoas digitam: "1.500", "1.500,50", "R$ 900", "900,5".
  // Nunca devolve número negativo nem NaN.
  function numero(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : 0;
    let s = String(v || '').replace(/[^\d,.]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');      // 1.500 = mil e quinhentos
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    const n = Number(s);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // Idade em anos completos. Data vazia, inválida, no futuro ou absurda → null (idade desconhecida).
  function idade(nasc, hoje) {
    if (!nasc || !/^\d{4}-\d{2}-\d{2}$/.test(nasc)) return null;
    const d = new Date(nasc + 'T12:00:00');
    if (isNaN(d)) return null;
    const [aa, mm, dd] = nasc.split('-').map(Number);
    if (d.getFullYear() !== aa || d.getMonth() + 1 !== mm || d.getDate() !== dd) return null; // ex.: 30 de fevereiro
    const h = hoje ? new Date(hoje + 'T12:00:00') : new Date();
    let i = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) i--;
    return i >= 0 && i <= 130 ? i : null;
  }

  function cmpVersao(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }

  function params(regras) {
    const p = Object.assign({}, regras.parametros);
    const sm = p.salarioMinimo;
    p.quartoSM = sm / 4; p.meioSM = sm / 2; p.umSM = sm; p.doisSM = sm * 2; p.tresSM = sm * 3;
    return p;
  }

  // Troca {campo} pelo valor. {campo$} escreve em reais (R$ 1.234,56).
  function preencher(txt, p) {
    return String(txt || '').replace(/\{(\w+)(\$?)\}/g, (_, k, rs) => {
      const v = p[k];
      if (v === undefined || v === null) return _;
      if (rs) return brl(v);
      return typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) : String(v);
    });
  }

  // ---------- Dados da família ----------
  function novaPessoa(resp) {
    return { nome: '', nasc: '', parentesco: resp ? 'Responsável pela família' : '', sexo: '', cpf: '', nis: '', renda: '', fonte: 'sem', estudo: 'nao', rede: 'publica', medioCompleto: false, pcd: false, gestante: false, nutriz: false, demitido: false, incontinencia: false, semDocumento: false, doencas: [] };
  }
  // Doenças graves com direitos especiais (Lei 7.713/1988 art. 6º XIV; Lei 8.036/1990 art. 20; Portaria Interministerial MTP/MS 22/2022)
  // Doenças com remédio grátis na Farmácia Popular
  const FARMACIA_POPULAR = ['pressao', 'diabetes', 'asma', 'rinite', 'colesterol', 'osteoporose', 'parkinson', 'glaucoma', 'anticoncepcional'];
  const DOENCAS_GRAVES = ['cancer', 'hiv', 'renal', 'coracao', 'tuberculose', 'hanseniase', 'mental_grave', 'esclerose', 'hepatite', 'parkinson', 'cegueira', 'paralisia'];
  // Doenças que costumam usar remédios de alto custo do SUS (Farmácia de Minas / Componente Especializado)
  const DOENCAS_ALTO_CUSTO = ['renal', 'esclerose', 'hepatite', 'alzheimer', 'epilepsia', 'mental_grave', 'rara', 'parkinson'];
  function familiaVazia() {
    return { cidade: '', bairro: '', rua: '', numero: '', complemento: '', referencia: '', endereco: '', cep: '', telefone: '', contato2Nome: '', contato2Parentesco: '', contato2Tel: '', zona: 'urbana', moradia: '', agua: '', luz: '', docsOk: {}, emails: {}, pessoas: [novaPessoa(true)], saude: { consulta: false, especialista: false, dentista: false, mental: false }, cad: '', bf: '', sit: { agricultor: false, pescador: false, indigena: false, violencia: false, rua: false, emergencia: false, justica: false } };
  }
  // Conserta dados salvos estragados ou de versões antigas, sem perder o que estiver certo.
  function normalizarFamilia(f) {
    const base = familiaVazia();
    if (!f || typeof f !== 'object' || Array.isArray(f)) return base;
    const out = Object.assign({}, base);
    for (const k of ['cidade', 'bairro', 'rua', 'numero', 'complemento', 'referencia', 'endereco', 'cep', 'telefone', 'contato2Nome', 'contato2Parentesco', 'contato2Tel', 'zona', 'moradia', 'agua', 'luz', 'cad', 'bf']) if (typeof f[k] === 'string') out[k] = f[k];
    if (!out.rua && out.endereco) out.rua = out.endereco; // dados de versões antigas
    out.docsOk = f.docsOk && typeof f.docsOk === 'object' && !Array.isArray(f.docsOk) ? Object.fromEntries(Object.entries(f.docsOk).filter(([k, v]) => typeof k === 'string' && v === true).slice(0, 2000)) : {};
    out.emails = f.emails && typeof f.emails === 'object' && !Array.isArray(f.emails) ? Object.fromEntries(Object.entries(f.emails).filter(([k, v]) => typeof v === 'string').map(([k, v]) => [k, v.slice(0, 120)])) : {};
    out.saude = Object.assign({}, base.saude, f.saude && typeof f.saude === 'object' ? f.saude : {});
    out.sit = Object.assign({}, base.sit, f.sit && typeof f.sit === 'object' ? f.sit : {});
    const ps = Array.isArray(f.pessoas) ? f.pessoas.filter(p => p && typeof p === 'object') : [];
    out.pessoas = ps.length ? ps.map((p, i) => {
      const n = Object.assign(novaPessoa(i === 0), p);
      for (const k of ['nome', 'nasc', 'parentesco', 'sexo', 'cpf', 'nis', 'fonte', 'estudo', 'rede']) n[k] = typeof n[k] === 'string' ? n[k] : '';
      if (!n.fonte) n.fonte = 'sem';
      if (!n.estudo) n.estudo = 'nao';
      n.renda = typeof n.renda === 'number' ? String(n.renda) : (typeof n.renda === 'string' ? n.renda : '');
      n.doencas = Array.isArray(n.doencas) ? n.doencas.filter(d => typeof d === 'string') : [];
      return n;
    }) : base.pessoas;
    return out;
  }

  // ---------- Fatos ----------
  function fatos(f, regras, hoje) {
    const p = params(regras);
    const pessoas = f.pessoas.filter(x => String(x.nome || '').trim() || x.nasc || numero(x.renda));
    const n = Math.max(pessoas.length, 1);
    const membros = pessoas.map((x, indice) => {
      const id = idade(x.nasc, hoje);
      const renda = x.fonte === 'sem' ? 0 : numero(x.renda);
      const estuda = !!x.estudo && x.estudo !== 'nao';
      return {
        indice, nome: String(x.nome || '').trim() || 'Pessoa sem nome', idade: id, sexo: x.sexo, pcd: !!x.pcd,
        gestante: !!x.gestante && x.sexo !== 'M', nutriz: !!x.nutriz && x.sexo !== 'M',
        estudo: x.estudo || 'nao', redePublica: x.rede === 'publica' && estuda, medioCompleto: !!x.medioCompleto, renda, fonte: x.fonte,
        recebeBPC: x.fonte === 'bpc', trabalhoFormal: x.fonte === 'formal', demitido: !!x.demitido, incontinencia: !!x.incontinencia,
        doencas: x.doencas || [], temRemedio: (x.doencas || []).some(d => FARMACIA_POPULAR.includes(d)), semDocumento: !!x.semDocumento,
        cancer: (x.doencas || []).includes('cancer'), hiv: (x.doencas || []).includes('hiv'),
        doencaGrave: (x.doencas || []).some(d => DOENCAS_GRAVES.includes(d)), altoCusto: (x.doencas || []).some(d => DOENCAS_ALTO_CUSTO.includes(d)),
        aposentado: x.fonte === 'aposentadoria'
      };
    });
    const rendaTotal = membros.reduce((s, m) => s + m.renda, 0);
    // No BPC, o benefício de até 1 salário mínimo de outro idoso (65+) ou pessoa com deficiência não entra na conta (LOAS art. 20, §14).
    const rendaBPC = membros.reduce((s, m) => s + (((m.fonte === 'bpc' || m.fonte === 'aposentadoria') && m.renda <= p.salarioMinimo && ((m.idade ?? 0) >= 65 || m.pcd)) ? 0 : m.renda), 0);
    const s = f.saude || {}; const t = f.sit || {};
    const entre = (m, a, b) => m.idade !== null && m.idade >= a && m.idade <= b;
    return Object.assign({}, p, {
      n, membros, rendaTotal, rpc: rendaTotal / n, rpcBPC: rendaBPC / n,
      algumBPC: membros.some(m => m.recebeBPC), algumaGestante: membros.some(m => m.gestante),
      criancas0a6: membros.filter(m => entre(m, 0, 6)).length,
      jovens7a17: membros.filter(m => entre(m, 7, 17)).length,
      gestantes: membros.filter(m => m.gestante).length, nutrizes: membros.filter(m => m.nutriz).length,
      precisaSaude: !!(s.consulta || s.especialista || s.dentista || s.mental) || membros.some(m => m.gestante || m.temRemedio || m.pcd),
      precisaEspecialista: !!s.especialista || membros.some(m => m.doencas.some(d => ['cancer', 'renal', 'coracao', 'esclerose', 'rara'].includes(d))),
      precisaDentista: !!s.dentista, precisaSaudeMental: !!s.mental || membros.some(m => m.doencas.some(d => ['mental_grave', 'alzheimer'].includes(d))),
      precisaJustica: !!t.justica, violencia: !!t.violencia, situacaoRua: !!t.rua || f.moradia === 'rua', agricultor: !!t.agricultor,
      pescador: !!t.pescador, indigena: !!t.indigena, emergencia: !!t.emergencia,
      semCasaPropria: f.moradia !== 'propria', aguaCopasa: f.agua === 'copasa', aguaNaoSei: f.agua === 'naosei' || !f.agua,
      contaLuzOutroNome: f.luz === 'outro', recebeBF: f.bf === 'sim', cadunico: f.cad, cadOk: f.cad === 'sim'
    });
  }

  // ---------- Regras ----------
  function valorDe(fx, ctx, k) {
    const caminho = String(k).split('.');
    let o = fx;
    if (caminho[0] === 'm') { o = ctx && ctx.m; caminho.shift(); }
    for (const c of caminho) { if (o == null) return undefined; o = o[c]; }
    return o;
  }
  // Valor desconhecido (null/undefined) nunca passa numa comparação: na dúvida, não promete direito.
  function avaliar(c, fx, ctx) {
    if (!c || typeof c !== 'object') return false;
    if (Array.isArray(c.all)) return c.all.every(x => avaliar(x, fx, ctx));
    if (Array.isArray(c.any)) return c.any.some(x => avaliar(x, fx, ctx));
    if (c.not) return !avaliar(c.not, fx, ctx);
    const a = valorDe(fx, ctx, c.f);
    if (!c.op) return !!a;
    const b = typeof c.v === 'string' && fx[c.v] !== undefined ? fx[c.v] : c.v;
    if (a === null || a === undefined) return false;
    switch (c.op) {
      case '<=': return typeof a === 'number' && typeof b === 'number' && a <= b + 1e-9;
      case '<': return typeof a === 'number' && typeof b === 'number' && a < b;
      case '>=': return typeof a === 'number' && typeof b === 'number' && a >= b - 1e-9;
      case '>': return typeof a === 'number' && typeof b === 'number' && a > b + 1e-9;
      case '==': return a === b;
      case '!=': return a !== b;
      case 'in': return Array.isArray(b) && b.includes(a);
    }
    return false;
  }

  const CALCULOS = {
    bolsaFamilia(fx, status) {
      let base = fx.bfPorPessoa * fx.n; if (base < fx.bfMinimo) base = fx.bfMinimo;
      let total = base + fx.bfPrimeiraInfancia * fx.criancas0a6 + fx.bfVariavel * (fx.jovens7a17 + fx.gestantes + fx.nutrizes);
      if (status === 'talvez') total = total / 2;
      return { mensal: total, texto: (status === 'talvez' ? 'Cerca de ' + brl(total) + ' por mês (metade, pela Regra de Proteção)' : 'Cerca de ' + brl(total) + ' por mês') + ' (estimativa)' };
    },
    copasa(fx) { return { mensal: 0, texto: fx.rpc <= fx.linhaPobrezaBF ? '65% de desconto na conta de água' : '55% de desconto na conta de água' }; }
  };

  function calcular(f, regras, hoje) {
    const fx = fatos(f, regras, hoje); const res = [];
    for (const pr of regras.programas) {
      let status = null, quem = [];
      if (pr.porMembro) {
        const sims = fx.membros.filter(m => avaliar(pr.condicao, fx, { m }));
        const talvez = pr.condicaoTalvez ? fx.membros.filter(m => !sims.includes(m) && avaliar(pr.condicaoTalvez, fx, { m })) : [];
        if (sims.length) { status = 'sim'; quem = sims; } else if (talvez.length) { status = 'talvez'; quem = talvez; }
      } else {
        if (avaliar(pr.condicao, fx, {})) status = 'sim';
        else if (pr.condicaoTalvez && avaliar(pr.condicaoTalvez, fx, {})) status = 'talvez';
      }
      if (!status) continue;
      let valor = preencher(pr.valor, fx), mensal = 0;
      if (pr.calculo && CALCULOS[pr.calculo]) { const r = CALCULOS[pr.calculo](fx, status); valor = r.texto; mensal = r.mensal; }
      if ((pr.id === 'bpc_idoso' || pr.id === 'bpc_pcd') && status === 'sim') mensal = fx.salarioMinimo * quem.length;
      const avisos = [];
      if (pr.aviso) avisos.push(pr.aviso);
      if (pr.avisoSe && avaliar(pr.avisoSe, fx, {})) avisos.push(pr.avisoSe.texto);
      const modelo = status === 'talvez' && pr.porqueTalvez ? pr.porqueTalvez : pr.porque;
      const motivos = pr.porMembro
        ? quem.map(m => ({ nome: m.nome, texto: preencher(modelo, Object.assign({}, fx, { nome: m.nome, idade: m.idade === null ? '?' : m.idade })) }))
        : [{ nome: null, texto: preencher(modelo, fx) }];
      res.push({ pr, status, quem: quem.map(m => m.nome), quemIdx: quem.map(m => m.indice), motivos, valor, mensal, precisaCad: !!pr.requerCadUnico && !fx.cadOk, avisos, nota: status === 'talvez' ? (pr.notaTalvez || '') : '' });
    }
    // Uma pessoa que pode receber BPC como idosa e como pessoa com deficiência só recebe um BPC.
    const bi = res.find(r => r.pr.id === 'bpc_idoso'), bd = res.find(r => r.pr.id === 'bpc_pcd');
    if (bi && bd) {
      const fica = bd.quemIdx.map((ix, k) => !bi.quemIdx.includes(ix) ? k : -1).filter(k => k >= 0);
      bd.quem = fica.map(k => bd.quem[k]); bd.motivos = fica.map(k => bd.motivos[k]); bd.quemIdx = fica.map(k => bd.quemIdx[k]);
      if (!bd.quem.length) res.splice(res.indexOf(bd), 1);
      else if (bd.status === 'sim') bd.mensal = fx.salarioMinimo * bd.quem.length;
    }
    // CadÚnico aparece sempre que algum programa precisar dele.
    const precisa = res.some(r => r.pr.requerCadUnico);
    let cad = res.find(r => r.pr.id === 'cadunico');
    if (precisa && !cad) {
      const pr = regras.programas.find(p => p.id === 'cadunico');
      if (pr) { cad = { pr, status: 'sim', quem: [], quemIdx: [], motivos: [{ nome: null, texto: 'Outros programas da lista pedem que a família esteja no CadÚnico com os dados atualizados.' }], valor: pr.valor, mensal: 0, precisaCad: false, avisos: [], nota: '' }; res.push(cad); }
    }
    if (cad && fx.cadOk) cad.avisos.push('Vocês já estão no CadÚnico. Atualize sempre que mudar renda, endereço ou alguém entrar ou sair da casa.');
    if (cad && fx.cadunico === 'velho') cad.avisos.push('O cadastro tem mais de 2 anos. Atualize logo: cadastro velho bloqueia os benefícios.');
    res.sort((a, b) => (a.status === b.status ? 0 : a.status === 'sim' ? -1 : 1) || (a.pr.prioridade - b.pr.prioridade));
    return { fx, res };
  }

  // ---------- Onde ir, o que pedir e o que levar ----------
  const QUEM_DOC = ['todos', 'responsavel', 'beneficiario', 'casa', 'com_renda', 'estudantes', 'criancas', 'gestantes'];
  function pessoasDoDocumento(quem, r, fx) {
    const ms = fx.membros;
    switch (quem) {
      case 'casa': return null;
      case 'todos': return ms;
      case 'responsavel': return ms.slice(0, 1);
      case 'beneficiario': return r.quemIdx && r.quemIdx.length ? ms.filter(m => r.quemIdx.includes(m.indice)) : ms.slice(0, 1);
      case 'com_renda': return ms.filter(m => m.renda > 0);
      case 'estudantes': return ms.filter(m => m.estudo !== 'nao');
      case 'criancas': return ms.filter(m => m.idade !== null && m.idade <= 7);
      case 'gestantes': return ms.filter(m => m.gestante);
    }
    return ms.slice(0, 1);
  }
  // Agrupa os programas pelo primeiro lugar onde pedir e monta a lista de documentos de cada lugar,
  // dizendo de quem é cada documento e para qual programa serve.
  function planoPorLocal(calc, regras) {
    const { fx, res } = calc;
    const ordem = [], mapa = {};
    const urg = res.filter(r => r.pr.prioridade === 0);
    for (const r of urg.concat(res.filter(r => r.pr.prioridade !== 0))) {
      const c = r.pr.ondeIr[0];
      if (!mapa[c]) { mapa[c] = { canal: c, programas: [], itens: [], _por: {} }; ordem.push(mapa[c]); }
      const g = mapa[c];
      if (g.programas.includes(r)) continue;
      g.programas.push(r);
      for (const id of r.pr.documentos) {
        const def = regras.documentos[id]; if (!def) continue;
        const d = typeof def === 'string' ? { texto: def, quem: 'casa' } : def;
        const pessoas = pessoasDoDocumento(d.quem || 'casa', r, fx);
        if (pessoas && !pessoas.length) continue;
        const chave = d.texto;
        let item = g._por[chave];
        if (!item) { item = g._por[chave] = { id, texto: d.texto, obs: d.obs || '', pessoas: pessoas ? [] : null, para: [] }; g.itens.push(item); }
        if (pessoas) for (const m of pessoas) if (!item.pessoas.some(x => x.indice === m.indice)) item.pessoas.push({ indice: m.indice, nome: m.nome });
        const titulo = r.pr.titulo.split(' (')[0];
        if (!item.para.includes(titulo)) item.para.push(titulo);
      }
    }
    for (const g of ordem) { delete g._por; g.itens.forEach(i => i.pessoas && i.pessoas.sort((a, b) => a.indice - b.indice)); }
    return ordem;
  }
  // Para cada pessoa, os programas em que ela aparece e o motivo; e os que valem para a família toda.
  function direitosPorPessoa(calc) {
    const { fx, res } = calc;
    const pessoas = fx.membros.map(m => ({ indice: m.indice, nome: m.nome, idade: m.idade, itens: [] }));
    const familia = [];
    for (const r of res) {
      if (r.pr.porMembro) r.quemIdx.forEach((ix, k) => { const p = pessoas.find(x => x.indice === ix); if (p) p.itens.push({ titulo: r.pr.titulo, status: r.status, motivo: r.motivos[k] ? r.motivos[k].texto : '' }); });
      else familia.push({ titulo: r.pr.titulo, status: r.status, motivo: r.motivos[0] ? r.motivos[0].texto : '' });
    }
    return { pessoas, familia };
  }

  // ---------- Validação do arquivo de regras ----------
  // Usada antes de aceitar uma atualização baixada da internet. Devolve lista de problemas (vazia = ok).
  const FATOS_FAMILIA = ['n', 'rendaTotal', 'rpc', 'rpcBPC', 'algumBPC', 'algumaGestante', 'criancas0a6', 'jovens7a17', 'gestantes', 'nutrizes', 'precisaSaude', 'precisaEspecialista', 'precisaDentista', 'precisaSaudeMental', 'precisaJustica', 'violencia', 'situacaoRua', 'agricultor', 'pescador', 'indigena', 'emergencia', 'semCasaPropria', 'aguaCopasa', 'aguaNaoSei', 'contaLuzOutroNome', 'recebeBF', 'cadunico', 'cadOk'];
  const FATOS_MEMBRO = ['idade', 'sexo', 'pcd', 'gestante', 'nutriz', 'estudo', 'redePublica', 'medioCompleto', 'renda', 'fonte', 'recebeBPC', 'trabalhoFormal', 'demitido', 'incontinencia', 'doencas', 'temRemedio', 'semDocumento', 'cancer', 'hiv', 'doencaGrave', 'altoCusto', 'aposentado'];
  const LIMITES = ['quartoSM', 'meioSM', 'umSM', 'doisSM', 'tresSM'];
  const OPS = ['<=', '<', '>=', '>', '==', '!=', 'in'];
  function validarRegras(r) {
    const erros = [];
    if (!r || typeof r !== 'object') return ['arquivo vazio ou não é um objeto'];
    if (typeof r.versao !== 'string' || !/^\d{4}\.\d{1,2}\.\d+$/.test(r.versao)) erros.push('versao inválida');
    if (typeof r.atualizadoEm !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.atualizadoEm)) erros.push('atualizadoEm inválido');
    const p = r.parametros || {};
    for (const k of ['salarioMinimo', 'linhaPobrezaBF', 'bfMinimo', 'bfPorPessoa', 'bfPrimeiraInfancia', 'bfVariavel']) {
      if (typeof p[k] !== 'number' || !(p[k] > 0)) erros.push('parametro ' + k + ' inválido');
    }
    if (typeof p.salarioMinimo === 'number' && (p.salarioMinimo < 1000 || p.salarioMinimo > 10000)) erros.push('salarioMinimo fora do esperado');
    if (!r.canais || typeof r.canais !== 'object') erros.push('canais ausente');
    if (!r.documentos || typeof r.documentos !== 'object') erros.push('documentos ausente');
    else for (const [k, d] of Object.entries(r.documentos)) {
      if (typeof d === 'string') continue;
      if (!d || typeof d.texto !== 'string' || !d.texto.trim()) erros.push('documento ' + k + ': falta texto');
      else if (d.quem !== undefined && !QUEM_DOC.includes(d.quem)) erros.push('documento ' + k + ': quem inválido');
    }
    if (!Array.isArray(r.programas) || r.programas.length < 5) { erros.push('lista de programas ausente ou curta'); return erros; }
    const nomesParam = new Set(Object.keys(p).concat(LIMITES));
    const ids = new Set();
    const checarCond = (c, onde, porMembro) => {
      if (!c || typeof c !== 'object') { erros.push(onde + ': condição vazia'); return; }
      if (c.all || c.any) { const l = c.all || c.any; if (!Array.isArray(l) || !l.length) erros.push(onde + ': all/any vazio'); else l.forEach(x => checarCond(x, onde, porMembro)); return; }
      if (c.not) { checarCond(c.not, onde, porMembro); return; }
      if (typeof c.f !== 'string') { erros.push(onde + ': falta f'); return; }
      if (c.f.startsWith('m.')) {
        if (!porMembro) erros.push(onde + ': usa ' + c.f + ' mas não é porMembro');
        if (!FATOS_MEMBRO.includes(c.f.slice(2))) erros.push(onde + ': fato desconhecido ' + c.f);
      } else if (!FATOS_FAMILIA.includes(c.f)) erros.push(onde + ': fato desconhecido ' + c.f);
      if (c.op !== undefined && !OPS.includes(c.op)) erros.push(onde + ': operador inválido ' + c.op);
      if (c.op && ['<=', '<', '>=', '>'].includes(c.op) && typeof c.v === 'string' && !nomesParam.has(c.v)) erros.push(onde + ': limite desconhecido ' + c.v);
      if (c.op && ['<=', '<', '>=', '>'].includes(c.op) && typeof c.v !== 'string' && typeof c.v !== 'number') erros.push(onde + ': valor de comparação inválido');
    };
    r.programas.forEach((pr, i) => {
      const onde = 'programa ' + (pr && pr.id || '#' + i);
      if (!pr || typeof pr !== 'object') { erros.push(onde + ': inválido'); return; }
      if (!pr.id || ids.has(pr.id)) erros.push(onde + ': id vazio ou repetido'); ids.add(pr.id);
      for (const k of ['titulo', 'resumo']) if (typeof pr[k] !== 'string' || !pr[k].trim()) erros.push(onde + ': falta ' + k);
      if (!['federal', 'estadual', 'municipal'].includes(pr.esfera)) erros.push(onde + ': esfera inválida');
      if (typeof pr.prioridade !== 'number') erros.push(onde + ': falta prioridade');
      checarCond(pr.condicao, onde, pr.porMembro);
      if (pr.condicaoTalvez) checarCond(pr.condicaoTalvez, onde + ' (talvez)', pr.porMembro);
      if (pr.avisoSe) checarCond(pr.avisoSe, onde + ' (aviso)', false);
      if (!Array.isArray(pr.ondeIr) || !pr.ondeIr.length) erros.push(onde + ': falta ondeIr');
      else pr.ondeIr.forEach(c => { if (!r.canais || !r.canais[c]) erros.push(onde + ': canal desconhecido ' + c); });
      if (!Array.isArray(pr.comoPedir) || !pr.comoPedir.length) erros.push(onde + ': falta comoPedir');
      if (!Array.isArray(pr.documentos)) erros.push(onde + ': falta documentos');
      else pr.documentos.forEach(d => { if (!r.documentos || !r.documentos[d]) erros.push(onde + ': documento desconhecido ' + d); });
      if (!pr.fonte || typeof pr.fonte.url !== 'string' || !/^https:\/\//.test(pr.fonte.url)) erros.push(onde + ': fonte sem link https');
      if (pr.calculo && !CALCULOS[pr.calculo]) erros.push(onde + ': cálculo desconhecido ' + pr.calculo);
      if (!pr.valor && !pr.calculo) erros.push(onde + ': falta valor');
      if (typeof pr.porque !== 'string' || !pr.porque.trim()) erros.push(onde + ': falta porque');
      if (!pr.porMembro && /\{(nome|idade)\}/.test((pr.porque || '') + (pr.porqueTalvez || ''))) erros.push(onde + ': porque usa {nome} sem ser porMembro');
    });
    if (!ids.has('cadunico')) erros.push('falta o programa cadunico');
    if (r.municipios && typeof r.municipios === 'object') {
      for (const [cod, m] of Object.entries(r.municipios)) {
        if (!/^31\d{5}$/.test(cod)) erros.push('municipio ' + cod + ': código IBGE de MG inválido');
        if (!m || !Array.isArray(m.extras)) { erros.push('municipio ' + cod + ': falta extras'); continue; }
        if (m.cras !== undefined && (!Array.isArray(m.cras) || m.cras.some(c => !c || typeof c.nome !== 'string' || typeof c.endereco !== 'string'))) erros.push('municipio ' + cod + ': lista de CRAS inválida');
        if (m.fonte !== undefined && !(m.fonte && /^https:\/\//.test(m.fonte.url || ''))) erros.push('municipio ' + cod + ': fonte sem link https');
      }
    }
    return erros;
  }

  return { planoPorLocal, direitosPorPessoa, DOENCAS_GRAVES, DOENCAS_ALTO_CUSTO, FARMACIA_POPULAR, norm, esc, brl, numero, idade, cmpVersao, params, preencher, novaPessoa, familiaVazia, normalizarFamilia, fatos, avaliar, calcular, validarRegras, CALCULOS };
});
