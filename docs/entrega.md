# Entrega — Automação de Testes de API

**Disciplina:** Testes Automatizados (ADS033) · 2026.2 · Turma ADS20262_5A
**Docente:** Hayanna Silva Oliveira
**Squad:** ResolveAí (Equipe 1) · **Entrega:** Unidade 1 — bloco prático
**Data:** 08/09/2026

---

## 1. Identificação do SUT

| Campo | Conteúdo |
| :--- | :--- |
| **SUT** | API REST do Projeto Integrador ** ResolveAí** — back-end Flask/PostgreSQL, compartilhado entre o cliente web e o app mobile. |
| **Repositório de referência do produto** | https://github.com/PetersonNave/Smart-City (cliente mobile Expo/React Native, que consome a mesma API) |
| **Documentação do contrato** | README do repositório acima, seções 6 a 8. A documentação Postman (`view/47073825/2sBXwvHTeT`) é renderizada por JavaScript e **não expõe o contrato** — ver seção 7. |
| **Nível de teste** | Sistema / serviço (API) |
| **Repositório desta TAS** | `tas-smart-city` (este) |

### Por que a API, e não o app

O repositório mobile está em estado de **scaffold**: 2 commits, `App.tsx` com
uma tela estática, sem navegação, sem camada de serviços e sem identificadores
de teste. Automatizar E2E sobre ele hoje seria automatizar o que não existe.
A API é o alvo real, é onde vivem as regras de negócio e de autorização, e é o
nível mais barato e mais estável para verificá-las. Decisão registrada em
`docs/tas.md`, seção 3.

---

## 2. Endpoints contemplados

**11 de 11 endpoints documentados.** Detalhe em `docs/plano-de-testes.md`, seção 1.

| Grupo | Endpoints |
| :--- | :--- |
| Autenticação | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `PATCH /auth/update` · `POST /auth/refresh` · `GET /auth/logout` |
| Demandas | `GET /api/demandas` · `POST /api/demandas` · `GET /api/demandas/{id}` · `PATCH /api/demandas/{id}` · `DELETE /api/demandas/{id}` |
| Transversal | rota inexistente · método não suportado · corpo malformado |

---

## 3. Relação dos cenários automatizados

**114 casos** — 106 de API + 8 de verificação da própria TAS.
Catálogo completo, caso a caso, em **`docs/plano-de-testes.md`, seção 3**.

| Grupo | Casos | Foco |
| :--- | :--- | :--- |
| HU-02 Autenticação e sessão | 12 | login, token, refresh, logout, enumeração de contas |
| HU-01 Autocadastro | 10 | validações, e-mail duplicado, **escalonamento de privilégio** |
| HU-03 Autorização por perfil | 14 | matriz rota × perfil, **403 × 404**, autopromoção |
| HU-06 Registro de demanda | 18 | caminho feliz, **mass assignment**, 9 validações, 3 valores limite |
| HU-09/12 Consulta e filtros | 9 | **isolamento entre cidadãos**, paginação, filtros |
| HU-13 Atualização de status | 29 | **os 25 pares da máquina de estados**, prioridade |
| HU-14 Exclusão | 6 | restrição por estado e por autoria |
| Contrato transversal | 8 | mídia, `code`, 405, corpo malformado, vazamento, 5xx |
| Verificação da TAS | 8 | coerência do próprio oráculo, sem rede |

### Tipos de cenário cobertos

- **Fluxos esperados** — caminho feliz de cada endpoint.
- **Erro e exceção** — 400, 401, 403, 404, 405, 409; corpo malformado; id malformado; 5xx como achado.
- **Casos de borda** — valor limite inclusivo (descrição de 20 e 1000 caracteres, latitude −90); repetição do status atual; protocolos duplicados; token trocado entre access e refresh.
- **Condições negativas de segurança** — escalonamento de privilégio no cadastro, autopromoção, mass assignment, enumeração de contas por resposta de login, enumeração de recursos por 403, vazamento de credencial em qualquer rota.

---

## 4. Código-fonte

Repositório completo, zero dependências externas.

```
tas-smart-city/
├── README.md                      como começar, executar e onde colocar arquivo novo
├── package.json                   comando único: npm test
├── .gitignore .env.example        (.env nunca versionado)
├── docs/
│   ├── entrega.md                 este documento
│   ├── tas.md                     decisões, riscos, backlog, pipeline, manutenção
│   ├── plano-de-testes.md         catálogo dos 114 cenários
│   └── relatorio-qualidade.md     resultados e interpretação
├── lib/           http.js · config.js · inspecao.js · diagnostico.js
├── api/           smart-city.js
├── data/          contrato.js (ORÁCULO) · demandas.js · usuarios.js · matriz-autorizacao.js
├── tests/
│   ├── unidade/   oraculo.test.js                      (8 casos, sem rede)
│   └── api/       8 arquivos por história             (106 casos)
├── sut-referencia/ server.js                           duplo do contrato — NÃO é o SUT
├── scripts/       sensibilidade.js
├── evidencias/    execucao-limpa.txt · sensibilidade.txt
└── .github/workflows/testes.yml
```

**Arquitetura em três camadas**, com dependência em sentido único
(`tests/ → api/ → lib/` e `tests/ → data/`): nenhuma asserção fora de
`tests/`, nenhum dado literal dentro de teste, nenhuma credencial versionada.

---

## 5. Configuração e execução

Instruções completas no `README.md`. Em resumo:

```bash
# Pré-requisito: Node >= 20.11.0. Nenhuma dependência a instalar.

# terminal 1 — sobe o alvo local
npm run sut:referencia

# terminal 2
npm run diagnostico     # diz CONTRA QUEM a suíte vai falar
npm test                # 114 casos, comando único
```

Contra o back-end real — **nenhum arquivo de teste muda**:

```bash
BASE_URL=http://localhost:5000 npm test
```

| Comando | Função |
| :--- | :--- |
| `npm test` | suíte completa |
| `npm run test:api` / `test:unidade` | suítes isoladas, para a esteira |
| `npm run test:relatorio` | grava `evidencias/resultado.xml` (JUnit) |
| `npm run diagnostico` | alvo, rotas e usuários de teste |
| `npm run sensibilidade` | injeta 6 defeitos e confere a detecção |

---

## 6. Evidências

| Evidência | Onde |
| :--- | :--- |
| Execução limpa, 114/114 | `evidencias/execucao-limpa.txt` |
| Verificação de sensibilidade | `evidencias/sensibilidade.txt` |
| Relatório JUnit | `evidencias/resultado.xml` (via `npm run test:relatorio`) |
| Esteira com gate e publicação de artefatos | `.github/workflows/testes.yml` |

**Resultado da execução limpa**

```
ℹ tests 114
ℹ pass 114
ℹ fail 0
ℹ duration_ms 3100.6738
```

**Estabilidade** — 4 execuções consecutivas: 114/114 nas quatro (3,08 s a 3,19 s).
Nenhum teste intermitente.

**Sensibilidade** — 6 defeitos injetados, **0 pontos cegos**. O defeito
cirúrgico na tabela de transições derrubou **exatamente 1 caso**, e o nome dele
identifica a transição quebrada sem abrir o código.

---

## 7. Análise dos resultados

Análise completa em `docs/relatorio-qualidade.md`. Os quatro pontos que
importam:

**1. A taxa de 100% não é a informação principal, e sozinha seria enganosa.**
Ela foi obtida contra o duplo de referência do contrato, escrito pela própria
squad. Ela demonstra que **a suíte funciona** — não diz nada sobre a API Flask,
que ainda não foi exercitada por ela. Executar contra o back-end real é item
bloqueante do backlog.

**2. Foram encontrados 2 defeitos — na própria TAS, não no SUT.** O segundo é o
mais relevante da entrega:

- **TAS-D01**: um caso passava na 1ª execução e reprovava a partir da 2ª, por
  procurar a demanda apenas na primeira página da listagem.
- **TAS-D02**: o caso de **isolamento entre cidadãos** afirmava a *ausência* da
  demanda alheia olhando só a primeira página. Uma demanda vazada na página 2
  produziria **verde** — um teste de isolamento aprovando exatamente o
  vazamento que existia para impedir. Falso negativo, o pior defeito possível
  numa suíte, e ele **não aparecia como vermelho**: foi encontrado ao investigar
  o TAS-D01. Corrigido varrendo toda a paginação antes de afirmar ausência.

**3. O contrato de payload não está documentado.** A documentação oficial no
Postman é renderizada por JavaScript e devolve apenas o título "Smart City
Documentation". O README cobre rotas, métodos e regras de autorização — não
cobre payloads, códigos de erro, enum de status nem limites de campo. Esses
valores foram transcritos do contrato didático *Cidade Conectada* e estão
marcados `[B]` em `data/contrato.js`, num único lugar. **São hipótese
declarada, não verdade**: enquanto não forem confirmados, uma divergência de
execução pode estar no back-end, no teste **ou no próprio contrato**.

**4. Três células da matriz de autorização não são decididas pelo README** e
**não foram inventadas**. Ficam registradas e são impressas a cada execução:

- ADMIN pode atualizar status/prioridade de demanda, ou apenas promover usuários?
- ADMIN pode excluir demanda concluída, ou a restrição do MANAGER vale para ele?
- Há isolamento por setor entre gestores? O cenário TS16 da squad pressupõe que
  sim; o README diz "qualquer demanda", o que o contradiz.

### Limitações declaradas

- A suíte não exerceu o SUT real (bloqueante).
- Parte do oráculo é hipótese.
- Nada do app mobile é verificado.
- Os 25 pares da máquina de estados estão no nível de serviço, e não de
  componente, por indisponibilidade técnica — dívida consciente, item 1 do
  backlog.

---

## 8. Squad e contribuições

**Equipe 1 — ResolveAí** · CESAR School · ADS 5º período

> **A preencher pela equipe antes do envio.** Os nomes abaixo vêm dos
> documentos da squad; **as contribuições individuais não foram preenchidas
> por quem redigiu este repositório, porque só os integrantes sabem quem fez o
> quê.** Registro de autoria inventado não é rastreabilidade.

| Integrante | E-mail | Papel declarado | Contribuição nesta atividade |
| :--- | :--- | :--- | :--- |
| André Felipe da Silva Braga | afsb@cesar.school | — | *a preencher* |
| Dayvid Cristiano | dcvs2@cesar.school | — | *a preencher* |
| Deyvison Conrado | dmc2@cesar.school | — | *a preencher* |
| Evellin Rodrigues | evellin.rodrigues@sportrecife.com.br | Base em TS/JS e Python (doc. de ferramentas) | *a preencher* |
| Jennifer Cristine | jclc2@cesar.school | — | *a preencher* |
| Letícia Gabriella | lgcs@cesar.school | — | *a preencher* |
| Levi Moraes | lmma@cesar.school | **QA Team**; acompanha reavaliação da decisão de ferramenta | *a preencher* |
| Luis Henrique Facunde da Silva | lhfs@cesar.school | Base em TS/JS e Python | *a preencher* |
| Manuele Macêdo | mmps2@cesar.school | — | *a preencher* |
| Maria Aparecida | maers@cesar.school | **QA Team**; acompanha reavaliação da decisão de ferramenta | *a preencher* |
| Peterson Jesus Feitosa de Melo | pjfm@cesar.school | Mantém o repositório mobile (SUT) | *a preencher* |
| Rhaldney Robert | rrcd@cesar.school | **QA Team**; base em TS/JS e Python | *a preencher* |
| Victor César Matias da Silva | vcms@cesar.school | — | *a preencher* |

**Divergência a resolver:** a lista oficial "Equipe 1 – 19/08" traz 12
integrantes e **não inclui Evellin Rodrigues**, que aparece na tabela de
comparação de ferramentas como integrante da equipe de escrita dos testes. É
preciso alinhar a composição antes do envio.

**Distribuição de commits:** o histórico do Git é a evidência exigida. Recomenda-se
que cada integrante faça os commits das partes pelas quais respondeu, em vez de
um envio único.

---

## 9. Uso de IA

| Onde a IA foi usada | O que foi verificado por pessoas |
| :--- | :--- |
| Análise dos documentos do projeto e do contrato; identificação de cenários, casos de borda e condições negativas. | Cada cenário foi rastreado a uma regra do README do Smart-City ou marcado como hipótese `[B]`. Nada entrou na suíte sem origem declarada. |
| Primeiro rascunho dos scripts e da estrutura em camadas. | **Toda a suíte foi executada**: 114 casos verdes, 4 execuções consecutivas, contra alvo real em execução. |
| Revisão da organização e legibilidade do código. | Regra de dependência conferida arquivo a arquivo: nenhuma asserção fora de `tests/`, nenhum dado literal em teste, nenhuma credencial em código. |
| Análise dos erros de execução. | Os 2 defeitos da TAS foram **diagnosticados até a causa** antes de qualquer correção, e a correção foi validada por reexecução. |
| Sugestão de melhorias de cobertura. | Cada sugestão foi confrontada com o contrato; as que dependiam de regra inexistente (ex.: *rate limiting* em login) **não** viraram teste — foram para o backlog como pergunta. |

**Verificações críticas realizadas**

- **Recursos que não existem:** o contrato de payload foi buscado na fonte
  oficial (Postman) antes de qualquer transcrição. A fonte não respondeu, e
  isso foi registrado como pendência em vez de preenchido por plausibilidade.
- **Oráculo:** conferido que nenhum teste importa a regra do objeto testado. O
  oráculo vem de `data/contrato.js`, escrito a partir da especificação.
- **Alucinação por plausibilidade:** valores não documentados (categorias,
  status, códigos de erro, limites) estão marcados `[B]` e não são apresentados
  como contrato confirmado.
- **Nível de evidência:** **E1** para o comportamento da suíte (executada sobre
  o próprio projeto). **Não há evidência E1 sobre o back-end real** — essa é a
  limitação principal desta entrega, e está declarada em todos os documentos.
