# Relatório de qualidade — Suíte de API Smart City

**Entrega:** Unidade 1 · **Squad:** ResolveAí · **Data:** 08/09/2026
**Alvo desta execução:** duplo de referência do contrato (`http://localhost:5000`)
**Ambiente:** Node v24.20.0 · Windows 11 · zero dependências instaladas

---

## 1. Situação da suíte

| Suíte | Casos | Aprovados | Reprovados | Taxa | Tempo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `unidade` (verificação da TAS) | 8 | 8 | 0 | 100% | ~0,006 s |
| `api` (nível de serviço) | 106 | 106 | 0 | 100% | ~3,1 s |
| **Total** | **114** | **114** | **0** | **100%** | **~3,1 s** |

Quatro execuções consecutivas: 114/114 nas quatro, com tempos entre 3,08 s e
3,19 s. **Nenhuma falha intermitente observada.**

---

## 2. Interpretação

**A taxa de 100% não é a informação principal deste relatório, e lida sozinha
seria enganosa.** Ela foi obtida contra o duplo de referência do contrato — um
servidor escrito pela própria squad para implementar o contrato ao pé da letra.
Suíte verde contra ele significa que **a suíte funciona**: as asserções
executam, as camadas se comunicam, a preparação de cenário monta os estados. Não
significa nada sobre a API Flask do Projeto Integrador, que ainda não foi
exercitada por ela (risco R-05).

O que efetivamente aumentou nesta entrega foi a **confiança na suíte**, e ela tem
evidência própria: a verificação de sensibilidade (seção 4). O risco coberto do
produto só aumentará de fato quando o item 2 do backlog for executado.

Dois números merecem leitura:

- **~3,1 s para 114 casos** deixa o objetivo O1 (retorno em menos de 5 minutos)
  cumprido com folga larga. A margem existe porque a decisão de nível foi
  econômica: tudo o que podia ficar no serviço ficou no serviço, e nada foi
  duplicado em E2E.
- **29 dos 106 casos de API (27%) verificam uma única regra**: a máquina de
  estados. É desproporcional de propósito, e é dívida consciente (R-01). Esses
  25 pares custariam milissegundos no nível de componente e custam ~2 s aqui,
  com dependência do ambiente no ar. O item 1 do backlog reverte isso.

---

## 3. Falhas e defeitos encontrados

### 3.1 No SUT

**Nenhum.** E isso precisa ser lido com cuidado: o alvo desta execução foi o
duplo de referência, que implementa o contrato por construção. **A ausência de
achados aqui é consequência do alvo escolhido, não uma afirmação sobre a
qualidade do back-end.**

### 3.2 Na própria TAS — 2 defeitos encontrados e corrigidos

Ambos apareceram porque a suíte foi executada repetidamente contra um ambiente
com estado acumulado, e não apenas uma vez em ambiente limpo.

| ID | Defeito | Diagnóstico | Correção |
| :--- | :--- | :--- | :--- |
| TAS-D01 | `HU-09 C28` passava na 1ª execução e reprovava a partir da 2ª | O caso procurava a demanda recém-criada apenas na **primeira página**. Com mais de 20 demandas acumuladas, ela cai na página 2 e a asserção falha. Classificação: **defeito da TAS**, não do produto. | `api.localizarNaListagem()` percorre a paginação inteira. |
| TAS-D02 | `HU-09 C27` tinha risco de **falso negativo** | O caso afirmava a *ausência* da demanda alheia na primeira página. Uma demanda vazada que estivesse na página 2 produziria **verde**. Era o pior defeito possível: um teste de isolamento que aprova um vazamento. | `api.percorrerListagem()` varre todas as páginas antes de afirmar ausência. Mesma correção aplicada a C31 e C32. |

**TAS-D02 é o achado mais relevante desta entrega.** Ele não apareceu como
vermelho — foi encontrado ao investigar TAS-D01, e teria permanecido invisível
indefinidamente, aprovando exatamente o vazamento que o caso existia para
impedir.

Após a correção: **quatro execuções consecutivas, 114/114**, agora contra um
ambiente com centenas de demandas acumuladas.

---

## 4. Sensibilidade — a suíte sabe ficar vermelha?

Seis defeitos conhecidos injetados no alvo, um de cada vez, com a suíte
completa executada contra cada versão defeituosa (`npm run sensibilidade`).

| Defeito injetado | Casos reprovados | Detectou o caso esperado? |
| :--- | :--- | :--- |
| Abre a transição `IN_PROGRESS → REJECTED` | **1** | Sim — exatamente `HU-13 C36 IN_PROGRESS -> REJECTED` |
| Cadastro obedece ao `role` do cliente | 1 | Sim — `HU-01 C16` |
| Demanda de terceiro responde 403 em vez de 404 | 1 | Sim — `HU-03 A5` |
| Respostas passam a incluir a senha | 3 | Sim — `HU-02 C09` |
| Erros perdem o campo `code` | 50 | Sim — `CT C49` |
| Demanda nasce em `UNDER_ANALYSIS` | 26 | Sim — `HU-06 C19` |

**Pontos cegos: 0.** Todos os seis defeitos foram percebidos, e cada um acordou
o caso que deveria acordar.

O primeiro resultado é o mais informativo: um defeito cirúrgico na tabela de
transições derrubou **exatamente um** caso, e o nome dele diz qual transição
quebrou — sem abrir o código.

Os dois últimos ilustram a métrica *falhas por defeito*: **um** defeito produziu
50 e 26 reprovações. Uma leitura ingênua diria "a suíte está 50% pior"; a
leitura correta é "há um defeito, e ele é transversal". Registrado para não
distorcer as métricas da U2.

---

## 5. Riscos de qualidade da entrega

| Risco | Evidência | Recomendação |
| :--- | :--- | :--- |
| **A suíte nunca rodou contra o back-end real.** Toda a evidência é contra o duplo de referência. | Seção 2 | **Bloqueante.** Item 2 do backlog, antes de qualquer afirmação sobre a qualidade do produto. |
| **O contrato de payload não está documentado.** Postman renderizado por JS não expõe nada; README cobre só rotas e perfis. | `data/contrato.js`, blocos `[B]` | Confirmar com a equipe de back-end. Enquanto isso, divergência de execução pode estar no teste, e não no produto. |
| **Vocabulário de status divergente** entre o Material de Estudo e os casos de teste da squad. | R-03 | Fechar o enum com o back-end. Custo da correção: uma edição em um arquivo. |
| **3 células de autorização não decididas** pelo README. | `matriz-autorizacao.js` | Levar as 3 perguntas para a equipe de back-end. |
| **Nada do app mobile é verificado.** | App em scaffold | Aceito conscientemente: E2E depende de app navegável e de identificadores estáveis. |

### O que **não** está coberto pela automação, e como foi verificado

| Item | Como é verificado hoje |
| :--- | :--- |
| Captura real de foto | Manual, por entrega |
| Legibilidade das mensagens de erro | Revisão em squad |
| Expiração real de token por decurso de prazo | Não verificado — depende de testabilidade do back-end |
| Rate limiting em login | Não verificado — a regra não existe no contrato |
| Fluxo ponta a ponta no app | Não verificado — app em scaffold |

---

## 6. Backlog: situação

| Itens de risco alto | Automatizados | Pendentes | Fora por decisão |
| :--- | :--- | :--- | :--- |
| 11 | 7 | 4 (itens 1, 2, 12, 14) | 6 (seção 3 de `tas.md`) |

---

## 7. Recomendação sobre a entrega

**Pode seguir com ressalvas.**

A solução de automação está construída, executa por comando único, é
reproduzível em outra máquina, troca de alvo por variável e **tem sensibilidade
demonstrada** — que é a evidência de que a informação produzida por ela vale
alguma coisa.

As ressalvas são duas, e são nomeadas em vez de omitidas:

1. **A suíte ainda não exerceu o SUT real.** Enquanto isso não acontecer, esta
   entrega demonstra uma solução de automação funcionando, e não a qualidade do
   produto. Recomendar "pode seguir" sem esta ressalva seria omitir informação
   de quem decide — o oposto da função do teste.
2. **Parte do oráculo é hipótese, não contrato confirmado.** Os itens `[B]`
   precisam de confirmação da equipe de back-end antes que qualquer divergência
   seja tratada como defeito do produto.
