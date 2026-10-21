# Meus Direitos MG

Aplicativo gratuito que ajuda famílias de Minas Gerais a descobrir **quais benefícios sociais e direitos podem ter**
(Brasil, Minas Gerais e Prefeitura), **onde pedir** e **quais documentos levar**. No final, gera um relatório
pronto para imprimir, com um pedido já escrito para cada órgão (CRAS, posto de saúde, INSS, Copasa...).

- Mostra **quem da família tem direito a quê, e por quê** (com os números da própria família).
- Página **Documentos e cartas**: para cada lugar, a lista do que levar com o nome de cada pessoa (marque o que já separou)
  e uma **carta pronta** explicando a situação e pedindo a verificação. A carta pode ser impressa sozinha, copiada
  ou aberta no e-mail da própria pessoa.
- **Benefícios das Prefeituras**: Pouso Alegre (auxílio-natalidade, cesta básica, funeral, mudança, documentos, auxílio-moradia),
  Santa Rita do Sapucaí (cesta básica, Pão e Leite, natalidade, funeral, passagem), Belo Horizonte (Restaurante Popular,
  Bolsa Moradia). Em todas as cidades: benefícios eventuais, transporte para tratamento em outra cidade (TFD),
  ônibus urbano grátis para 65+ e transporte escolar na zona rural.
- **Questionário para WhatsApp** e **formulário em papel para imprimir** (A4): quem ajuda uma família manda as perguntas
  ou entrega a folha, e depois preenche o app com as respostas.
- Funciona **sem internet** depois de aberto uma vez, no **celular e no computador** (pode ser instalado).
- Os dados da família **ficam só no aparelho**. Nada é enviado. Dá para proteger com **senha** (criptografia AES-256)
  e apagar tudo com um toque.
- As regras ficam em um arquivo separado e **assinado**. Os aparelhos baixam a versão nova sozinhos quando têm internet
  e recusam qualquer arquivo sem a assinatura do projeto.

**Usar:** https://amarigo.github.io/meus-direitos-mg/

> O resultado é uma estimativa. Quem decide é sempre o órgão responsável. Este aplicativo não é do governo.

## O que cobre (regras de 2026)
CadÚnico, Bolsa Família (com valor estimado), BPC/LOAS, Auxílio-Inclusão, Tarifa Social e Desconto Social de energia,
Gás do Povo, Pé-de-Meia, Farmácia Popular (remédios, fraldas e absorventes), SUS (consultas, especialistas, dentista,
saúde mental, pré-natal), salário-maternidade, seguro-desemprego, Carteira da Pessoa Idosa, ID Jovem, Passe Livre,
Minha Casa Minha Vida, isenção de taxas, Garantia-Safra, seguro-defeso, documentos grátis, Tarifa Social da Copasa,
Trilhas de Futuro, benefícios eventuais, creche, proteção contra violência, situação de rua e Defensoria Pública.

Cidades com informação local: Itajubá, Pouso Alegre, Paraisópolis, Santa Rita do Sapucaí e Belo Horizonte.

## Como atualizar uma lei ou valor
1. Edite `src/regras.json`: mude o valor, a data em `verificadoEm` e aumente `versao` (ex.: `2026.11.1`).
2. Assine: `CHAVE_PRIVADA=/caminho/chave-privada-regras.jwk npm run assinar`
   (a chave privada **nunca** vai para o repositório).
3. `npm test` e envie para a branch `main`. O GitHub testa e publica sozinho; os aparelhos recebem a atualização.

Toda segunda-feira o GitHub roda os testes e abre um lembrete se algum programa está há mais de 90 dias sem conferência.

### Como escrever uma regra
`{"f":"rpc","op":"<=","v":"meioSM"}` = renda por pessoa até meio salário mínimo. Combine com `all`, `any`, `not`.
`condicao` = provável direito; `condicaoTalvez` = vale perguntar. Com `"porMembro": true` a regra é testada pessoa a pessoa
(`m.idade`, `m.pcd`, `m.estudo`...). Os fatos aceitos estão em `validarRegras` (`src/motor.js`); o build recusa regras com erro.
Cidades: em `municipios`, pelo código IBGE, com `cras`, `extras`, `fonte` e `verificadoEm`.

## Estrutura
| Pasta | O que tem |
|---|---|
| `src/` | O aplicativo: `motor.js` (cálculo), `seguranca.js` (criptografia e assinatura), `app.js` (telas), `regras.json`, cidades, estilos e fontes |
| `ferramentas/` | Build, assinatura, ícones e conferência de validade |
| `testes/` | Unidade, integração, ponta a ponta, caos e segurança. Veja `testes/RISCOS.md` |

## Testes
`npm test` roda a pirâmide inteira (Node + Playwright):
- **Unidade**: leitura de valores e datas, limites de renda, Bolsa Família, BPC, criptografia, assinatura.
- **Integração**: famílias-modelo conferidas pela lei, 6.000 famílias aleatórias (propriedades), saída do build.
- **Ponta a ponta**: celular (360 e 390 px) e computador, impressão em PDF, dados salvos, nada enviado para fora.
- **Caos**: atualização falsa, antiga, corrompida, página de Wi-Fi, servidor lento/instável/fora do ar, sem internet,
  armazenamento cheio/bloqueado/estragado.
- **Segurança**: ataques por texto (XSS) em todos os campos, senha, tentativas repetidas, política de segurança (CSP).

## Segurança
- Política de segurança rígida (CSP): só código do próprio site; nenhum script, fonte ou serviço de terceiros.
- Sem cadastro, sem servidor, sem rastreamento. O único acesso à internet é baixar `regras.json` e a assinatura.
- Senha opcional: PBKDF2-SHA256 (310 mil rodadas) + AES-GCM 256; bloqueio automático após 10 minutos; espera após 5 erros.
- Atualizações de regras assinadas com ECDSA P-256 e validadas antes de usar; versões antigas são recusadas.
- Fontes: Atkinson Hyperlegible e Bricolage Grotesque (SIL Open Font License), guardadas no próprio app.
