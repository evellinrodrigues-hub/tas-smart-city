# Relatório de qualidade — Suíte de API Smart City

**Entrega:** Unidade 1 · **Squad:** ResolveAí · **Data:** 09/09/2026
**Alvos desta execução:** duplo de referência do contrato (`http://localhost:5050`)
**e** back-end Flask real do Projeto Integrador (`http://127.0.0.1:5000`)
**Ambiente:** Node v25.9.0 · macOS · Python 3.13 · PostgreSQL 16 (local)

---

## 1. Situação da suíte

| Suíte | Alvo | Casos | Aprovados | Reprovados | Taxa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `unidade` (verificação da TAS) | — (sem rede) | 8 | 8 | 0 | 100% |
| `api` | duplo de referência | 98 | 98 | 0 | 100% |
| `api` | **back-end real (Flask)** | 98 | **42** | **56** | **~43%** |
| **Total** | back-end real | **106** | **50** | **56** | **~47%** |

A suíte foi ajustada nesta entrega para falar com o back-end real (ver seção 2)
depois que a primeira tentativa mostrou uma incompatibilidade total de formato
de payload. Depois do ajuste, quase metade dos casos passa — e a outra metade
**não é falha da suíte**: é achado real sobre a API, detalhado na seção 3.

---

## 2. O que mudou nesta entrega: de "nunca rodou contra o SUT real" para "rodou, e encontrou defeitos"

A primeira execução contra o back-end real (antes de qualquer ajuste) deu
**26 de 114 casos aprovados**. A causa dominante não era defeito do produto:
era o formato de payload que a suíte enviava. O oráculo (`data/contrato.js`)
havia sido construído com base no SUT didático "Cidade Conectada" (Material de
Estudo ADS033) — a única fonte com contrato de payload fechado — porque a
documentação Postman do produto real não renderiza e o README não cobre
payloads. Essa hipótese, marcada `[B]` desde o início, era razoável, mas a API
real do Smart City **não segue esse modelo**: é uma implementação Flask
própria, mais simples e independente.

**Divergências de formato confirmadas e corrigidas na suíte** (fatos de
transporte, não regras de negócio — ver o cabeçalho de `data/contrato.js` para
a distinção `[A]`/`[B]`/`[C]`):

| Item | Suíte assumia | API real usa |
| :--- | :--- | :--- |
| Campos da demanda | `category`, `description`, `location` (objeto lat/long/região), inglês | `categoria`, `descricao`, `localizacao` (texto livre), `titulo` obrigatório, `prioridade` obrigatória na criação — português |
| Estados da demanda | 5: `RECEIVED/UNDER_ANALYSIS/IN_PROGRESS/RESOLVED/REJECTED` | 4: `PENDING/IN_PROGRESS/RESOLVED/REJECTED` |
| Prioridades | `LOW/MEDIUM/HIGH` | `baixa/media/alta/urgente` |
| Perfil de usuário | `CITIZEN/MANAGER/ADMIN` | `cidadao/gestor/admin` |
| Cadastro | campo `name`, senha mín. 8 | campo `username`, senha mín. 6 |
| Paginação (parâmetro) | `pageSize` | `per_page` |

Depois do ajuste, a suíte passou de 26/114 para **50/106** (o total de casos
caiu de 114 para 106 porque o modelo de 4 estados tem 16 pares de transição, e
não 25). Os 57 casos que ainda reprovavam foram revisados um a um contra o
código-fonte do back-end (`ndrfelipe/smart-city`) para separar **defeito real
da API** de **hipótese de contrato ainda não confirmada**. Um ajuste adicional
(usar `role: 'gestor'` em vez de `'admin'` no caso de escalonamento de
privilégio de cadastro — `'admin'` nem é um valor aceito pelo schema de
registro real) corrigiu mais 1 caso, chegando ao número final registrado em
`evidencias/resultado-backend-real.txt`: **50 aprovados, 56 reprovados**, dos
106 casos totais (98 de API + 8 de verificação da própria TAS, que não
depende de rede e continua 8/8).

**Importante sobre método**: o ajuste acima ficou estritamente no nível de
**formato** (nomes de campo, enums de valor aceitos, limites de tamanho) —
nunca no nível de **regra de negócio**. A suíte não foi ajustada para
concordar com o comportamento do back-end onde esse comportamento é
justamente o que está sob teste (autorização, máquina de estados, exclusão).
Fazer isso tornaria a suíte tautológica: passaria mesmo com a regra errada.

---

## 3. Defeitos e divergências confirmados no back-end real

### 3.1 Defeitos de severidade alta

| ID | Achado | Evidência |
| :--- | :--- | :--- |
| **D-01** | **Login com credencial inválida responde 500**, não 401. `services/auth_service.py` lança `ValueError`, que o controller não trata — cai no handler genérico de exceção. | `HU-02 C02`, `C03`; `CT C54` |
| **D-02** | **Token de acesso funciona como refresh token.** O JWT não tem campo que distinga tipo de token; `/auth/refresh` aceita qualquer token válido não usado. Um access token (validade de 1h) pode renovar a sessão indefinidamente. | `HU-02 C11` |
| **D-03** | **Qualquer usuário autenticado se autopromove a `gestor`** via `PATCH /auth/update` enviando `{"role": "gestor"}`. Não há checagem de permissão nenhuma nesse campo. Escalonamento de privilégio confirmado e reproduzido. | `HU-03 A6` |
| **D-04** | **`PATCH /auth/update` não tem conceito de "usuário alvo".** O endpoint sempre edita quem está autenticado, ignorando qualquer `email` no corpo. Isso significa que a única função documentada do endpoint (README 8.2: "ADMIN promove usuários para Gestor") **é impossível de executar como descrito** — o mais perto que se chega é o admin alterar o próprio perfil. Se o `email` enviado colidir com o de outra conta (por tentar, sem saber, "apontar" para outro usuário), a atualização quebra com **500** por violar a unicidade de e-mail no banco, em vez de recusar com 400/409. | `HU-03 A4-cidadao/A4-admin` |
| **D-05** | **Gestor e Admin também conseguem criar demanda.** `POST /api/demandas` não restringe a `CITIZEN`, como o README diz. | `HU-03 A1-gestor`, `A1-admin` |
| **D-06** | **Demanda de outro cidadão responde 403, não 404.** Confirma exatamente o risco de enumeração que o caso foi desenhado para detectar: 403 revela que o recurso existe. | `HU-03 A5` |
| **D-07** | **Gestor exclui demanda já concluída.** README 8.2 diz que não pode; o código (`services/demandas_service.py`) restringe exclusão por estado só para `CITIZEN`. | `HU-14 C44` |
| **D-08** | **Não existe máquina de estados.** Dos 12 pares de transição que deveriam ser recusados com 409, os 12 foram aceitos com 200. `atualizar_demanda` aplica qualquer status da lista fechada, de qualquer estado atual, sem nenhuma validação de transição. | `HU-13 C36`, todos os 12 pares "recusada" |

### 3.2 Divergências de contrato (média severidade)

| ID | Achado | Evidência |
| :--- | :--- | :--- |
| D-09 | Nenhuma resposta de erro tem campo `code` legível por máquina — só `message` (texto em português) e `status_code`. Isso invalida, contra este back-end, a convenção "nunca assertar sobre mensagem" adotada pela suíte, porque não há outra coisa machine-readable para assertar. | `CT C49` e em cascata em ~15 outros casos |
| D-10 | E-mail duplicado no cadastro responde 400, não 409. | `HU-01 C15` |
| D-11 | Resposta 405 não traz o header HTTP `Allow` — só informa os métodos aceitos dentro do corpo JSON. | `CT C51` |
| D-12 | Erro de validação em `/auth/register` responde 400; erro de validação em `/api/demandas` (criação e atualização) responde **422**. Duas rotas, mesma classe de erro, convenções diferentes. | `HU-06 C25`, `HU-13 C37`/`C39` |

### 3.3 Conceitos hipotéticos que não existem na API real
`protocol` (a demanda tem só `id` numérico), `author` na resposta da demanda,
`resolvedAt`, e os nomes de campo do bloco de paginação (`paginas`/
`pagina_atual`/`por_pagina`, não `totalPages`/`page`/`pageSize`). Eram
hipóteses `[B]`, vindas do SUT didático — a ausência confirmada é o próprio
achado, e por isso os casos que checam esses campos foram mantidos como estão
(reprovam contra o real, passam contra o duplo de referência).

---

## 4. Pendências de contrato ainda sem resposta
Três perguntas que nenhuma fonte documental decide, registradas em
`data/matriz-autorizacao.js` e impressas a cada execução (`HU-03`, caso
"pendências de contrato"):

1. ADMIN pode atualizar status/prioridade de demanda, ou só promove usuários?
   *(Achado D-04 sugere que, na prática atual, admin não tem nenhum privilégio
   especial sobre demandas — mas isso é o comportamento hoje, não uma
   confirmação de que é o comportamento pretendido.)*
2. ADMIN pode excluir demanda concluída?
3. Há isolamento por setor entre gestores (cenário TS16 dos casos de teste da
   squad)? Não encontramos essa resposta em nenhum material da disciplina
   disponível para esta análise — só quem escreveu o TS16 sabe a intenção.

---

## 5. Sensibilidade — a suíte sabe ficar vermelha?
Repetido contra o duplo de referência (que segue o contrato ajustado nesta
entrega): 6 defeitos conhecidos injetados, **0 pontos cegos**. Ver
`evidencias/sensibilidade.txt` para o detalhe caso a caso — a lógica não
mudou, só os nomes de estado usados nos defeitos `transicao-extra` e
`status-inicial`, adaptados ao modelo de 4 estados.

---

## 6. Recomendação sobre a entrega

**Pode seguir.** Diferente da rodada anterior, esta entrega tem evidência de
verdade sobre o produto: a suíte rodou contra o back-end real, e encontrou
**8 defeitos de severidade alta** (3 deles com implicação de segurança —
D-02, D-03, D-04) e **4 divergências de contrato**. Isso é o resultado
esperado de uma suíte de API bem-feita rodando contra um back-end ainda em
desenvolvimento — não um sinal de que a suíte está errada.

**Ressalvas que continuam valendo:**
1. **Achado D-03 (autopromoção) altera dados reais quando exercitado.** A
   suíte roda esse caso de propósito, contra a conta de teste `ana`, e a
   reverte por meio da própria API antes de declarar o caso reprovado. Rodar a
   suíte contra um ambiente compartilhado (não local) exige atenção a esse
   efeito colateral.
2. **Parte do oráculo de regra de negócio continua sendo hipótese** (a máquina
   de estados de 4 estados foi adaptada, não confirmada por documentação) —
   mas isso não compromete os 8 defeitos da seção 3.1, que foram confirmados
   por leitura direta do código do back-end, não por suposição.
3. **As 3 pendências da seção 4 continuam sem resposta.**
