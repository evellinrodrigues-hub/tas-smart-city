# TAS — Projeto Integrador Smart City / ResolveAí

Memória das decisões da solução de automação. Cada seção registra o que foi
decidido, com base em quê, e o que se perdeu com a escolha.

---

## 1. Ficha do SUT

| Item | Situação |
| :--- | :--- |
| **Produto** | Plataforma de gestão de demandas urbanas: app mobile Expo/React Native (cidadão) + **API REST Flask/PostgreSQL** (back-end compartilhado com o cliente web). |
| **SUT desta TAS** | **A API Flask.** O app mobile está em estado de *scaffold* (2 commits, ponto de entrada `App.tsx` com uma tela estática, sem navegação, sem camada de serviços) e por isso não sustenta E2E ainda. |
| **Perfis** | `CITIZEN`, `MANAGER`, `ADMIN`. |
| **Recurso central** | Demanda urbana, com protocolo gerado pelo servidor e máquina de estados fechada. |
| **Contrato** | REST, JSON. Endpoints e regras de autorização documentados no README do repositório mobile; **payloads e códigos de erro não documentados** (ver seção 4, R-02). |
| **Recursos de dispositivo** | Câmera e GPS aparecem nos casos de teste da squad, mas não no escopo desta suíte de API. |
| **Dados** | Sintéticos. |

---

## 2. Objetivos da automação (2026.2)

Três, e cada um verificável em dezembro com evidência ao lado.

- **O1** — Qualquer pessoa da squad sabe, em **menos de 5 minutos**, se a
  mudança que acabou de fazer quebrou o registro de demanda, a autenticação ou
  a autorização por perfil.
  *Evidência: tempo real da suíte (hoje ~3,1 s) + histórico da esteira.*
- **O2** — A regressão dos fluxos principais roda **sem intervenção manual**,
  por comando único e por gatilho de esteira.
  *Evidência: `npm test` e `.github/workflows/testes.yml`.*
- **O3** — Nenhuma alteração no back-end chega à entrega sem que as **regras de
  autorização por perfil** tenham sido verificadas.
  *Evidência: `tests/api/hu03-autorizacao.test.js`, gerado da matriz.*

---

## 3. Fora do escopo da automação neste semestre

| Item | Motivo | Como será verificado |
| :--- | :--- | :--- |
| E2E no app mobile | O app é scaffold: não há telas navegáveis nem identificadores de teste. Automatizar agora seria automatizar o que não existe. | Retomar quando houver build navegável; ferramenta já decidida (Appium) na tabela de comparação da squad. |
| Testes de unidade das regras do back-end | A regra vive em Python/Flask; um runner Node não alcança aquele módulo. | Item 1 do backlog (seção 6): suíte Python no repositório do back-end. |
| Captura real de foto pela câmera | Restrição de plataforma, custo alto e instabilidade. | Verificação manual por entrega. |
| Legibilidade de mensagens e aparência | Julgamento humano. | Revisão em squad. |
| Desempenho e carga | Fora da ementa da disciplina. | — |
| Expiração real de token por decurso de prazo | Dependência longa de tempo. | Reavaliar se o back-end expuser emissão de token expirado em ambiente de teste. |

> "Fora da automação" **não** significa "não verificado".

---

## 4. Riscos e condições de teste

### 4.1 Matriz de risco

| História | Impacto | Prob. | Justificativa da nota | Nível |
| :--- | :--- | :--- | :--- | :--- |
| HU-03 Autorização por perfil | Alto | **Alta** | Regra transversal a quase todos os endpoints; qualquer refatoração pode afrouxá-la **sem quebrar nada visível**. É o perfil de risco que a automação combate melhor. | API |
| HU-06 Registro de demanda | Alto | Alta | Fluxo principal do produto, com validações numerosas e mudanças frequentes durante o semestre. | API |
| HU-02 Autenticação e sessão | Alto | Média | Sem login nenhuma outra função existe; logout que não invalida token é falha silenciosa. | API |
| HU-13 Atualização de status | Alto | Média | Máquina de estados fechada; transição indevida corrompe o histórico e o cálculo de tempo de atendimento. | API (ver R-01) |
| HU-14 Exclusão de demanda | Alto | Média | Operação irreversível, restrita por estado. | API |
| HU-01 Autocadastro | Alto | Média | Porta de entrada; o caso grave é escalonamento de privilégio via corpo do cadastro. | API |
| HU-09/12 Consulta e filtros | Médio | Média | Falha é visível ao cidadão, mas o isolamento entre contas é de risco alto. | API |

### 4.2 Riscos da própria solução

| ID | Risco | Mitigação adotada |
| :--- | :--- | :--- |
| **R-01** | A exaustividade dos 25 pares da máquina de estados está no nível de serviço, não no de componente — onde custaria milissegundos. Custo de execução mais alto e dependência do ambiente no ar. | Assumido conscientemente: a regra vive no Flask e não há alternativa hoje. Verificar 2 ou 3 pares e chamar de cobertura deixaria **20 recusas** sem verificação. Item 1 do backlog reverte isso. |
| **R-02** | **Payloads, códigos de erro, enum de status e limites de campo não estão documentados.** A documentação Postman é renderizada por JavaScript e retorna apenas o título. | **Confirmado por leitura do código-fonte real** (`schemas/*.py` do back-end), não mais hipótese do SUT didático. Marcado `[C]` em `data/contrato.js`, com a distinção explícita de que fatos de formato (`[C]`) nunca são usados para decidir regra de negócio (`[A]`/`[B]`) — ver cabeçalho do arquivo. Achado adicional: **não existe campo `error.code`** no back-end real (seção 3.2, `docs/relatorio-qualidade.md`). |
| **R-03** | Vocabulário de status divergente entre fontes: o Material de Estudo usa `RECEIVED/UNDER_ANALYSIS/...`; os casos de teste da squad usam "Aberto"/"Em andamento"/"Resolvido". | **Resolvido para o back-end real**: o enum confirmado tem 4 estados (`PENDING/IN_PROGRESS/RESOLVED/REJECTED`), não 5. A tabela de transições entre eles continua sendo hipótese adaptada (nenhuma fonte documenta as regras de transição deste enum específico) — e o achado mais relevante da entrega é que **o back-end real não aplica nenhuma validação de transição** (`docs/relatorio-qualidade.md`, achado D-08). |
| **R-04** | Três células da matriz de autorização não são decididas pelo README (ADMIN sobre demandas, exclusão por ADMIN, isolamento por setor entre gestores). | **Não inventadas.** Registradas em `data/matriz-autorizacao.js` e impressas a cada execução como pendência de contrato. |
| **R-05** | Suíte verde contra o duplo de referência não é evidência sobre o produto. | **Resolvido nesta entrega.** A suíte foi ajustada ao formato real (payload, enum de status, perfis) e executada contra o back-end Flask. Achados em `docs/relatorio-qualidade.md`, seção 3. |

---

## 5. Candidatos e não candidatos

Filtro de seis perguntas aplicado às condições de risco alto: é tecnicamente
possível? é repetível? vale executar com frequência? o retorno compensa? é
fácil de manter? cobre fluxo de negócio relevante?

**Candidatos automatizados** — 106 casos de API + 8 de verificação da TAS.

**Não candidatos**, com motivo — ver seção 3.

---

## 6. Backlog de automação

Ordenado por **risco** e, dentro de cada faixa, por **custo crescente**.

| # | Item | HU | Nível | Risco | Custo | Status |
| :-- | :--- | :-- | :--- | :--- | :--- | :--- |
| 1 | Extrair a regra de transição do handler Flask para módulo puro e cobrir os 25 pares em suíte Python de unidade | 13 | Unid | Alto | Baixo | **a fazer** — pedido a levar para Desenvolvimento |
| 2 | Executar a suíte contra o back-end Flask real e classificar divergências | todas | API | Alto | Baixo | **feito** — ver `docs/relatorio-qualidade.md` |
| 3 | Autorização por perfil (matriz) | 03 | API | Alto | Baixo | feito |
| 4 | Registro de demanda: caminho feliz, validações e limites | 06 | API | Alto | Baixo | feito |
| 5 | Autenticação, sessão, logout e refresh | 02 | API | Alto | Baixo | feito |
| 6 | Máquina de estados: 25 pares | 13 | API | Alto | Médio | feito |
| 7 | Exclusão por estado e por autoria | 14 | API | Alto | Baixo | feito |
| 8 | Isolamento entre cidadãos (403 × 404) | 03 | API | Alto | Baixo | feito |
| 9 | Cadastro e escalonamento de privilégio | 01 | API | Alto | Baixo | feito |
| 10 | Contrato transversal (mídia, `code`, 405, corpo malformado, 5xx) | — | API | Médio | Baixo | feito |
| 11 | Consulta, paginação e filtros | 09/12 | API | Médio | Baixo | feito |
| 12 | Confirmar as 3 células não documentadas da matriz com o back-end | 03 | — | Alto | Baixo | **a fazer** |
| 13 | Rate limiting / bloqueio após N tentativas de login | 02 | API | Médio | Médio | a fazer — regra não existe no contrato |
| 14 | E2E mobile (Appium) do fluxo registrar → acompanhar | 06/08 | E2E | Alto | Alto | bloqueado pelo app |

---

## 7. Especificação da pipeline

### Gatilhos
- `push` em qualquer branch → estágios 1 e 2
- `pull request` para `main` → estágios 1, 2 e 3

### Estágios

| # | Estágio | Suíte | Duração alvo | Bloqueia? |
| :-- | :--- | :--- | :--- | :--- |
| 1 | verificação da TAS | `tests/unidade` | < 5 s | sim (merge) |
| 2 | API | `tests/api` | < 60 s | sim (merge) |
| 3 | sensibilidade | defeitos injetados | < 3 min | sim (entrega) |

### Quality gates
- **G1** — nenhuma falha nos estágios 1 e 2 → obrigatório para *merge* em `main`.
- **G2** — estágio 3 sem ponto cego → obrigatório para declarar a entrega.
- **G3** — falha de ambiente (SUT fora do ar) **não** é reprovação de produto:
  `lib/http.js` produz mensagem própria para esse caso.

### Critérios de entrada
- Alvo disponível e respondendo (`npm run diagnostico` verde).
- Os quatro usuários de teste existentes, com os perfis corretos.

### Critérios de saída
- 100% dos itens de risco alto do backlog executados.
- Nenhuma falha em aberto de severidade Crítica ou Alta.
- Resultados interpretados em `docs/relatorio-qualidade.md`.

---

## 8. Decisões centrais

| Decisão | Alternativas descartadas | Por quê |
| :--- | :--- | :--- |
| Rede de proteção dos fluxos críticos, e não cobertura máxima | Cobertura máxima; experimentação de ferramenta | Cobertura ampla sobre sistema instável produz suíte que quebra o tempo todo e que a squad aprende a ignorar — o pior resultado possível. |
| Runner nativo do Node + `fetch` | Jest/Vitest; biblioteca HTTP dedicada; ferramenta de baixo código | Sustenta o nível sem acrescentar **nenhuma** dependência. Coerente com a decisão de ferramenta da squad (Appium para E2E mobile + ferramenta complementar para API). |
| Autorização verificada no nível de serviço | Pela interface; nos dois níveis | A regra vive no servidor. Pela tela, 403 e 404 produzem a mesma mensagem — e essa distinção é a regra de maior consequência. |
| Oráculo em arquivo único (`data/contrato.js`) | Valores literais nos testes | Confirmar um item pendente com o back-end vira uma edição, em um lugar. |
| Duplo de referência do contrato no repositório | Nenhum alvo local; apontar só para o back-end | Sem alvo, a suíte não roda hoje e a entrega vira promessa. **Desvio consciente** do guia, que manda o SUT ficar fora da TAS: o SUT didático da disciplina não estava acessível para clonar. Mitigado por nome, pasta e avisos explícitos. |
| Defeitos injetáveis por variável de ambiente | Alterar o servidor à mão a cada verificação | Torna a verificação de sensibilidade **repetível e versionada**, em vez de um ajuste manual que alguém esquece de reverter. |

---

## 9. Política de manutenção

Quando um teste falha:

1. **Classificar** — defeito do SUT · defeito da TAS · ambiente · variação esperada.
2. Defeito do SUT → registrar e vincular ao caso de teste.
3. Defeito da TAS → item de manutenção, prazo de 3 dias.
4. Ambiente → registrar e verificar se afetou outros casos. `lib/http.js` já
   distingue "SUT inacessível" de falha de asserção.

**Proibido: reexecução automática.** Ela transforma a esteira num gerador de
falso verde, e o defeito intermitente real do produto deixa de ser visível.

**Remoção de teste**: só com registro de quem decidiu, quando, e qual risco foi
assumido em troca.

**Revisão a cada duas semanas**: testes que falharam sem defeito nas últimas 20
execuções; crescimento do tempo por estágio; duplicação entre casos; testes sem
rastreabilidade a uma HU ou a uma regra do contrato.
