# Entrega — Automação de Testes de API

**Disciplina:** Testes Automatizados (ADS033) · 2026.2 · Turma ADS20262_5A
**Docente:** Hayanna Silva Oliveira
**Squad:** ResolveAí (Equipe 1) · **Entrega:** Unidade 1 — bloco prático
**Data:** 09/09/2026

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

**106 casos** — 98 de API + 8 de verificação da própria TAS.
Catálogo completo, caso a caso, em **`docs/plano-de-testes.md`, seção 3**.
(Números ajustados nesta entrega após a execução contra o back-end real —
ver seção 6 e `docs/relatorio-qualidade.md`.)

| Grupo | Casos | Foco |
| :--- | :--- | :--- |
| HU-02 Autenticação e sessão | 12 | login, token, refresh, logout, enumeração de contas |
| HU-01 Autocadastro | 10 | validações, e-mail duplicado, **escalonamento de privilégio** |
| HU-03 Autorização por perfil | 14 | matriz rota × perfil, **403 × 404**, autopromoção |
| HU-06 Registro de demanda | 19 | caminho feliz, **mass assignment**, 10 validações, 3 valores limite |
| HU-09/12 Consulta e filtros | 9 | **isolamento entre cidadãos**, paginação, filtros |
| HU-13 Atualização de status | 20 | **os 16 pares da máquina de estados**, prioridade |
| HU-14 Exclusão | 6 | restrição por estado e por autoria |
| Contrato transversal | 8 | mídia, `code`, 405, corpo malformado, vazamento, 5xx |
| Verificação da TAS | 8 | coerência do próprio oráculo, sem rede |

### Tipos de cenário cobertos

- **Fluxos esperados** — caminho feliz de cada endpoint.
- **Erro e exceção** — 400, 401, 403, 404, 405, 409; corpo malformado; id malformado; 5xx como achado.
- **Casos de borda** — valor limite inclusivo (descrição de 10 e 500 caracteres, localização com 3 caracteres); repetição do status atual; protocolos duplicados; token trocado entre access e refresh.
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
│   ├── plano-de-testes.md         catálogo dos 106 cenários
│   └── relatorio-qualidade.md     resultados e interpretação
├── lib/           http.js · config.js · inspecao.js · diagnostico.js
├── api/           smart-city.js
├── data/          contrato.js (ORÁCULO) · demandas.js · usuarios.js · matriz-autorizacao.js
├── tests/
│   ├── unidade/   oraculo.test.js                      (8 casos, sem rede)
│   └── api/       8 arquivos por história             (98 casos)
├── sut-referencia/ server.js                           duplo do contrato — NÃO é o SUT
├── scripts/       sensibilidade.js
├── evidencias/    execucao-limpa.txt · resultado-backend-real.txt · sensibilidade.txt
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
npm test                # 106 casos, comando único
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
| Execução contra o duplo de referência, 106/106 | `evidencias/execucao-limpa.txt` |
| **Execução contra o back-end real do Projeto Integrador** | `evidencias/resultado-backend-real.txt` |
| Verificação de sensibilidade | `evidencias/sensibilidade.txt` |
| Relatório JUnit | `evidencias/resultado.xml` (via `npm run test:relatorio`) |
| Esteira com gate e publicação de artefatos | `.github/workflows/testes.yml` |

**Resultado contra o duplo de referência:** 106/106, 100%.

**Resultado contra o back-end real:** ver `evidencias/resultado-backend-real.txt`
e a análise completa em `docs/relatorio-qualidade.md`. Resumo: a suíte
encontrou **8 defeitos de severidade alta** (3 com implicação de segurança) e
**4 divergências de contrato** no back-end real — isto é o resultado esperado
de uma suíte de API funcionando contra um produto ainda em desenvolvimento, e
é o item que faltava nas entregas anteriores.

**Sensibilidade** — 6 defeitos injetados, **0 pontos cegos**, repetido contra
o contrato ajustado desta entrega.

---

## 7. Análise dos resultados

Análise completa em `docs/relatorio-qualidade.md`. Os pontos que importam:

**1. A suíte agora exerceu o SUT real, e não só o duplo de referência.** Essa
era a ressalva bloqueante das entregas anteriores. A primeira tentativa deu
26/114 — não por defeito do produto, mas porque o oráculo (`data/contrato.js`)
havia sido construído a partir do SUT didático da disciplina, e a API real do
Smart City usa um formato de payload totalmente diferente (campos em
português, 4 estados em vez de 5, perfis em minúsculo). Depois de ajustar a
suíte a esse formato — sem tocar em nenhuma regra de negócio sob teste — o
resultado foi 50/106, com a outra metade das reprovações sendo achado real,
não bug da suíte.

**2. Oito defeitos de severidade alta foram encontrados, três com implicação
de segurança:** login inválido responde 500; um access token serve como
refresh token indefinidamente; qualquer usuário se autopromove a gestor via
`PATCH /auth/update`, porque o endpoint não verifica permissão nenhuma nesse
campo e nem tem conceito de "usuário alvo" (a única função documentada dele —
admin promover outra pessoa — não funciona como descrito). Também: gestor e
admin conseguem criar demanda (deveria ser só cidadão); demanda de outro
cidadão responde 403 em vez de 404 (permite enumeração); gestor exclui
demanda concluída (README proíbe); e não existe nenhuma validação de
transição de status — os 12 pares que deveriam ser recusados foram todos
aceitos. Detalhe de cada um, com a linha de código correspondente, em
`docs/relatorio-qualidade.md` seção 3.

**3. Nenhuma resposta de erro do back-end real tem campo `code`.** Só
`message` (texto em português) e `status_code`. Isso confirma, com o produto
real, exatamente por que a convenção da suíte ("nunca assertar sobre
mensagem, sempre sobre código") existe — e mostra que ela não pode ser
seguida contra este back-end como está hoje.

**4. O contrato de payload não estava documentado, e agora está confirmado
por leitura do código-fonte real** (não é mais hipótese do SUT didático). Os
blocos `[C]` em `data/contrato.js` marcam o que foi confirmado assim; os
blocos `[B]` continuam sendo hipótese de regra de negócio, nunca copiados do
comportamento observado no back-end — copiar tornaria a suíte incapaz de
detectar os próprios defeitos que ela encontrou.

**5. Três células da matriz de autorização continuam sem resposta
documentada** (seção 4 de `docs/relatorio-qualidade.md`) — não foram
inventadas.

### Limitações declaradas

- O achado de autopromoção (item 2) altera o perfil da conta de teste `ana`
  quando o caso é exercitado; a suíte reverte isso pela própria API antes de
  declarar o caso reprovado, mas quem rodar a suíte contra um ambiente
  compartilhado deve estar avisado desse efeito colateral.
- Parte do oráculo de regra de negócio (a máquina de estados de 4 estados)
  é hipótese adaptada, não confirmada por documentação — os 8 defeitos da
  seção 3.1 do relatório de qualidade, porém, foram confirmados por leitura
  direta do código do back-end, não por suposição.
- Nada do app mobile é verificado.
- Rate limiting em login não é verificado — a regra não existe no contrato.

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
| Primeiro rascunho dos scripts e da estrutura em camadas. | **Toda a suíte foi executada duas vezes**: 106/106 contra o duplo de referência, e contra o back-end real do Projeto Integrador (resultado e achados em `evidencias/resultado-backend-real.txt` e `docs/relatorio-qualidade.md`). |
| Ajuste do oráculo e da suíte ao formato real do back-end, depois da primeira execução contra ele revelar incompatibilidade de payload. | Cada ajuste foi conferido contra o código-fonte do back-end (`schemas/*.py`), e limitado a fatos de **formato** (nomes de campo, enums, limites) — nunca a regras de negócio sob teste. Marcado `[C]` em `data/contrato.js`, distinto de `[A]`/`[B]`. |
| Revisão da organização e legibilidade do código. | Regra de dependência conferida arquivo a arquivo: nenhuma asserção fora de `tests/`, nenhum dado literal em teste, nenhuma credencial em código. |
| Análise dos erros de execução contra o back-end real. | Cada uma das 57 reprovações da primeira rodada foi classificada individualmente contra o código-fonte real como defeito confirmado, divergência de contrato, ou efeito do formato de payload — nunca aceita por suposição. Resultado: 8 defeitos de severidade alta, 4 divergências de contrato (seção 3, `docs/relatorio-qualidade.md`). |
| Sugestão de melhorias de cobertura. | Cada sugestão foi confrontada com o contrato; as que dependiam de regra inexistente (ex.: *rate limiting* em login) **não** viraram teste — foram para o backlog como pergunta. |

**Verificações críticas realizadas**

- **Recursos que não existem:** o contrato de payload foi buscado na fonte
  oficial (Postman) antes de qualquer transcrição; a fonte não respondeu. Na
  ausência dela, os fatos de formato foram confirmados por leitura direta do
  código-fonte do back-end real (`ndrfelipe/smart-city`), não por suposição —
  e cada um está marcado `[C]` com o arquivo de origem.
- **Oráculo:** conferido que nenhuma REGRA DE NEGÓCIO sob teste foi copiada do
  comportamento do back-end. Ler o código para saber que formato ele aceita é
  diferente de aceitar o que ele faz como "correto" — isso tornaria a suíte
  incapaz de detectar os próprios defeitos que ela encontrou (seção 3 do
  relatório de qualidade). A distinção está documentada no cabeçalho de
  `data/contrato.js`.
- **Alucinação por plausibilidade:** valores de regra de negócio não
  documentados (matriz de autorização, máquina de estados) continuam
  marcados `[B]`, hipótese, mesmo depois de ler o código real.
- **Nível de evidência:** **E1** para o comportamento da suíte contra os dois
  alvos (duplo de referência e back-end real). A limitação que restava nas
  entregas anteriores — nenhuma evidência E1 sobre o produto — **foi resolvida
  nesta entrega**.
