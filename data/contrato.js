/**
 * data/contrato.js - O ORACULO DA SUITE
 *
 * Este arquivo e a transcricao do contrato da API. Nenhum teste deve importar
 * regras do SUT: o resultado esperado vem SEMPRE daqui, e daqui vem sempre da
 * especificacao. Se um teste comparasse o SUT consigo mesmo, passaria mesmo com
 * a regra errada.
 *
 * PROVENIENCIA DE CADA BLOCO (declarada de proposito, porque nao e uniforme):
 *
 *  [A] CONFIRMADO - Documentado no README do repositorio
 *      PetersonNave/Smart-City (ndrfelipe/smart-city), secoes 6 (endpoints),
 *      7 (metodos HTTP) e 8.2 (regras de autorizacao por role).
 *
 *  [B] HIPOTESE DE REGRA DE NEGOCIO - nao documentada em nenhuma fonte
 *      acessivel da squad, e por isso continua sendo HIPOTESE mesmo depois de
 *      termos acesso ao codigo do back-end real. Ler o codigo para saber "o
 *      que ele faz" e diferente de aceitar isso como "o que ele deveria
 *      fazer": se copiassemos a regra do proprio SUT, o teste passaria mesmo
 *      com a regra errada, e essa e exatamente a pergunta que o teste existe
 *      para fazer. Onde nao ha fonte melhor, o valor foi transcrito (ou
 *      adaptado) do contrato do SUT didatico "Cidade Conectada" (Material de
 *      Estudo ADS033, cap. 4 a 6).
 *
 *  [C] CONFIRMADO NO CODIGO-FONTE DO BACK-END REAL (schemas/*.py) - usado
 *      SOMENTE para fatos de FORMATO: nomes de campo, quais valores um enum
 *      aceita, limites de tamanho. Sem isso a suite nem consegue montar uma
 *      requisicao que a API entenda - nao ha fonte de documentacao melhor
 *      (Postman nao renderiza, README nao cobre payload). NUNCA usado para
 *      decidir se uma REGRA DE NEGOCIO esta certa: isso e sempre [A] ou [B].
 *
 * TODO ITEM [B] E RISCO DECLARADO, NAO VERDADE. Ver docs/tas.md, secao 4
 * (riscos R-02 e R-03). Ao confirmar um valor com a equipe de back-end, mude
 * AQUI e em nenhum outro lugar: nenhum arquivo de teste tem valor literal.
 */

// [A]/[C] Perfis de usuario. README secao 8.2 descreve o papel; o codigo
// (models/user.py, valores gravados em users.role) confirma a grafia exata.
const PERFIS = {
  CIDADAO: 'cidadao',
  GESTOR: 'gestor',
  ADMIN: 'admin',
};

// [C] schemas/demandas_schema.py, CATEGORIAS_VALIDAS.
const CATEGORIAS = [
  'ROAD_MAINTENANCE',
  'PUBLIC_LIGHTING',
  'GARBAGE_COLLECTION',
  'SANITATION',
  'INSPECTION',
  'OTHER',
];

// [C] schemas/demandas_schema.py, STATUS_VALIDOS: 4 estados. O modelo
// didatico de 5 estados (RECEIVED/UNDER_ANALYSIS/IN_PROGRESS/RESOLVED/
// REJECTED) NAO existe nesta API - nao ha "em analise" separado de "aberta".
const STATUS = {
  PENDENTE: 'PENDING',
  EM_ANDAMENTO: 'IN_PROGRESS',
  RESOLVIDA: 'RESOLVED',
  REJEITADA: 'REJECTED',
};

const ESTADOS = Object.values(STATUS);

// [C] Toda demanda nasce com status='aberto' no banco (services/
// demandas_service.py); o schema de resposta mapeia 'aberto' -> 'PENDING'.
const STATUS_INICIAL = STATUS.PENDENTE;

// [B] Estados finais: demanda concluida. Hipotese, nao documentada.
const ESTADOS_FINAIS = [STATUS.RESOLVIDA, STATUS.REJEITADA];

/**
 * [B] HIPOTESE ADAPTADA, nao confirmada por nenhuma fonte (nem README, nem o
 * SUT didatico, cujo modelo tinha 5 estados). Mantem o mesmo DESENHO da
 * hipotese anterior - avanco unico, sem volta, estados finais sem saida -
 * reduzido aos 4 estados que este contrato realmente tem. 4 estados de
 * origem x 4 de destino = 16 pares; 4 permitidos, 12 recusados.
 */
const TRANSICOES_PERMITIDAS = new Set([
  `${STATUS.PENDENTE}>${STATUS.EM_ANDAMENTO}`,
  `${STATUS.PENDENTE}>${STATUS.REJEITADA}`,
  `${STATUS.EM_ANDAMENTO}>${STATUS.RESOLVIDA}`,
  `${STATUS.EM_ANDAMENTO}>${STATUS.REJEITADA}`,
]);

/** Oraculo de transicao. Consulta a especificacao, par a par. */
const transicaoPermitida = (de, para) => TRANSICOES_PERMITIDAS.has(`${de}>${para}`);

/** Os 16 pares possiveis, com o veredito esperado de cada um. */
const paresDeTransicao = () =>
  ESTADOS.flatMap(de =>
    ESTADOS.map(para => ({ de, para, permitida: transicaoPermitida(de, para) })),
  );

// [C] schemas/demandas_schema.py, PRIORIDADES_VALIDAS.
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];

/**
 * [B] Codigos de erro legiveis por maquina que o CONTRATO deveria expor.
 * Assercao sobre `code`, nunca sobre `message`: a mensagem e texto de exibicao
 * e muda a cada ajuste de redacao. O back-end real (utils/responses.py) nao
 * devolve NENHUM campo `code` - so `message` (texto em portugues) e
 * `status_code` (espelha o HTTP). Mantido aqui de proposito: a ausencia do
 * campo no SUT real e, ela mesma, o achado que estes testes existem para
 * revelar, e apagar a expectativa apagaria o achado junto.
 */
const ERROS = {
  VALIDACAO: 'VALIDATION_ERROR',
  NAO_AUTENTICADO: 'UNAUTHENTICATED',
  CREDENCIAL_INVALIDA: 'INVALID_CREDENTIALS',
  PROIBIDO: 'FORBIDDEN',
  NAO_ENCONTRADO: 'NOT_FOUND',
  EMAIL_DUPLICADO: 'EMAIL_ALREADY_REGISTERED',
  TRANSICAO_INVALIDA: 'INVALID_STATUS_TRANSITION',
  CORPO_INVALIDO: 'MALFORMED_BODY',
  METODO_NAO_PERMITIDO: 'METHOD_NOT_ALLOWED',
};

/**
 * [B] Protocolo gerado pelo servidor: valor imprevisivel, formato
 * especificado no SUT didatico. O back-end real nao tem este campo - o
 * identificador exposto e so um `id` inteiro auto-incrementado. Mantido pela
 * mesma razao que ERROS acima: a ausencia e o achado.
 */
const FORMATO_PROTOCOLO = /^DEM-\d{4}-\d{6}$/;

// [C] Limites de campo. schemas/demandas_schema.py e schemas/user_schema.py.
const LIMITES = {
  tituloMin: 5,
  tituloMax: 120,
  descricaoMin: 10,
  descricaoMax: 500,
  localizacaoMin: 3,
  localizacaoMax: 500,
  senhaMin: 6,
  usernameMin: 3,
  usernameMax: 50,
};

/**
 * [A] Campos que o cliente NUNCA deve conseguir definir no POST /api/demandas.
 * Sao atribuidos pelo servidor. Sustenta o teste de mass assignment.
 */
const CAMPOS_CONTROLADOS_PELO_SERVIDOR = ['id', 'status', 'usuarioId', 'createdAt', 'updatedAt'];

/**
 * [A] Campos que jamais devem aparecer em qualquer resposta da API.
 * Vazamento de hash de senha e defeito de seguranca, nao de usabilidade.
 */
const CAMPOS_PROIBIDOS_EM_RESPOSTA = [
  'password',
  'senha',
  'password_hash',
  'passwordHash',
  'hash',
];

module.exports = {
  PERFIS,
  CATEGORIAS,
  STATUS,
  ESTADOS,
  STATUS_INICIAL,
  ESTADOS_FINAIS,
  TRANSICOES_PERMITIDAS,
  transicaoPermitida,
  paresDeTransicao,
  PRIORIDADES,
  ERROS,
  FORMATO_PROTOCOLO,
  LIMITES,
  CAMPOS_CONTROLADOS_PELO_SERVIDOR,
  CAMPOS_PROIBIDOS_EM_RESPOSTA,
};
