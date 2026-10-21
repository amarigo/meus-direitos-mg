# Análise de riscos e estratégia de testes

O aplicativo orienta famílias vulneráveis sobre dinheiro, saúde e moradia. Um erro pode fazer a família
**perder um direito** (falso "não tem direito"), **perder tempo e dinheiro de passagem** (falso "tem direito")
ou **ter dados pessoais expostos** (CPF, renda, saúde, violência doméstica).

Nota = Impacto (1–5) × Probabilidade (1–5). Quanto maior, mais testes e mais cedo.

| # | Risco | Impacto | Prob. | Nota | Como é testado |
|---|-------|:-:|:-:|:-:|---|
| R1 | Renda digitada lida errado (ex.: "1.500" virar R$ 1,50) e a família parecer mais pobre ou mais rica | 5 | 4 | **20** | Unidade (`numero`), E2E digitando "1.500" e conferindo o relatório |
| R2 | Erro nos limites de renda (exatamente meio salário, 1/4, R$ 218) | 5 | 3 | **15** | Unidade nos valores exatos de fronteira, famílias-modelo |
| R3 | Idade desconhecida/errada gerando direito falso (creche, BPC, Pé-de-Meia) | 4 | 4 | **16** | Unidade (`idade`, `avaliar` com valor desconhecido), E2E com data inválida |
| R4 | Cálculo do BPC sem descontar o benefício de outro idoso/PcD (LOAS art. 20 §14) | 5 | 3 | **15** | Unidade e famílias-modelo |
| R5 | Valor do Bolsa Família estimado errado | 3 | 3 | 9 | Unidade com composições conhecidas |
| R6 | Dados pessoais lidos por outra pessoa no mesmo aparelho | 5 | 3 | **15** | E2E com senha: nada legível no armazenamento, senha errada, bloqueio, apagar |
| R7 | Ataque por texto digitado (XSS) no nome/endereço | 5 | 2 | 10 | Unidade (`esc`), E2E com textos de ataque, política de segurança (CSP) sem violações |
| R8 | Atualização de regras falsa ou corrompida trocando as regras de todos | 5 | 2 | 10 | Caos: arquivo truncado, página de wi-fi, assinatura falsa, regras assinadas mas inválidas, versão antiga |
| R9 | App não abre sem internet | 4 | 3 | 12 | Caos: desligar internet depois de instalado |
| R10 | Armazenamento cheio, bloqueado ou com dados estragados quebrar o app | 4 | 2 | 8 | Caos: `localStorage` que falha, dados estragados, regras salvas adulteradas |
| R11 | Envio de dados para terceiros | 5 | 1 | 5 | E2E registra todas as requisições: só o próprio site, nenhum POST |
| R12 | Regra morta (programa que nunca aparece) ou regra mal escrita no arquivo | 3 | 3 | 9 | Integração: validação do arquivo e cobertura de todos os programas |
| R13 | Relatório impresso sem dados ou cortado | 3 | 2 | 6 | E2E imprime em PDF e confere |
| R14 | Tela quebrada no celular pequeno ou no computador | 2 | 3 | 6 | E2E em 360 px, 390 px e 1366 px sem rolagem lateral |
| R15 | Lista de documentos errada (falta documento, ou pede de quem não precisa) e a família volta para casa sem atendimento | 4 | 3 | **12** | Unidade (`planoPorLocal`: nomes certos, sem repetir), E2E da página de documentos |
| R16 | Carta ou "por quê" com dado errado ou campo vazio (`{nome}`) | 3 | 3 | 9 | Unidade (`direitosPorPessoa`, motivos sem campo vazio), E2E conferindo a carta |
| R17 | Texto de ataque ou e-mail malicioso entrando na carta ou no link de e-mail | 4 | 2 | 8 | E2E: ataque vira texto na carta, e-mail inválido não entra no link |
| R18 | Marcações da lista perdidas ao fechar o app | 2 | 3 | 6 | E2E: marcar, recarregar e conferir |
