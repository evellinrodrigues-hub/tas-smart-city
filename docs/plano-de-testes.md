# Plano de Testes — Suíte de API · Smart City / ResolveAí

**SUT:** API REST do Projeto Integrador Smart City (Flask/PostgreSQL)
**Nível:** sistema / serviço (API)
**Total automatizado:** **106 casos** — 98 de API + 8 de verificação da própria TAS.
Números atualizados após a execução contra o back-end real (ver
`docs/relatorio-qualidade.md`): a máquina de estados foi confirmada em 4
estados, não 5 (16 pares, não 25), e os payloads de HU-01/HU-06/HU-13 foram
ajustados ao formato real (campos em português, `username` em vez de `name`).

---

## 1. Endpoints contemplados

Todos os endpoints documentados na seção 6 do README do repositório
[PetersonNave/Smart-City](https://github.com/PetersonNave/Smart-City).

| # | Método | Rota | Contemplado | Casos |
| :-- | :--- | :--- | :--- | :--- |
| 1 | `POST` | `/auth/register` | Sim | C13–C18 |
| 2 | `POST` | `/auth/login` | Sim | C01–C04, C51 |
| 3 | `GET` | `/auth/me` | Sim | C05–C09, C48 |
| 4 | `PATCH` | `/auth/update` | Sim | A4 (3 perfis), A6 |
| 5 | `POST` | `/auth/refresh` | Sim | C10, C11 |
| 6 | `GET` | `/auth/logout` | Sim | C12 |
| 7 | `GET` | `/api/demandas` | Sim | C27–C32, A2 |
| 8 | `POST` | `/api/demandas` | Sim | C19–C26, A1 |
| 9 | `GET` | `/api/demandas/{id}` | Sim | C33–C35, A5 |
| 10 | `PATCH` | `/api/demandas/{id}` | Sim | C36–C40, A3 |
| 11 | `DELETE` | `/api/demandas/{id}` | Sim | C41–C46 |
| — | — | rota inexistente / método errado | Sim | C50, C51 |

**Cobertura: 11 de 11 endpoints documentados.**

---

## 2. O que é validado

| Dimensão pedida | Onde é verificada |
| :--- | :--- |
| Códigos de status HTTP | Todos os 106 casos de API |
| Estrutura e conteúdo das respostas | C19, C29, C35, C47–C49 |
| Headers relevantes | C47 (`content-type`), C48, C51 (`Allow`) |
| Parâmetros de entrada | C30–C32 (paginação e filtros) |
| Regras de negócio | C19, C36–C40 (máquina de estados), C41–C44 (exclusão por estado) |
| Dados inválidos ou ausentes | C04, C18, C25, C37, C39, C52 |
| Autenticação | C01–C12, C22, C45 |
| Autorização | A1–A6, C16, C23, C24, C42–C44 |
| Contrato da API | C20, C35, C47–C54 |

---

## 3. Relação dos cenários automatizados

### 3.1 HU-02 Autenticação e sessão — 12 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C01 | Login com credenciais válidas | 200 + `access_token` e `refresh_token` distintos |
| C02 | Login com senha incorreta | 401 `INVALID_CREDENTIALS` |
| C03 | Login de e-mail inexistente **não** difere de senha errada | mesmo status e mesmo `code` — impede enumeração de contas |
| C04 | Login sem campos obrigatórios | 400 `VALIDATION_ERROR` apontando `email` |
| C05 | Rota protegida sem token | 401 `UNAUTHENTICATED` |
| C06 | Token inexistente | 401 |
| C07 | `Authorization` sem o esquema `Bearer` | 401 |
| C08 | Perfil autenticado devolve o próprio usuário | 200, e-mail e perfil corretos |
| C09 | Nenhuma resposta de autenticação vaza senha ou hash | zero campos proibidos |
| C10 | Refresh renova o access token **e o novo token funciona** | 200 + token que autentica |
| C11 | Access token **não** serve como refresh token | 401 |
| C12 | Logout invalida o token da sessão | 200/204, e chamada seguinte 401 |

### 3.2 HU-01 Autocadastro — 10 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C13 | Cadastro com dados válidos | 201 com identificador |
| C14 | Conta recém-criada consegue autenticar | 200 no login |
| C15 | E-mail já cadastrado | 409 `EMAIL_ALREADY_REGISTERED` |
| C16 | **Cadastro não permite escolher o próprio perfil** | conta criada como `CITIZEN` mesmo pedindo `ADMIN` |
| C17 | Cadastro não devolve a senha enviada | zero campos proibidos |
| C18 | Cadastro recusado (5 variações: senha curta, e-mail inválido, e-mail/senha/nome ausentes) | 400 `VALIDATION_ERROR` apontando o campo certo |

### 3.3 HU-03 Autorização por perfil — 14 casos

Gerados da matriz em `data/matriz-autorizacao.js`.

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| A1 | `POST /api/demandas` por `CITIZEN` / `MANAGER` / `ADMIN` | 2xx / 403 / 403 |
| A2 | `GET /api/demandas` pelos três perfis | 2xx nos três |
| A3 | `PATCH /api/demandas/{id}` por `CITIZEN` / `MANAGER` | 403 / 2xx |
| A4 | `PATCH /auth/update` com `role` por `CITIZEN` / `MANAGER` / `ADMIN` | 403 / 403 / 2xx |
| A5 | **Demanda de terceiro responde 404 ao cidadão, não 403** | 404 — 403 confirmaria a existência e permitiria enumeração |
| A6 | Cidadão não promove a si próprio a gestor | 403 **e** perfil inalterado |
| — | Pendências de contrato registradas, não esquecidas | 3 perguntas abertas impressas a cada execução |

### 3.4 HU-06 Registro de demanda — 19 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C19 | Registro válido | 201, status inicial, categoria persistida, `resolvedAt` nulo |
| C20 | Formato do protocolo | casa `^DEM-\d{4}-\d{6}$` |
| C21 | Protocolos não se repetem | dois registros, dois protocolos distintos |
| C22 | Registro sem autenticação | 401 |
| C23 | **Mass assignment**: cliente envia `status`, `protocol`, `id` | todos ignorados pelo servidor |
| C24 | Autoria atribuída a quem registrou, não ao `author` enviado | autor = usuário autenticado |
| C25 | Registro recusado (10 variações) | 400 (ou **422** contra o back-end real, achado — ver `docs/relatorio-qualidade.md`) apontando o campo: categoria fora da lista, descrição curta/longa, localização curta, prioridade fora da lista, título curto/ausente, campos ausentes, corpo vazio |
| C26 | Valor limite aceito (3 variações) | 201 na fronteira inclusiva (descrição 10 e 500, localização 3 caracteres) |

### 3.5 HU-09 / HU-12 Consulta, isolamento e filtros — 9 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C27 | **Cidadão lista apenas as próprias demandas** — varrendo todas as páginas | nenhuma demanda de outro autor |
| C28 | Gestor enxerga demanda de qualquer cidadão | encontrada na listagem |
| C29 | Bloco de paginação do contrato | `page`, `pageSize`, `totalItems`, `totalPages` |
| C30 | `pageSize` limita a quantidade | `pageSize=1` devolve 1 item |
| C31 | Filtro por status | nenhum item fora do status |
| C32 | Filtro por categoria | nenhum item fora da categoria |
| C33 | Demanda inexistente | 404 `NOT_FOUND` |
| C34 | Identificador malformado | 400 ou 404, **nunca 500** |
| C35 | Detalhe expõe os campos do contrato | 7 campos presentes |

### 3.6 HU-13 Atualização de status e prioridade — 20 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C36 | **Os 16 pares da máquina de estados** (4 origens × 4 destinos) | 4 aceitas com 200 e status aplicado; **12 recusadas com 409** `INVALID_STATUS_TRANSITION` **e estado inalterado**. Modelo adaptado de 5 para 4 estados ao confirmar o enum real (`PENDING/IN_PROGRESS/RESOLVED/REJECTED`) — ver `data/contrato.js`. |
| C37 | Status fora da lista fechada | 400, não 409 |
| C38 | Gestor atualiza prioridade | 200 e prioridade aplicada |
| C39 | Prioridade fora da lista fechada | 400 |
| C40 | Resolução registra data de conclusão | `resolvedAt` preenchido |

### 3.7 HU-14 Exclusão de demanda — 6 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C41 | Cidadão exclui a própria demanda pendente | 200/204 **e** demanda deixa de existir |
| C42 | Cidadão não exclui a própria demanda fora de pendente | 403 **e** demanda preservada |
| C43 | Cidadão não exclui demanda de outro cidadão | 403/404 **e** demanda preservada |
| C44 | Gestor não exclui demanda já concluída | 403 **e** demanda preservada |
| C45 | Exclusão sem autenticação | 401 |
| C46 | Exclusão de id inexistente | 404 |

### 3.8 Contrato transversal — 8 casos

| ID | Cenário | Esperado |
| :-- | :--- | :--- |
| C47 | Sucesso declara `content-type: application/json` | tipo correto |
| C48 | Erro também é JSON, não HTML | corpo parseável + tipo correto |
| C49 | Todo erro traz `code` legível por máquina | `code` presente em 401, 400 e 404 |
| C50 | Rota inexistente | 404 com corpo JSON |
| C51 | Método não suportado em rota existente | 405 + header `Allow` |
| C52 | Corpo JSON malformado | 4xx, **nunca 500** |
| C53 | Nenhuma rota vaza credencial | zero campos proibidos em 3 rotas |
| C54 | Nenhum 5xx nos caminhos exercitados | zero respostas 5xx |

### 3.9 Verificação da própria TAS — 8 casos (sem rede)

| ID | Cenário |
| :-- | :--- |
| TAS-01 | A tabela de transições tem 16 pares, 4 permitidos e 12 recusados |
| TAS-02 | Repetir o status atual é recusado em todos os estados |
| TAS-03 | Estados finais não têm transição de saída |
| TAS-04 | Todo estado é alcançável a partir do inicial (senão o cenário não teria preparação possível) |
| TAS-05 | A massa válida satisfaz todas as regras do contrato |
| TAS-06 | `valida()` devolve instância nova a cada chamada |
| TAS-07 | Todo caso inválido aponta um campo que existe no contrato |
| TAS-08 | A matriz de autorização cobre os três perfis, sem célula sem veredito ou sem origem |

---

## 4. Critérios de entrada e de saída

**Entrada** — alvo respondendo (`npm run diagnostico` verde); os quatro usuários
de teste existentes com os perfis corretos.

**Saída** — 100% dos itens de risco alto executados; nenhuma falha aberta de
severidade Crítica ou Alta; resultados interpretados em
`docs/relatorio-qualidade.md`; verificação de sensibilidade sem ponto cego.

---

## 5. Riscos abertos

Ver `docs/tas.md`, seção 4. Em resumo: **R-02** (contrato de payload não
documentado) e **R-05** (suíte ainda não executada contra o back-end real) são
os dois que mais limitam o valor da informação produzida por esta suíte hoje.
