// Telas do aplicativo Meus Direitos MG. O cálculo fica em motor.js e a criptografia em seguranca.js.
(function () {
  'use strict';
  const M = window.Motor, S = window.Seguranca;
  const { esc, brl, numero, idade, norm, cmpVersao, preencher } = M;

  // ---------- Armazenamento (nunca quebra o app) ----------
  let avisoArmazenamento = false;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { if (!avisoArmazenamento) { avisoArmazenamento = true; setTimeout(() => { try { renderFoot(); } catch (e2) {} }, 0); } return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function lerJSON(id) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return null; } }

  const EMBUTIDAS = lerJSON('regras-embutidas');
  const MUNICIPIOS = lerJSON('municipios-mg') || [];
  const CHAVE_PUBLICA = lerJSON('chave-publica');
  const MUN_POR_NOME = new Map(MUNICIPIOS.map(([c, n]) => [norm(n), { codigo: c, nome: n }]));
  const EM_MOLDURA = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  let REGRAS = EMBUTIDAS;
  const P = () => M.params(REGRAS);

  // ---------- Estado ----------
  let F = null;            // dados da família (só na memória enquanto o app está aberto)
  let sessao = null;       // chave de criptografia, se a família usa senha
  let bloqueado = false;
  let pacoteCifrado = null;
  let passo = store.get('md_passo', 0);
  if (!(passo === 'relatorio' || passo === 'documentos' || (Number.isInteger(passo) && passo >= 0 && passo <= 5))) passo = 0;
  let tela = null;         // telas especiais: 'criar-senha', 'trocar-dados'

  (function iniciarDados() {
    const bruto = store.get('md_familia', null);
    if (S.ehCifrado(bruto)) { bloqueado = true; pacoteCifrado = bruto; F = null; }
    else F = M.normalizarFamilia(bruto);
  })();

  let timerSalvar = null;
  function salvar() {
    store.set('md_passo', passo);
    if (!F) return;
    if (sessao) {
      clearTimeout(timerSalvar);
      timerSalvar = setTimeout(async () => { try { const pac = await S.cifrar(F, sessao); pacoteCifrado = pac; store.set('md_familia', pac); } catch (e) {} }, 250);
    } else store.set('md_familia', F);
  }
  function apagarTudo() {
    ['md_familia', 'md_passo'].forEach(k => store.del(k));
    sessao = null; bloqueado = false; pacoteCifrado = null; F = M.familiaVazia(); passo = 0; tela = null;
  }

  // ---------- Utilidades de tela ----------
  function dataBR(iso) { const d = new Date((iso || '') + 'T12:00:00'); return isNaN(d) ? String(iso || '') : d.toLocaleDateString('pt-BR'); }
  function linkSeguro(u) { return /^https:\/\/[^\s"'<>\\]+$/.test(String(u || '')) ? u : ''; }
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 4000); }

  const PARENTESCOS = ['Responsável pela família', 'Esposa / marido / companheiro(a)', 'Filho(a)', 'Enteado(a)', 'Neto(a)', 'Pai / mãe', 'Sogro(a)', 'Irmão / irmã', 'Avô / avó', 'Outro parente', 'Não é parente'];
  const FONTES = [['sem', 'Não tem renda'], ['formal', 'Trabalho com carteira assinada'], ['informal', 'Trabalho sem carteira, bico ou por conta própria'], ['aposentadoria', 'Aposentadoria ou pensão do INSS'], ['bpc', 'Benefício de Prestação Continuada, BPC/LOAS (salário mínimo do INSS para idoso ou pessoa com deficiência)'], ['outro', 'Outra renda (aluguel, ajuda de parente, pensão alimentícia)']];
  const ESTUDOS = [['nao', 'Não estuda'], ['creche', 'Creche ou pré-escola'], ['fundamental', 'Ensino fundamental (1º ao 9º ano)'], ['medio', 'Ensino médio'], ['eja', 'EJA (supletivo)'], ['superior', 'Faculdade ou curso técnico']];
  const SEXOS = [['', 'Escolha'], ['F', 'Feminino'], ['M', 'Masculino'], ['O', 'Outro'], ['N', 'Prefiro não responder']];
  const GRAVES = [['cancer', 'Câncer'], ['hiv', 'HIV / aids'], ['renal', 'Doença nos rins (rim parado, hemodiálise)'], ['coracao', 'Doença grave do coração'], ['hepatite', 'Hepatite ou doença grave do fígado'], ['tuberculose', 'Tuberculose'], ['hanseniase', 'Hanseníase'], ['mental_grave', 'Doença mental grave (esquizofrenia, transtorno bipolar e outras)'], ['alzheimer', 'Alzheimer ou demência'], ['epilepsia', 'Epilepsia (convulsões)'], ['esclerose', 'Esclerose múltipla'], ['cegueira', 'Cegueira'], ['paralisia', 'Paralisia'], ['rara', 'Doença rara ou que precisa de remédio muito caro']];
  const CONTATOS = ['Mãe', 'Pai', 'Esposa / marido / companheiro(a)', 'Filho(a)', 'Irmão / irmã', 'Avô / avó', 'Tio / tia', 'Vizinho(a)', 'Amigo(a)', 'Outro'];
  const DOENCAS = [['pressao', 'Pressão alta'], ['diabetes', 'Diabetes'], ['asma', 'Asma'], ['rinite', 'Rinite'], ['colesterol', 'Colesterol alto'], ['osteoporose', 'Osteoporose'], ['parkinson', 'Parkinson'], ['glaucoma', 'Glaucoma'], ['anticoncepcional', 'Usa anticoncepcional']];

  function exemplo() {
    const y = new Date().getFullYear(); const np = M.novaPessoa;
    return M.normalizarFamilia({
      cidade: 'Itajubá', bairro: 'Centro', rua: 'Rua das Flores', numero: '120', complemento: 'Casa 2', referencia: 'Perto da escola estadual', cep: '37500-000', contato2Nome: 'Rosa', contato2Parentesco: 'Mãe', contato2Tel: '(35) 98888-0000', telefone: '(35) 99999-0000', zona: 'urbana', moradia: 'alugada', agua: 'copasa', luz: 'familia',
      pessoas: [
        Object.assign(np(true), { nome: 'Maria Aparecida (exemplo)', nasc: (y - 38) + '-03-10', sexo: 'F', renda: '800', fonte: 'informal', doencas: ['pressao'] }),
        Object.assign(np(false), { nome: 'Pedro (exemplo)', nasc: (y - 16) + '-07-22', parentesco: 'Filho(a)', sexo: 'M', estudo: 'medio', rede: 'publica' }),
        Object.assign(np(false), { nome: 'Ana Clara (exemplo)', nasc: (y - 4) + '-01-05', parentesco: 'Filho(a)', sexo: 'F', estudo: 'nao' }),
        Object.assign(np(false), { nome: 'José (exemplo)', nasc: (y - 71) + '-01-30', parentesco: 'Pai / mãe', sexo: 'M', incontinencia: true, doencas: ['diabetes'] })
      ],
      saude: { consulta: true, especialista: false, dentista: true, mental: false }, cad: 'velho', bf: 'nao'
    });
  }

  // ---------- Telas ----------
  const PASSOS = ['inicio', 'casa', 'pessoas', 'saude', 'situacao', 'resultado'];
  const view = document.getElementById('view');
  function irPara(i) { passo = Math.max(0, Math.min(PASSOS.length - 1, i)); salvar(); render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} }
  function renderSteps() {
    const el = document.getElementById('steps');
    if (bloqueado || tela || passo === 0 || typeof passo === 'string') { el.innerHTML = ''; return; }
    el.innerHTML = PASSOS.slice(1).map((_, i) => '<span class="' + (i < passo ? 'on' : '') + '"></span>').join('');
  }
  function radio(name, val, label, atual) { return '<label class="choice"><input type="radio" name="' + name + '" value="' + val + '"' + (atual === val ? ' checked' : '') + '><span>' + label + '</span></label>'; }
  function check(id, label, atual, extra) { return '<label class="choice"><input type="checkbox" id="' + id + '" data-k="' + id + '"' + (atual ? ' checked' : '') + '><span>' + label + (extra ? '<br><small class="sub">' + extra + '</small>' : '') + '</span></label>'; }
  function navBtns(voltar, avancar) { return '<div class="btns">' + (voltar ? '<button type="button" data-ir="' + (passo - 1) + '">Voltar</button>' : '') + '<button type="button" class="go" id="avancar">' + (avancar || 'Continuar') + '</button></div>'; }

  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoInstalar = e; if (passo === 0 && !bloqueado) render(); });
  const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const instalado = (function () { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; } catch (e) { return false; } })();

  function telaInicio() {
    const temDados = F.pessoas.some(p => p.nome.trim());
    return '<div class="stack">' +
      '<h1>Descubra os benefícios e direitos da sua família</h1>' +
      '<p class="lead">Responda algumas perguntas sobre quem mora na sua casa. No final você recebe uma lista do que pode pedir, onde ir e quais documentos levar, com um relatório pronto para imprimir.</p>' +
      '<div class="card stack tight"><h3>Como funciona</h3>' +
      '<ol class="plan"><li><span>Conte onde vocês moram.</span></li><li><span>Diga quem mora na casa e quanto cada um ganha.</span></li><li><span>Marque o que a família precisa (saúde, escola, moradia).</span></li><li><span>Veja os direitos e imprima o relatório.</span></li></ol></div>' +
      '<div class="btns"><button type="button" class="go" id="comecar">' + (temDados ? 'Continuar de onde parei' : 'Começar') + '</button>' +
      '<button type="button" id="ver-exemplo">Ver um exemplo pronto</button></div>' +
      (!EM_MOLDURA && !instalado && eventoInstalar ? '<div class="btns"><button type="button" class="sun" id="instalar">Instalar no celular ou computador</button></div>' : '') +
      (!EM_MOLDURA && !instalado && !eventoInstalar && ehIOS ? '<p class="hint">Para instalar no iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>' : '') +
      '<section class="card stack tight" id="seguranca"><h3>Seus dados estão seguros</h3>' +
      '<p>As respostas ficam só neste aparelho. Nada é enviado pela internet.</p>' +
      (sessao ? '<p class="ok">Protegido com senha. Os dados estão guardados com criptografia.</p>'
        : '<p class="sub">Em computador ou celular usado por outras pessoas (CRAS, lan house, parente), crie uma senha ou apague os dados quando terminar.</p>') +
      '<div class="btns">' + (S.disponivel() ? (sessao ? '<button type="button" class="small" id="tirar-senha">Tirar a senha</button><button type="button" class="small" id="bloquear">Bloquear agora</button>' : '<button type="button" class="small" id="criar-senha">Proteger com senha</button>') : '') +
      '<button type="button" class="small danger" id="limpar">Apagar todos os dados</button></div>' +
      '<div id="confirma-limpar" hidden class="stack tight"><p><b>Apagar todos os dados da família deste aparelho?</b> Isso não pode ser desfeito.</p><div class="btns"><button type="button" class="go" id="limpar-sim">Sim, apagar</button><button type="button" id="limpar-nao">Não</button></div></div>' +
      '</section></div>';
  }
  function telaCriarSenha() {
    return '<div class="stack lock"><h2>Proteger com senha</h2>' +
      '<p>Escolha uma senha de pelo menos 6 números ou letras. Sem ela ninguém consegue ver os dados neste aparelho.</p>' +
      '<p class="hint">Guarde bem a senha. Se esquecer, os dados não podem ser recuperados (só apagados).</p>' +
      '<label class="q">Senha<input type="password" id="senha1" class="pin" autocomplete="new-password" inputmode="text" maxlength="64"></label>' +
      '<label class="q">Repita a senha<input type="password" id="senha2" class="pin" autocomplete="new-password" maxlength="64"></label>' +
      '<p class="err" id="erro-senha" hidden></p>' +
      '<div class="btns"><button type="button" class="go" id="salvar-senha">Proteger</button><button type="button" id="cancelar-senha">Cancelar</button></div></div>';
  }
  let tentativas = 0, esperaAte = 0;
  function telaBloqueio() {
    return '<div class="stack lock"><h2>Dados protegidos</h2><p>Digite a senha para ver as informações da família.</p>' +
      '<label class="q">Senha<input type="password" id="senha" class="pin" autocomplete="current-password" maxlength="64"></label>' +
      '<p class="err" id="erro-senha" hidden></p>' +
      '<div class="btns"><button type="button" class="go" id="desbloquear">Abrir</button></div>' +
      '<button type="button" class="link" id="esqueci">Esqueci a senha</button>' +
      '<div id="confirma-limpar" hidden class="card stack tight"><p><b>Sem a senha não é possível abrir os dados.</b> Quer apagar tudo e começar de novo?</p><div class="btns"><button type="button" class="go danger" id="limpar-sim">Apagar e começar de novo</button><button type="button" id="limpar-nao">Não</button></div></div></div>';
  }
  function telaCasa() {
    return '<div class="stack"><h2>1. Onde vocês moram</h2>' +
      '<label class="q">CEP<small>Se souber. Com internet, a rua, o bairro e a cidade aparecem sozinhos (só o CEP é consultado no site ViaCEP).</small><input type="text" id="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" value="' + esc(F.cep) + '" placeholder="00000-000"></label>' +
      '<p class="sub" id="cep-status" role="status" hidden></p>' +
      '<label class="q">Cidade<small>Comece a digitar e escolha na lista</small><input type="text" id="cidade" list="lista-cidades" autocomplete="off" maxlength="80" value="' + esc(F.cidade) + '" placeholder="Ex.: Pouso Alegre"></label>' +
      '<datalist id="lista-cidades">' + MUNICIPIOS.map(m => '<option value="' + esc(m[1]) + '">').join('') + '</datalist>' +
      '<label class="q">Bairro<input type="text" id="bairro" maxlength="80" value="' + esc(F.bairro) + '"></label>' +
      '<label class="q">Rua, avenida ou estrada<input type="text" id="rua" maxlength="120" autocomplete="address-line1" value="' + esc(F.rua) + '"></label>' +
      '<div class="grid2"><label class="q">Número<small>Se não tiver, escreva S/N</small><input type="text" id="numero" maxlength="10" value="' + esc(F.numero) + '"></label>' +
      '<label class="q">Complemento<small>Casa, apartamento, bloco, fundos...</small><input type="text" id="complemento" maxlength="60" value="' + esc(F.complemento) + '"></label></div>' +
      '<label class="q">Ponto de referência<small>Algo perto que ajude a achar a casa. Ex.: perto da escola, em frente à padaria.</small><input type="text" id="referencia" maxlength="120" value="' + esc(F.referencia) + '"></label>' +
      '<label class="q">Seu telefone<input type="tel" id="telefone" maxlength="20" autocomplete="tel" value="' + esc(F.telefone) + '"></label>' +
      '<fieldset class="card stack mid"><legend><b>Outro telefone para recado</b><br><small class="sub">De alguém que sempre consegue falar com você</small></legend>' +
      '<div class="grid2"><label class="q">Nome<input type="text" id="contato2Nome" maxlength="80" value="' + esc(F.contato2Nome) + '"></label>' +
      '<label class="q">Quem é<select id="contato2Parentesco"><option value="">Escolha</option>' + CONTATOS.map(c => '<option' + (F.contato2Parentesco === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label></div>' +
      '<label class="q">Telefone<input type="tel" id="contato2Tel" maxlength="20" value="' + esc(F.contato2Tel) + '"></label></fieldset>' +
      '<fieldset class="card choices"><legend><b>A casa fica</b></legend>' + radio('zona', 'urbana', 'Na cidade', F.zona) + radio('zona', 'rural', 'Na roça (zona rural)', F.zona) + '</fieldset>' +
      '<fieldset class="card choices"><legend><b>A casa é</b></legend>' +
      radio('moradia', 'propria', 'Própria (já paga)', F.moradia) + radio('moradia', 'financiada', 'Própria, ainda pagando', F.moradia) + radio('moradia', 'alugada', 'Alugada', F.moradia) + radio('moradia', 'cedida', 'Emprestada (cedida)', F.moradia) + radio('moradia', 'ocupacao', 'Ocupação', F.moradia) + radio('moradia', 'rua', 'Não tenho casa / moro na rua', F.moradia) + '</fieldset>' +
      '<fieldset class="card choices"><legend><b>De quem é a água?</b><br><small class="sub">Olhe na conta de água</small></legend>' + radio('agua', 'copasa', 'Copasa', F.agua) + radio('agua', 'outra', 'SAAE ou outra empresa', F.agua) + radio('agua', 'naosei', 'Não sei / não tenho conta de água', F.agua) + '</fieldset>' +
      '<fieldset class="card choices"><legend><b>A conta de luz está no nome de quem?</b></legend>' + radio('luz', 'familia', 'De alguém que mora na casa', F.luz) + radio('luz', 'outro', 'De outra pessoa (dono da casa, parente)', F.luz) + radio('luz', 'nao', 'Não tenho conta de luz', F.luz) + '</fieldset>' +
      navBtns(true) + '</div>';
  }
  function cartaoPessoa(p, i) {
    const id = idade(p.nasc); const pre = 'p' + i + '_';
    const sel = (k, opts, atual) => '<select id="' + pre + k + '" data-p="' + i + '" data-k="' + k + '">' + opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (atual === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
    const chk = (k, label) => '<label class="choice"><input type="checkbox" id="' + pre + k + '" data-p="' + i + '" data-k="' + k + '"' + (p[k] ? ' checked' : '') + '><span>' + label + '</span></label>';
    const hoje = new Date().toISOString().slice(0, 10);
    return '<section class="card person stack mid">' +
      '<div class="person-head"><h3>' + (i === 0 ? 'Responsável pela família' : 'Pessoa ' + (i + 1)) + (p.nome ? ': ' + esc(p.nome.split(' ')[0]) : '') + '</h3>' + (i > 0 ? '<button type="button" class="small" data-remover="' + i + '">Tirar esta pessoa</button>' : '') + '</div>' +
      '<label class="q">Nome completo<input type="text" id="' + pre + 'nome" data-p="' + i + '" data-k="nome" maxlength="100" autocomplete="off" value="' + esc(p.nome) + '"></label>' +
      '<div class="grid2"><label class="q">Data de nascimento' + (id != null ? '<small>' + id + ' anos</small>' : '') + '<input type="date" id="' + pre + 'nasc" data-p="' + i + '" data-k="nasc" min="1900-01-01" max="' + hoje + '" value="' + esc(p.nasc) + '"></label>' +
      '<label class="q">Sexo' + sel('sexo', SEXOS, p.sexo) + '</label></div>' +
      (i > 0 ? '<label class="q">O que é do responsável' + sel('parentesco', [['', 'Escolha']].concat(PARENTESCOS.slice(1).map(x => [x, x])), p.parentesco) + '</label>' : '') +
      '<label class="q">De onde vem o dinheiro desta pessoa' + sel('fonte', FONTES, p.fonte) + '</label>' +
      '<details class="ajuda"><summary>O que é cada uma?</summary><ul class="sub">' +
      '<li><b>Aposentadoria ou pensão do INSS:</b> benefício de quem pagou o INSS (trabalhou com carteira ou contribuiu), ou pensão deixada por alguém que morreu.</li>' +
      '<li><b>Benefício de Prestação Continuada (BPC/LOAS):</b> um salário mínimo pago todo mês pelo INSS para pessoa com 65 anos ou mais, ou pessoa com deficiência, de família pobre, mesmo sem nunca ter pago o INSS. Não tem 13º salário.</li>' +
      '<li><b>Bico ou por conta própria:</b> faxina, venda, obra, roça, aplicativo, qualquer trabalho sem carteira assinada.</li></ul></details>' +
      '<div class="grid2"><label class="q">Quanto ganha por mês, antes dos descontos (R$)<small>É o valor bruto: o salário antes de tirar INSS, vale-transporte e outros descontos (no contracheque aparece como "total de vencimentos"). Se o valor muda, coloque a média. Não conte o Bolsa Família.</small><input type="text" inputmode="decimal" maxlength="12" id="' + pre + 'renda" data-p="' + i + '" data-k="renda" value="' + esc(p.renda) + '" placeholder="0"' + (p.fonte === 'sem' ? ' disabled' : '') + '></label></div>' +
      '<div class="grid2"><label class="q">Estuda?' + sel('estudo', ESTUDOS, p.estudo) + '</label>' +
      (p.estudo !== 'nao' ? '<label class="q">Escola' + sel('rede', [['publica', 'Pública (do governo)'], ['particular', 'Particular']], p.rede) + '</label>' : '') + '</div>' +
      '<div class="choices">' + chk('pcd', 'Tem alguma deficiência ou doença que impede de trabalhar ou estudar por muito tempo') +
      (p.sexo !== 'M' ? chk('gestante', 'Está grávida') + chk('nutriz', 'Está amamentando bebê de até 6 meses') : '') +
      chk('demitido', 'Foi mandado embora de trabalho com carteira nos últimos 4 meses') + '</div>' +
      '<details class="more"' + (p.doencas.length || p.incontinencia || p.semDocumento || p.cpf || p.medioCompleto ? ' open' : '') + '><summary>Saúde, doenças e documentos</summary><div class="stack mid mt">' +
      '<p><b>Usa remédio todo mês para:</b></p><div class="choices dz">' + DOENCAS.map(([k, l]) => '<label class="choice"><input type="checkbox" id="' + pre + 'd_' + k + '" data-p="' + i + '" data-doenca="' + k + '"' + (p.doencas.includes(k) ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>' +
      '<p><b>Tem alguma destas doenças?</b><br><small class="sub">Algumas dão direito a remédios caros de graça, prazo para tratamento e outros benefícios.</small></p><div class="choices dz">' + GRAVES.map(([k, l]) => '<label class="choice"><input type="checkbox" id="' + pre + 'd_' + k + '" data-p="' + i + '" data-doenca="' + k + '"' + (p.doencas.includes(k) ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>' +
      '<div class="choices">' + chk('incontinencia', 'Precisa usar fralda (perde urina ou fezes)') + chk('semDocumento', 'Está sem algum documento (certidão, identidade ou CPF)') + chk('medioCompleto', 'Já terminou o ensino médio') + '</div>' +
      '<div class="grid2"><label class="q">CPF<small>Opcional. Vai no relatório.</small><input type="text" inputmode="numeric" maxlength="14" autocomplete="off" id="' + pre + 'cpf" data-p="' + i + '" data-k="cpf" value="' + esc(p.cpf) + '"></label>' +
      '<label class="q">NIS<small>Opcional. Número do CadÚnico.</small><input type="text" inputmode="numeric" maxlength="14" autocomplete="off" id="' + pre + 'nis" data-p="' + i + '" data-k="nis" value="' + esc(p.nis) + '"></label></div>' +
      '</div></details></section>';
  }
  function telaPessoas() {
    return '<div class="stack"><h2>2. Quem mora na casa</h2>' +
      '<p class="lead">Coloque todas as pessoas que moram com você e dividem as despesas, inclusive bebês.</p>' +
      F.pessoas.map(cartaoPessoa).join('') +
      (F.pessoas.length < 20 ? '<button type="button" class="sun" id="add-pessoa">+ Adicionar outra pessoa</button>' : '') +
      '<p id="erro-pessoas" class="err" role="alert" hidden></p>' + navBtns(true) + '</div>';
  }
  function telaSaude() {
    const s = F.saude;
    return '<div class="stack"><h2>3. Saúde</h2><p class="lead">Marque o que alguém da casa precisa agora.</p>' +
      '<div class="choices">' + check('consulta', 'Consulta médica ou exame', s.consulta) + check('especialista', 'Médico especialista, cirurgia ou tratamento que não tem na cidade', s.especialista) + check('dentista', 'Dentista ou dentadura', s.dentista) + check('mental', 'Ajuda para tristeza, ansiedade, crises, álcool ou drogas', s.mental) + '</div>' +
      navBtns(true) + '</div>';
  }
  function telaSituacao() {
    const t = F.sit;
    return '<div class="stack"><h2>4. Situação da família</h2>' +
      '<fieldset class="card choices"><legend><b>A família está no Cadastro Único (CadÚnico)?</b><br><small class="sub">É o cadastro feito no CRAS. Quem recebe Bolsa Família está nele.</small></legend>' +
      radio('cad', 'sim', 'Sim, atualizado nos últimos 2 anos', F.cad) + radio('cad', 'velho', 'Sim, mas faz mais de 2 anos', F.cad) + radio('cad', 'nao', 'Não', F.cad) + radio('cad', 'naosei', 'Não sei', F.cad) + '</fieldset>' +
      '<fieldset class="card choices"><legend><b>A família recebe Bolsa Família hoje?</b></legend>' + radio('bf', 'sim', 'Sim', F.bf) + radio('bf', 'nao', 'Não', F.bf) + '</fieldset>' +
      '<p><b>Marque se alguma coisa abaixo acontece com a família:</b></p><div class="choices">' +
      check('agricultor', 'Trabalha na roça como agricultor familiar', t.agricultor) + check('pescador', 'É pescador artesanal', t.pescador) + check('indigena', 'É indígena ou quilombola', t.indigena) +
      check('emergencia', 'Passa por emergência: falta comida, despejo, morte na família ou desastre (enchente, deslizamento)', t.emergencia) +
      check('justica', 'Precisa de ajuda na Justiça (pensão, guarda, despejo, benefício negado)', t.justica) +
      check('violencia', 'Alguém sofre violência em casa', t.violencia, 'Se for perigo agora, ligue 190.') +
      '</div>' + navBtns(true, 'Ver meus direitos') + '</div>';
  }

  const nomeCanal = c => (REGRAS.canais[c] || {}).nome || c;
  const curto = c => nomeCanal(c).split(' (')[0];
  const plano = calc => M.planoPorLocal(calc, REGRAS);
  function dadosCidade() {
    const cidade = MUN_POR_NOME.get(norm(F.cidade));
    return (cidade && REGRAS.municipios && REGRAS.municipios[cidade.codigo]) || null;
  }
  function extrasCidade() { const m = dadosCidade(); return m && Array.isArray(m.extras) ? m.extras : []; }
  function crasCidade() { const m = dadosCidade(); return m && Array.isArray(m.cras) ? m.cras : []; }
  function htmlCras(classe) {
    const m = dadosCidade(), lista = crasCidade(); if (!lista.length) return '';
    return '<div class="' + classe + '" id="cras-cidade"><b>CRAS em ' + esc(F.cidade) + ':</b><ul>' + lista.map(c => '<li><b>' + esc(c.nome) + '</b>: ' + esc(c.endereco) + (c.telefone ? ' · Tel. ' + esc(c.telefone) : '') + '</li>').join('') + '</ul>' +
      '<small>' + esc(m.aviso || '') + ' Fonte: ' + esc(m.fonte ? m.fonte.nome : '') + ', conferido em ' + dataBR(m.verificadoEm) + '.</small></div>';
  }
  function htmlMotivos(r) {
    return '<div class="porque"><b>Por quê:</b><ul>' + r.motivos.map(m => '<li>' + esc(m.texto) + '</li>').join('') + '</ul></div>';
  }
  function cartaoPrograma(r) {
    const pr = r.pr, p = P(); const esf = { federal: 'Brasil', estadual: 'Minas Gerais', municipal: 'Prefeitura' }[pr.esfera] || pr.esfera;
    const url = linkSeguro(pr.fonte.url);
    return '<article class="prog ' + r.status + '" data-programa="' + esc(pr.id) + '">' +
      '<div class="tags"><span class="tag ' + r.status + '">' + (r.status === 'sim' ? 'Provável direito' : 'Pode ter direito') + '</span><span class="tag">' + esc(esf) + '</span>' + (r.precisaCad ? '<span class="tag cad">Precisa do CadÚnico</span>' : '') + '</div>' +
      '<h3>' + esc(pr.titulo) + '</h3><p>' + esc(preencher(pr.resumo, p)) + '</p>' +
      (r.quem.length ? '<p class="who">Para: ' + esc(r.quem.join(', ')) + '</p>' : '') +
      htmlMotivos(r) +
      (r.valor ? '<p class="valor">' + esc(r.valor) + '</p>' : '') +
      (r.nota ? '<p class="hint">' + esc(r.nota) + '</p>' : '') +
      r.avisos.map(a => '<p class="hint">' + esc(a) + '</p>').join('') +
      '<details><summary>Como pedir</summary><ol>' + pr.comoPedir.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
      '<p class="who mt">Onde: ' + pr.ondeIr.map(c => esc(nomeCanal(c))).join(' · ') + '</p>' +
      '<p class="who">Fonte: ' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(pr.fonte.nome) + '</a>' : esc(pr.fonte.nome)) + ' · ' + esc(pr.baseLegal || '') + '</p></details></article>';
  }
  function htmlQuemTemDireito(calc, classe) {
    const { pessoas, familia } = M.direitosPorPessoa(calc);
    const item = i => '<li><b>' + esc(i.titulo) + '</b>' + (i.status === 'talvez' ? ' <span class="tag talvez">confirmar</span>' : '') + '<br><span class="sub">' + esc(i.motivo) + '</span></li>';
    return '<div class="' + classe + '" id="quem-tem-direito">' +
      pessoas.map(p => '<div class="pessoa-direitos"><h3>' + esc(p.nome) + (p.idade !== null ? ' (' + p.idade + ' anos)' : '') + '</h3>' +
        (p.itens.length ? '<ul>' + p.itens.map(item).join('') + '</ul>' : '<p class="sub">Nenhum programa só desta pessoa. Ela entra nos programas da família abaixo.</p>') + '</div>').join('') +
      (familia.length ? '<div class="pessoa-direitos"><h3>Família toda</h3><ul>' + familia.map(item).join('') + '</ul></div>' : '') + '</div>';
  }
  function telaResultado() {
    const calc = M.calcular(F, REGRAS); const { fx, res } = calc;
    const sims = res.filter(r => r.status === 'sim'), talvez = res.filter(r => r.status === 'talvez');
    const mensal = sims.reduce((s, r) => s + (r.mensal || 0), 0);
    const pl = plano(calc);
    return '<div class="stack"><h2>Direitos da sua família</h2>' +
      '<div class="summary-band">' +
      '<div class="stat"><b id="n-sim">' + sims.length + '</b><span>direitos prováveis</span></div>' +
      '<div class="stat"><b id="n-talvez">' + talvez.length + '</b><span>para confirmar</span></div>' +
      '<div class="stat"><b id="rpc">' + brl(fx.rpc) + '</b><span>renda por pessoa</span></div>' +
      (mensal ? '<div class="stat"><b id="mensal">' + brl(mensal) + '</b><span>dinheiro por mês (estimativa)</span></div>' : '') +
      '</div>' +
      '<div class="btns noprint"><button type="button" class="go" id="abrir-documentos">Documentos e cartas</button><button type="button" class="sun" id="abrir-relatorio">Relatório completo para imprimir</button><button type="button" data-ir="1">Corrigir respostas</button></div>' +
      '<section class="card stack tight"><h3>Seu plano: onde ir, nesta ordem</h3><ol class="plan">' +
      pl.map(g => '<li><div><b>' + esc(nomeCanal(g.canal)) + '</b><br><span class="who">Pedir: ' + esc(g.programas.map(r => r.pr.titulo.split(' (')[0]).join('; ')) + '</span></div></li>').join('') +
      '</ol></section>' +
      htmlCras('hint') +
      extrasCidade().map(e => '<div class="hint"><b>' + esc(e.titulo) + '</b><br>' + esc(e.texto) + '</div>').join('') +
      '<details class="card"><summary class="toggle">Quem da família tem direito a quê, e por quê</summary>' + htmlQuemTemDireito(calc, 'stack mid mt') + '</details>' +
      (sims.length ? '<h3>Provável direito</h3>' + sims.map(cartaoPrograma).join('') : '<p>Com as respostas dadas, não encontramos direito provável. Veja os itens para confirmar abaixo e procure o CRAS.</p>') +
      (talvez.length ? '<h3>Pode ter direito: vale perguntar</h3>' + talvez.map(cartaoPrograma).join('') : '') +
      '<p class="who">Este resultado é uma estimativa feita com as regras de ' + dataBR(REGRAS.atualizadoEm) + '. Quem decide é o órgão responsável.</p>' +
      '<div class="btns noprint"><button type="button" class="small danger" id="terminar">Terminei: apagar os dados deste aparelho</button></div></div>';
  }
  function enderecoCompleto() {
    const ruaNum = [F.rua || F.endereco, F.numero].filter(Boolean).join(', ');
    return [ruaNum, F.complemento, F.bairro, F.cidade ? F.cidade + ' - MG' : '', F.cep ? 'CEP ' + F.cep : ''].filter(Boolean).join(', ');
  }
  const ROTULO_FONTE = f => ((FONTES.find(e => e[0] === f) || [])[1] || '').split(' (')[0].toLowerCase();
  function linhaPessoa(x, i) {
    const id = idade(x.nasc);
    const partes = [x.nome + (id !== null ? ', ' + id + ' anos' : '') + (i === 0 ? ' (responsável)' : x.parentesco ? ' (' + x.parentesco.toLowerCase() + ')' : '')];
    const fonte = x.fonte && x.fonte !== 'sem' ? ROTULO_FONTE(x.fonte) + ', ' + brl(numero(x.renda)) + ' por mês' : 'sem renda';
    partes.push(fonte);
    if (x.estudo && x.estudo !== 'nao') partes.push('estuda: ' + ((ESTUDOS.find(e => e[0] === x.estudo) || [])[1] || '').toLowerCase() + (x.rede === 'publica' ? ' em escola pública' : ''));
    if (x.pcd) partes.push('tem deficiência ou doença de longo prazo');
    if (x.gestante) partes.push('está grávida');
    if (x.nutriz) partes.push('amamenta bebê de até 6 meses');
    if (x.demitido) partes.push('foi demitido(a) recentemente');
    if (x.doencas.length) partes.push('saúde: ' + x.doencas.map(d => ((DOENCAS.concat(GRAVES).find(z => z[0] === d) || [, d])[1]).toLowerCase()).join(', '));
    if (x.incontinencia) partes.push('usa fralda');
    if (x.semDocumento) partes.push('está sem algum documento');
    return partes.join('; ');
  }
  const MORADIA = { propria: 'casa própria quitada', financiada: 'casa própria ainda sendo paga', alugada: 'casa alugada', cedida: 'casa emprestada (cedida)', ocupacao: 'ocupação', rua: 'sem moradia / situação de rua' };
  // Carta de cada local: explica a situação, pede a verificação e lista os documentos.
  function cartaLocal(g, calc) {
    const { fx } = calc; const c = REGRAS.canais[g.canal] || {};
    const resp = F.pessoas[0] || {}; const hoje = new Date().toLocaleDateString('pt-BR');
    const t = F.sit || {};
    const outras = [t.violencia ? 'há situação de violência em casa' : '', t.emergencia ? 'a família passa por uma emergência (falta de comida, despejo, morte ou desastre)' : '', t.agricultor ? 'trabalhamos na agricultura familiar' : '', t.pescador ? 'há pescador artesanal na família' : '', t.indigena ? 'somos família indígena ou quilombola' : '', t.justica ? 'precisamos de ajuda na Justiça' : ''].filter(Boolean);
    const docs = g.itens.map(i => '- ' + i.texto + (i.pessoas ? ': ' + i.pessoas.map(p => p.nome).join(', ') : ''));
    return 'Ao(À) ' + (c.nome || g.canal) + (F.cidade ? ' de ' + F.cidade + '/MG' : '') + '\n' +
      'Assunto: Pedido de verificação de direitos da família de ' + (resp.nome || '__________') + '\n\n' +
      'Prezados(as),\n\n' +
      'Eu, ' + (resp.nome || '________________________') + (resp.cpf ? ', CPF ' + resp.cpf : '') + (resp.nis ? ', NIS ' + resp.nis : '') + ', moro em ' + (enderecoCompleto() || '________________________') + (F.referencia ? ' (ponto de referência: ' + F.referencia + ')' : '') + '. Meu telefone é ' + (F.telefone || '______________') + (F.contato2Tel ? ' e o telefone para recado é ' + F.contato2Tel + (F.contato2Nome ? ' (' + F.contato2Nome + (F.contato2Parentesco ? ', ' + F.contato2Parentesco.toLowerCase() : '') + ')' : '') : '') + '.\n\n' +
      'SITUAÇÃO DA FAMÍLIA\n' +
      'Somos ' + fx.n + ' pessoa(s) morando juntas:\n' + F.pessoas.map((x, i) => '- ' + linhaPessoa(x, i)).join('\n') + '\n' +
      'Renda total da família: ' + brl(fx.rendaTotal) + ' por mês (' + brl(fx.rpc) + ' por pessoa), valores brutos.\n' +
      'Moradia: ' + (MORADIA[F.moradia] || 'não informada') + ', ' + (F.zona === 'rural' ? 'zona rural' : 'zona urbana') + '.\n' +
      'CadÚnico: ' + ({ sim: 'cadastro atualizado nos últimos 2 anos', velho: 'cadastro com mais de 2 anos, precisa atualizar', nao: 'ainda não temos cadastro', naosei: 'não sabemos se temos cadastro' }[F.cad] || 'não informado') + '. Bolsa Família: ' + (F.bf === 'sim' ? 'recebemos' : 'não recebemos') + '.\n' +
      (outras.length ? 'Também informo que ' + outras.join('; ') + '.\n' : '') + '\n' +
      'PEDIDO\n' +
      'Peço a verificação dos requisitos e, se tivermos direito, a inscrição, atualização ou concessão de:\n' +
      g.programas.map((r, k) => (k + 1) + '. ' + r.pr.titulo + (r.status === 'talvez' ? ' (peço avaliação do caso)' : '') + '\n   Motivo: ' + r.motivos.map(m => m.texto).join(' ')).join('\n') + '\n\n' +
      (docs.length ? 'DOCUMENTOS QUE APRESENTO\n' + docs.join('\n') + '\n\n' : '') +
      'Fico à disposição para entrevista, visita domiciliar ou para apresentar outros documentos, se necessário. Peço que me informem o número do protocolo deste pedido.\n\n' +
      (F.cidade || '__________') + ', ' + hoje + '.\n\n\n' +
      '______________________________\n' + (resp.nome || 'Assinatura do(a) responsável');
  }
  const EMAIL_OK = /^[^\s@<>"'(),;:]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/;
  function linkEmail(email, carta) {
    const para = EMAIL_OK.test(email) ? email : '';
    const assunto = 'Pedido de verificação de direitos - ' + ((F.pessoas[0] || {}).nome || '');
    return 'mailto:' + para + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(carta + '\n\n(Seguem em anexo as fotos dos documentos.)');
  }
  function chaveDoc(g, k, p) { return g.canal + '|' + g.itens[k].id + '|' + (p ? p.indice : 'casa'); }
  function telaDocumentos() {
    const calc = M.calcular(F, REGRAS);
    const pl = plano(calc);
    return '<div class="stack">' +
      '<div class="btns noprint"><button type="button" data-ir="5">Voltar ao resultado</button>' + (EM_MOLDURA ? '' : '<button type="button" class="go" id="imprimir">Imprimir tudo</button>') + '</div>' +
      '<h2>Documentos e cartas</h2>' +
      '<p class="lead">Para cada lugar: a lista do que levar (marque o que você já separou) e uma carta pronta explicando a situação da família e pedindo a verificação. Você pode imprimir a carta para entregar com os documentos ou enviar por e-mail.</p>' +
      (EM_MOLDURA ? '<p class="hint noprint">Nesta prévia os botões de imprimir e de e-mail podem não funcionar. No aplicativo instalado eles funcionam.</p>' : '') +
      pl.map((g, i) => {
        const c = REGRAS.canais[g.canal] || {};
        const total = g.itens.reduce((s, it) => s + (it.pessoas ? it.pessoas.length : 1), 0);
        const feitos = g.itens.reduce((s, it, k) => s + (it.pessoas ? it.pessoas.filter(p => F.docsOk[chaveDoc(g, k, p)]).length : (F.docsOk[chaveDoc(g, k, null)] ? 1 : 0)), 0);
        const carta = cartaLocal(g, calc);
        const email = (F.emails && F.emails[g.canal]) || '';
        const mailto = linkEmail(email, carta);
        return '<section class="card stack mid local" id="local-' + esc(g.canal) + '" data-canal="' + esc(g.canal) + '">' +
          '<h3>Passo ' + (i + 1) + ': ' + esc(c.nome || g.canal) + '</h3>' +
          '<p class="sub">' + esc(c.como || '') + (c.telefone ? '<br>Telefone: ' + esc(c.telefone) : '') + (c.site ? '<br>Site: ' + esc(c.site) : '') + '</p>' +
          (g.canal === 'cras' ? htmlCras('hint') : '') +
          '<div><b>O que pedir aqui</b><ul>' + g.programas.map(r => '<li>' + esc(r.pr.titulo) + (r.status === 'talvez' ? ' <span class="tag talvez">confirmar</span>' : '') + (r.pr.ondeIr.length > 1 ? ' <span class="sub">(depois: ' + esc(r.pr.ondeIr.slice(1).map(curto).join(', ')) + ')</span>' : '') + '</li>').join('') + '</ul></div>' +
          (g.itens.length ? '<div class="checklist"><b>Documentos para levar</b> <span class="sub conta-docs">' + feitos + ' de ' + total + ' separados</span>' +
            g.itens.map((it, k) => '<div class="doc-item"><p><b>' + esc(it.texto) + '</b><br><span class="sub">Para: ' + esc(it.para.join(', ')) + '</span>' + (it.obs ? '<br><span class="sub">' + esc(it.obs) + '</span>' : '') + '</p>' +
              (it.pessoas ? it.pessoas.map(p => { const ch = chaveDoc(g, k, p); return '<label class="choice"><input type="checkbox" data-doc="' + esc(ch) + '"' + (F.docsOk[ch] ? ' checked' : '') + '><span>' + esc(p.nome) + '</span></label>'; }).join('')
                : (() => { const ch = chaveDoc(g, k, null); return '<label class="choice"><input type="checkbox" data-doc="' + esc(ch) + '"' + (F.docsOk[ch] ? ' checked' : '') + '><span>Separado</span></label>'; })()) +
              '</div>').join('') + '</div>' : '<p class="sub">Não precisa levar documentos para este atendimento.</p>') +
          '<details class="carta-bloco"' + (i === 0 ? ' open' : '') + '><summary class="toggle">Carta para ' + esc(curto(g.canal)) + '</summary>' +
          '<pre class="carta" data-carta="' + esc(g.canal) + '">' + esc(carta) + '</pre>' +
          '<div class="btns noprint">' + (EM_MOLDURA ? '' : '<button type="button" class="small go" data-imprimir="' + esc(g.canal) + '">Imprimir carta e lista</button>') +
          '<button type="button" class="small" data-copiar="' + esc(g.canal) + '">Copiar a carta</button></div>' +
          '<div class="stack tight noprint"><label class="q">E-mail do ' + esc(curto(g.canal)) + '<small>Se o atendimento aceitar pedido por e-mail. Pergunte o endereço no telefone acima.</small><input type="email" data-email="' + esc(g.canal) + '" maxlength="120" autocomplete="off" value="' + esc(email) + '" placeholder="atendimento@exemplo.gov.br"></label>' +
          '<p><a class="botao-link" data-mailto="' + esc(g.canal) + '" href="' + esc(mailto) + '">Abrir no meu e-mail</a></p>' +
          '<p class="sub">A carta abre no seu programa de e-mail, enviada pela sua conta. Anexe fotos legíveis dos documentos antes de enviar. O aplicativo não envia nada sozinho.</p></div>' +
          '</details></section>';
      }).join('') + '</div>';
  }
  function telaRelatorio() {
    const calc = M.calcular(F, REGRAS); const { fx, res } = calc; const p = P();
    const pl = plano(calc);
    const resp = F.pessoas[0] || {};
    const hoje = new Date().toLocaleDateString('pt-BR');
    const endereco = enderecoCompleto();
    const linhas = F.pessoas.map((x, i) => {
      const id = idade(x.nasc); const est = (ESTUDOS.find(e => e[0] === x.estudo) || [])[1] || ''; const fonte = (FONTES.find(e => e[0] === x.fonte) || [])[1] || '';
      const sit = [x.pcd ? 'Pessoa com deficiência' : '', x.gestante ? 'Gestante' : '', x.nutriz ? 'Amamentando' : '', x.demitido ? 'Demitido(a) recentemente' : '', x.doencas.length ? 'Saúde: ' + x.doencas.map(d => (DOENCAS.concat(GRAVES).find(z => z[0] === d) || [, d])[1]).join(', ') : '', x.incontinencia ? 'Usa fralda' : ''].filter(Boolean).join('; ');
      return '<tr><td>' + esc(x.nome) + '</td><td>' + (i === 0 ? 'Responsável' : esc(x.parentesco)) + '</td><td>' + (x.nasc ? esc(dataBR(x.nasc)) + (id != null ? ' (' + id + ')' : '') : '') + '</td><td>' + esc(x.cpf) + '</td><td>' + esc(x.nis) + '</td><td>' + esc(fonte.split(' (')[0]) + (x.fonte !== 'sem' ? '<br>' + brl(numero(x.renda)) : '') + '</td><td>' + esc(est) + (x.estudo !== 'nao' ? ' (' + (x.rede === 'publica' ? 'pública' : 'particular') + ')' : '') + '</td><td>' + esc(sit) + '</td></tr>';
    }).join('');
    return '<div class="stack">' +
      '<div class="btns noprint">' + (EM_MOLDURA ? '' : '<button type="button" class="go" id="imprimir">Imprimir relatório</button>') + '<button type="button" data-ir="5">Voltar ao resultado</button></div>' +
      (EM_MOLDURA ? '<p class="hint noprint">Nesta prévia o botão de imprimir fica desligado. No aplicativo instalado no celular ou computador, o botão "Imprimir relatório" aparece aqui.</p>' : '') +
      '<article class="doc" id="relatorio"><h1>Relatório de direitos da família</h1>' +
      '<p class="meta">Feito em ' + hoje + ' com o aplicativo Meus Direitos MG · Regras versão ' + esc(REGRAS.versao) + ' (' + dataBR(REGRAS.atualizadoEm) + ') · Salário mínimo usado: ' + brl(p.salarioMinimo) + '</p>' +
      '<h2>1. Dados da família</h2>' +
      '<p><b>Responsável:</b> ' + esc(resp.nome) + ' &nbsp; <b>Telefone:</b> ' + esc(F.telefone) +
      (F.contato2Tel ? '<br><b>Telefone para recado:</b> ' + esc(F.contato2Tel) + (F.contato2Nome ? ' (' + esc(F.contato2Nome) + (F.contato2Parentesco ? ', ' + esc(F.contato2Parentesco.toLowerCase()) : '') + ')' : '') : '') +
      '<br><b>Endereço:</b> ' + esc(endereco) + ' (' + (F.zona === 'rural' ? 'zona rural' : 'zona urbana') + ')' +
      (F.referencia ? '<br><b>Ponto de referência:</b> ' + esc(F.referencia) : '') + '<br>' +
      '<b>Pessoas na casa:</b> ' + fx.n + ' &nbsp; <b>Renda total (bruta):</b> <span id="rel-renda">' + brl(fx.rendaTotal) + '</span> &nbsp; <b>Renda por pessoa:</b> <span id="rel-rpc">' + brl(fx.rpc) + '</span><br>' +
      '<b>CadÚnico:</b> ' + ({ sim: 'Sim, atualizado', velho: 'Sim, precisa atualizar', nao: 'Não', naosei: 'Não sabe' }[F.cad] || 'Não informado') + ' &nbsp; <b>Bolsa Família:</b> ' + (F.bf === 'sim' ? 'Recebe' : 'Não recebe') + '</p>' +
      '<div class="tw"><table><thead><tr><th>Nome</th><th>Parentesco</th><th>Nascimento</th><th>CPF</th><th>NIS</th><th>Renda</th><th>Estudo</th><th>Situação</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '<h2>2. Quem tem direito a quê, e por quê</h2>' + htmlQuemTemDireito(calc, 'quem') +
      '<h2>3. Onde ir, documentos e cartas</h2>' +
      pl.map((g, i) => {
        const c = REGRAS.canais[g.canal] || {};
        return '<div class="box" data-canal="' + esc(g.canal) + '"><h3>Passo ' + (i + 1) + ': ' + esc(c.nome) + '</h3>' +
          '<p>' + esc(c.como) + (c.telefone ? '<br><b>Telefone:</b> ' + esc(c.telefone) : '') + (c.site ? '<br><b>Site:</b> ' + esc(c.site) : '') + '</p>' +
          (g.canal === 'cras' ? htmlCras('p6') : '') +
          '<p class="p6"><b>Pedir:</b></p><ul class="chk">' + g.programas.map(r => '<li>' + esc(r.pr.titulo) + (r.status === 'talvez' ? ' (confirmar)' : '') + (r.quem.length ? ' — ' + esc(r.quem.join(', ')) : '') + (r.pr.ondeIr.length > 1 ? ' <i>(depois: ' + esc(r.pr.ondeIr.slice(1).map(curto).join(', ')) + ')</i>' : '') + '</li>').join('') + '</ul>' +
          (g.itens.length ? '<p><b>Levar:</b></p><ul class="chk">' + g.itens.map(it => '<li>' + esc(it.texto) + (it.pessoas ? ' — ' + esc(it.pessoas.map(x => x.nome).join(', ')) : '') + '</li>').join('') + '</ul>' : '') +
          '<p><b>Carta (pode entregar junto com os documentos):</b></p><div class="carta">' + esc(cartaLocal(g, calc)) + '</div></div>';
      }).join('') +
      '<h2>4. Detalhe de cada direito</h2>' +
      res.map(r => '<div class="box"><h3>' + esc(r.pr.titulo) + ' — ' + (r.status === 'sim' ? 'provável direito' : 'pode ter direito') + '</h3><p>' + esc(preencher(r.pr.resumo, p)) + '</p>' + '<p><b>Por quê:</b> ' + esc(r.motivos.map(m => m.texto).join(' ')) + '</p>' + (r.valor ? '<p><b>Valor:</b> ' + esc(r.valor) + '</p>' : '') + (r.nota ? '<p><i>' + esc(r.nota) + '</i></p>' : '') + r.avisos.map(a => '<p><i>' + esc(a) + '</i></p>').join('') + '<p><b>Como pedir:</b> ' + esc(r.pr.comoPedir.join(' ')) + '</p><p class="meta">Base legal: ' + esc(r.pr.baseLegal || '') + ' · Fonte: ' + esc(r.pr.fonte.nome) + ' (' + esc(r.pr.fonte.url) + ') · Conferido em ' + dataBR(r.pr.verificadoEm) + '</p></div>').join('') +
      '<h2>5. Declaração</h2><p>Declaro que as informações acima são verdadeiras. Sei que este relatório é uma estimativa e que cada órgão confere os dados e decide sobre o benefício. Nenhum atendimento público pode cobrar para fazer o cadastro ou liberar benefício.</p>' +
      '<div class="assin"><div>Assinatura do(a) responsável</div><div>Atendente / órgão (carimbo)</div></div></article></div>';
  }

  // Busca a rua pelo CEP no ViaCEP (só com internet; só o CEP é enviado).
  let cepPedido = 0;
  async function buscarCep(dig) {
    const st = document.getElementById('cep-status');
    const msg = t => { if (st) { st.textContent = t; st.hidden = !t; } };
    if (!navigator.onLine) { msg('Sem internet: preencha a rua, o bairro e a cidade à mão.'); return; }
    const meu = ++cepPedido;
    msg('Procurando o CEP...');
    try {
      const txt = await baixarTexto('https://viacep.com.br/ws/' + dig + '/json/', 8000, true);
      if (meu !== cepPedido) return;
      const r = JSON.parse(txt);
      if (!r || typeof r !== 'object' || r.erro) { msg('CEP não encontrado. Confira os números ou preencha à mão.'); return; }
      const txtOk = v => typeof v === 'string' ? v.slice(0, 120) : '';
      if (txtOk(r.uf) !== 'MG') { msg('Este CEP é de outro estado (' + txtOk(r.uf).slice(0, 2) + '). Confira os números.'); return; }
      const mun = MUN_POR_NOME.get(norm(txtOk(r.localidade)));
      if (mun) F.cidade = mun.nome;
      if (txtOk(r.bairro)) F.bairro = txtOk(r.bairro);
      if (txtOk(r.logradouro)) F.rua = txtOk(r.logradouro);
      salvar();
      if (PASSOS[passo] === 'casa' && !tela && !bloqueado) {
        render();
        const s2 = document.getElementById('cep-status'); if (s2) { s2.textContent = 'Endereço encontrado. Confira e coloque o número.'; s2.hidden = false; }
        const n = document.getElementById(txtOk(r.logradouro) ? 'numero' : 'rua'); if (n) n.focus();
      }
    } catch (e) { if (meu === cepPedido) msg('Não foi possível procurar o CEP agora. Preencha à mão.'); }
  }

  function render() {
    renderSteps();
    let html;
    if (bloqueado) html = telaBloqueio();
    else if (tela === 'criar-senha') html = telaCriarSenha();
    else {
      const t = typeof passo === 'string' ? passo : PASSOS[passo];
      html = { inicio: telaInicio, casa: telaCasa, pessoas: telaPessoas, saude: telaSaude, situacao: telaSituacao, resultado: telaResultado, relatorio: telaRelatorio, documentos: telaDocumentos }[t]();
    }
    view.innerHTML = html;
    renderFoot();
    const foco = bloqueado ? document.getElementById('senha') : (tela === 'criar-senha' ? document.getElementById('senha1') : null);
    if (foco) foco.focus();
  }

  // ---------- Eventos ----------
  view.addEventListener('input', e => {
    if (!F || bloqueado) return;
    const el = e.target;
    if (el.dataset.p !== undefined) {
      const p = F.pessoas[+el.dataset.p]; if (!p) return;
      if (el.dataset.doenca) { const s = new Set(p.doencas); el.checked ? s.add(el.dataset.doenca) : s.delete(el.dataset.doenca); p.doencas = [...s]; }
      else if (el.type === 'checkbox') p[el.dataset.k] = el.checked;
      else p[el.dataset.k] = String(el.value).slice(0, 120);
      if (el.tagName === 'SELECT' && ['fonte', 'estudo', 'sexo'].includes(el.dataset.k)) {
        if (el.dataset.k === 'fonte' && el.value === 'sem') p.renda = '';
        if (el.dataset.k === 'sexo' && el.value === 'M') { p.gestante = false; p.nutriz = false; }
        salvar(); rerender(el.id); return;
      }
      salvar(); return;
    }
    if (el.dataset.doc) {
      if (el.checked) F.docsOk[el.dataset.doc] = true; else delete F.docsOk[el.dataset.doc];
      salvar(); contarDocs(el.closest('.local')); return;
    }
    if (el.dataset.email) {
      const canal = el.dataset.email, v = String(el.value).trim().slice(0, 120);
      if (v) F.emails[canal] = v; else delete F.emails[canal];
      salvar();
      const sec = el.closest('.local'), a = sec && sec.querySelector('a[data-mailto]'), pre = sec && sec.querySelector('pre[data-carta]');
      if (a && pre) a.setAttribute('href', linkEmail(v, pre.textContent));
      el.setCustomValidity(v && !EMAIL_OK.test(v) ? 'E-mail parece incompleto' : '');
      return;
    }
    if (el.type === 'radio') { F[el.name] = el.value; salvar(); return; }
    if (PASSOS[passo] === 'saude' && el.dataset.k) { F.saude[el.dataset.k] = el.checked; salvar(); return; }
    if (PASSOS[passo] === 'situacao' && el.dataset.k) { F.sit[el.dataset.k] = el.checked; salvar(); return; }
    if (['cidade', 'bairro', 'rua', 'numero', 'complemento', 'referencia', 'telefone', 'contato2Nome', 'contato2Parentesco', 'contato2Tel'].includes(el.id)) { F[el.id] = String(el.value).slice(0, 120); salvar(); }
    if (el.id === 'cep') {
      const dig = el.value.replace(/\D/g, '').slice(0, 8);
      const fmt = dig.length > 5 ? dig.slice(0, 5) + '-' + dig.slice(5) : dig;
      if (el.value !== fmt) el.value = fmt;
      F.cep = fmt; salvar();
      if (dig.length === 8) buscarCep(dig);
    }
  });
  view.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'senha') { e.preventDefault(); document.getElementById('desbloquear').click(); }
    if (e.target.id === 'senha2') { e.preventDefault(); document.getElementById('salvar-senha').click(); }
  });
  function contarDocs(sec) {
    if (!sec) return;
    const caixas = sec.querySelectorAll('input[data-doc]'), c = sec.querySelector('.conta-docs');
    const feitos = Array.prototype.filter.call(caixas, x => x.checked).length;
    if (c) c.textContent = feitos + ' de ' + caixas.length + ' separados' + (feitos === caixas.length ? '. Tudo pronto!' : '');
  }
  function imprimirLocal(canal) {
    const sec = document.getElementById('local-' + canal); if (!sec) return;
    const det = sec.querySelector('details'); if (det) det.open = true;
    document.body.classList.add('imprimir-um'); sec.classList.add('imprimir-este');
    const limpar = () => { document.body.classList.remove('imprimir-um'); sec.classList.remove('imprimir-este'); window.removeEventListener('afterprint', limpar); };
    window.addEventListener('afterprint', limpar);
    try { window.print(); } catch (err) {}
    setTimeout(limpar, 60000);
  }
  async function copiarCarta(canal) {
    const pre = document.querySelector('pre[data-carta="' + (window.CSS && CSS.escape ? CSS.escape(canal) : canal) + '"]'); if (!pre) return;
    const texto = pre.textContent;
    try { await navigator.clipboard.writeText(texto); toast('Carta copiada. Cole no e-mail ou no WhatsApp.'); return; } catch (e) {}
    try {
      const r = document.createRange(); r.selectNodeContents(pre);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast(document.execCommand('copy') ? 'Carta copiada.' : 'A carta está selecionada. Use "Copiar" do seu aparelho.');
    } catch (e) { toast('Selecione a carta e copie com o dedo ou o mouse.'); }
  }
  function rerender(focoId) { const y = window.scrollY; render(); window.scrollTo(0, y); const f = focoId && document.getElementById(focoId); if (f) f.focus(); }
  function erroSenha(msg) { const el = document.getElementById('erro-senha'); if (el) { el.textContent = msg; el.hidden = false; } }

  async function desbloquear() {
    const senha = document.getElementById('senha').value;
    if (Date.now() < esperaAte) { erroSenha('Muitas tentativas. Espere ' + Math.ceil((esperaAte - Date.now()) / 1000) + ' segundos.'); return; }
    if (!senha) { erroSenha('Digite a senha.'); return; }
    const b = document.getElementById('desbloquear'); b.disabled = true; b.textContent = 'Abrindo...';
    try {
      const { dados, ctx } = await S.abrir(pacoteCifrado, senha);
      F = M.normalizarFamilia(dados); sessao = ctx; bloqueado = false; tentativas = 0; render(); armarBloqueioAutomatico();
    } catch (err) {
      tentativas++;
      if (tentativas >= 5) { esperaAte = Date.now() + 30000 * Math.pow(2, Math.min(tentativas - 5, 5)); tentativas = 3; }
      b.disabled = false; b.textContent = 'Abrir'; erroSenha('Senha errada. Tente de novo.');
      const i = document.getElementById('senha'); i.value = ''; i.focus();
    }
  }
  async function criarSenha() {
    const s1 = document.getElementById('senha1').value, s2 = document.getElementById('senha2').value;
    if (s1.length < 6) { erroSenha('A senha precisa ter pelo menos 6 números ou letras.'); return; }
    if (s1 !== s2) { erroSenha('As duas senhas estão diferentes.'); return; }
    const b = document.getElementById('salvar-senha'); b.disabled = true; b.textContent = 'Protegendo...';
    try {
      sessao = await S.novaChave(s1);
      const pac = await S.cifrar(F, sessao); pacoteCifrado = pac;
      if (!store.set('md_familia', pac)) throw new Error('armazenamento');
      tela = null; render(); toast('Pronto. Os dados agora estão protegidos com senha.'); armarBloqueioAutomatico();
    } catch (err) { sessao = null; b.disabled = false; b.textContent = 'Proteger'; erroSenha('Não foi possível proteger agora. Tente de novo.'); }
  }
  function bloquear() {
    if (!sessao) return;
    clearTimeout(timerSalvar);
    S.cifrar(F, sessao).then(pac => { pacoteCifrado = pac; store.set('md_familia', pac); F = null; sessao = null; bloqueado = true; tela = null; render(); });
  }
  // Com senha, o app se fecha sozinho depois de 10 minutos sem uso.
  let timerInativo = null;
  function armarBloqueioAutomatico() { clearTimeout(timerInativo); if (sessao) timerInativo = setTimeout(bloquear, 10 * 60 * 1000); }
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, armarBloqueioAutomatico, { passive: true }));

  view.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ir !== undefined) { irPara(+b.dataset.ir); return; }
    if (b.dataset.imprimir) { imprimirLocal(b.dataset.imprimir); return; }
    if (b.dataset.copiar) { copiarCarta(b.dataset.copiar); return; }
    if (b.dataset.remover !== undefined) { F.pessoas.splice(+b.dataset.remover, 1); salvar(); rerender(); return; }
    switch (b.id) {
      case 'desbloquear': desbloquear(); break;
      case 'esqueci': document.getElementById('confirma-limpar').hidden = false; break;
      case 'criar-senha': tela = 'criar-senha'; render(); break;
      case 'cancelar-senha': tela = null; render(); break;
      case 'salvar-senha': criarSenha(); break;
      case 'tirar-senha': clearTimeout(timerSalvar); sessao = null; salvar(); render(); toast('Senha retirada.'); break;
      case 'bloquear': bloquear(); break;
      case 'instalar': if (eventoInstalar) { eventoInstalar.prompt(); eventoInstalar.userChoice.finally(() => { eventoInstalar = null; render(); }); } break;
      case 'comecar': irPara(1); break;
      case 'ver-exemplo': F = exemplo(); salvar(); irPara(5); toast('Exemplo carregado. Troque pelos seus dados quando quiser.'); break;
      case 'limpar': document.getElementById('confirma-limpar').hidden = false; break;
      case 'limpar-nao': document.getElementById('confirma-limpar').hidden = true; break;
      case 'limpar-sim': apagarTudo(); render(); toast('Todos os dados foram apagados deste aparelho.'); break;
      case 'terminar': apagarTudo(); render(); toast('Todos os dados foram apagados deste aparelho.'); break;
      case 'add-pessoa': if (F.pessoas.length < 20) { F.pessoas.push(M.novaPessoa(false)); salvar(); rerender('p' + (F.pessoas.length - 1) + '_nome'); } break;
      case 'abrir-documentos': passo = 'documentos'; salvar(); render(); window.scrollTo(0, 0); break;
      case 'abrir-relatorio': passo = 'relatorio'; salvar(); render(); window.scrollTo(0, 0); break;
      case 'imprimir': try { window.print(); } catch (err) {} break;
      case 'avancar': {
        if (PASSOS[passo] === 'pessoas') {
          const erro = document.getElementById('erro-pessoas');
          const semNome = F.pessoas.findIndex(p => !p.nome.trim());
          if (semNome >= 0) { erro.textContent = 'Falta o nome da pessoa ' + (semNome + 1) + '. Escreva o nome ou toque em "Tirar esta pessoa".'; erro.hidden = false; return; }
          const semRenda = F.pessoas.findIndex(p => p.fonte !== 'sem' && !numero(p.renda));
          if (semRenda >= 0) { erro.textContent = 'Falta quanto ' + F.pessoas[semRenda].nome.split(' ')[0] + ' ganha por mês. Se não tem renda, escolha "Não tem renda".'; erro.hidden = false; return; }
          const nascRuim = F.pessoas.findIndex(p => p.nasc && idade(p.nasc) === null);
          if (nascRuim >= 0) { erro.textContent = 'A data de nascimento de ' + F.pessoas[nascRuim].nome.split(' ')[0] + ' não parece certa. Confira o dia, mês e ano.'; erro.hidden = false; return; }
        }
        irPara(passo + 1); break;
      }
    }
  });

  // ---------- Atualização das regras (com assinatura) ----------
  const ultimoResultado = { motivo: 'nenhuma verificação' };
  async function aceitarRegras(texto, assinatura, origem) {
    if (typeof texto !== 'string' || texto.length > 600000) return 'arquivo grande demais';
    if (!CHAVE_PUBLICA) return 'sem chave pública';
    if (!(await S.conferirAssinatura(texto, assinatura, CHAVE_PUBLICA))) return 'assinatura inválida';
    let novas; try { novas = JSON.parse(texto); } catch (e) { return 'arquivo corrompido'; }
    const erros = M.validarRegras(novas);
    if (erros.length) return 'regras inválidas: ' + erros[0];
    if (cmpVersao(novas.versao, REGRAS.versao) <= 0) return 'versão não é mais nova';
    REGRAS = novas;
    if (origem === 'internet') store.set('md_regras', { texto, assinatura });
    return 'ok';
  }
  async function carregarRegrasSalvas() {
    const s = store.get('md_regras', null);
    if (!s || typeof s.texto !== 'string') return;
    const r = await aceitarRegras(s.texto, s.assinatura, 'aparelho');
    if (r === 'ok') { if (F || bloqueado) render(); }
    else if (r !== 'versão não é mais nova') store.del('md_regras');
  }
  async function baixarTexto(url, ms, externo) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), ms);
    try {
      const r = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) throw new Error('http ' + r.status);
      const t = await r.text();
      if (externo && t.length > 5000) throw new Error('resposta grande demais');
      return t;
    } finally { clearTimeout(t); }
  }
  let verificando = false;
  async function verificarAtualizacao(manual) {
    if (verificando) return;
    if (!navigator.onLine) { if (manual) toast('Sem internet agora. Tente de novo quando estiver conectado.'); return; }
    verificando = true;
    try {
      const marca = Date.now();
      const [texto, assinatura] = await Promise.all([baixarTexto('regras.json?t=' + marca, 15000), baixarTexto('regras.json.sig?t=' + marca, 15000)]);
      const r = await aceitarRegras(texto, assinatura, 'internet');
      ultimoResultado.motivo = r;
      store.set('md_ultima_verificacao', Date.now());
      if (r === 'ok') { render(); toast('Regras atualizadas para a versão ' + REGRAS.versao + '.'); }
      else if (r === 'versão não é mais nova') { if (manual) toast('Você já tem as regras mais novas.'); renderFoot(); }
      else { if (manual) toast('A atualização recebida não passou na conferência de segurança e foi ignorada.'); renderFoot(); }
    } catch (err) {
      ultimoResultado.motivo = 'falha de rede';
      if (manual) toast('Não foi possível procurar atualização agora.');
    } finally { verificando = false; }
  }
  function renderFoot() {
    const ult = store.get('md_ultima_verificacao', null);
    const el = document.getElementById('foot');
    el.innerHTML = (avisoArmazenamento ? '<p class="hint" id="aviso-armazenamento" role="alert">Este aparelho não está deixando guardar as respostas. O aplicativo funciona, mas tudo some ao fechar. Imprima o relatório antes de sair.</p>' : '') + '<span>Regras de ' + dataBR(REGRAS.atualizadoEm) + ' (versão ' + esc(REGRAS.versao) + '), ' + REGRAS.programas.length + ' programas. ' + (typeof ult === 'number' ? 'Última verificação: ' + new Date(ult).toLocaleString('pt-BR') + '.' : '') + '</span>' +
      '<span><button type="button" class="link" id="verificar">Procurar atualização das leis e programas</button></span>' +
      '<span>Este aplicativo não é do governo. É uma ajuda para encontrar direitos. Quem decide é sempre o órgão responsável.</span>';
    document.getElementById('verificar').onclick = () => verificarAtualizacao(true);
  }
  function estadoRede() { document.getElementById('netstate').textContent = navigator.onLine ? 'Conectado · funciona também sem internet' : 'Sem internet · tudo funciona normalmente'; }
  window.addEventListener('online', () => { estadoRede(); verificarAtualizacao(false); });
  window.addEventListener('offline', estadoRede);
  // Cartas fechadas também saem na impressão.
  let abertasParaImprimir = [];
  window.addEventListener('beforeprint', () => { abertasParaImprimir = Array.prototype.filter.call(document.querySelectorAll('details.carta-bloco'), d => !d.open); abertasParaImprimir.forEach(d => { d.open = true; }); });
  window.addEventListener('afterprint', () => { abertasParaImprimir.forEach(d => { d.open = false; }); abertasParaImprimir = []; });

  // ---------- Início ----------
  if (!EMBUTIDAS || M.validarRegras(EMBUTIDAS).length) { view.innerHTML = '<p class="err">O arquivo de regras deste aplicativo está com defeito. Baixe o aplicativo de novo.</p>'; return; }
  estadoRede();
  try { render(); } catch (e) { view.innerHTML = '<div class="stack"><p class="err">Não foi possível abrir as respostas salvas neste aparelho.</p><div class="btns"><button type="button" class="go" id="limpar-sim">Apagar e começar de novo</button></div></div>'; }
  carregarRegrasSalvas().finally(() => {
    const ult = store.get('md_ultima_verificacao', 0);
    if (!(typeof ult === 'number' && Date.now() - ult < 24 * 3600 * 1000)) verificarAtualizacao(false);
  });
  if ('serviceWorker' in navigator && !EM_MOLDURA && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  }
  // Ganchos para os testes automáticos (não expõem os dados da família).
  window.__md = { versaoRegras: () => REGRAS.versao, ultimoResultado, verificarAtualizacao, exemplo };
})();
