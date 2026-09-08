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
 *      PetersonNave/Smart-City, secoes 6 (endpoints), 7 (metodos HTTP) e
 *      8 (regras de autorizacao por role).
 *
 *  [B] PENDENTE - NAO documentado em nenhuma fonte acessivel da squad. A
 *      documentacao oficial da API (Postman, view/47073825/2sBXwvHTeT) e
 *      renderizada por JavaScript e nao expoe o contrato; a pagina retorna
 *      apenas o titulo "Smart City Documentation". Os valores marcados [B]
 *      foram transcritos do contrato do SUT didatico "Cidade Conectada"
 *      (Material de Estudo ADS033, cap. 4 a 6), que e o unico com tabela de
 *      transicoes e codigos de erro fechada.
 *
 * TODO ITEM [B] E RISCO DECLARADO, NAO VERDADE. Ver docs/tas.md, secao 4
 * (riscos R-02 e R-03). Ao confirmar um valor com a equipe de back-end, mude
 * AQUI e em nenhum outro lugar: nenhum arquivo de teste tem valor literal.
 */

// [A] Perfis de usuario. README secao 8.
const PERFIS = {
  CIDADAO: 'CITIZEN',
  GESTOR: 'MANAGER',
  ADMIN: 'ADMIN',
};

// [B] Lista fechada de categorias da demanda urbana.
const CATEGORIAS = [
  'ROAD_MAINTENANCE',
  'PUBLIC_LIGHTING',
  'WASTE_DISPOSAL',
  'SANITATION',
  'INSPECTION',
];

// [B] Estados da demanda.
const STATUS = {
  RECEBIDA: 'RECEIVED',
  EM_ANALISE: 'UNDER_ANALYSIS',
  EM_ANDAMENTO: 'IN_PROGRESS',
  RESOLVIDA: 'RESOLVED',
  REJEITADA: 'REJECTED',
};

const ESTADOS = Object.values(STATUS);

// [B] Status com que toda demanda nasce.
const STATUS_INICIAL = STATUS.RECEBIDA;

// [B] Estados finais: demanda concluida. Sustenta a regra [A] de que o gestor
// nao pode excluir demanda ja concluida.
const ESTADOS_FINAIS = [STATUS.RESOLVIDA, STATUS.REJEITADA];

/**
 * [B] Maquina de estados fechada. 5 estados de origem x 5 de destino = 25
 * pares; 5 permitidos, 20 recusados. Repetir o status atual tambem e recusado.
 *
 * Escrito a mao a partir da tabela do contrato. NAO derivado do SUT.
 */
const TRANSICOES_PERMITIDAS = new Set([
  `${STATUS.RECEBIDA}>${STATUS.EM_ANALISE}`,
  `${STATUS.RECEBIDA}>${STATUS.REJEITADA}`,
  `${STATUS.EM_ANALISE}>${STATUS.EM_ANDAMENTO}`,
  `${STATUS.EM_ANALISE}>${STATUS.REJEITADA}`,
  `${STATUS.EM_ANDAMENTO}>${STATUS.RESOLVIDA}`,
]);

/** Oraculo de transicao. Consulta a especificacao, par a par. */
const transicaoPermitida = (de, para) => TRANSICOES_PERMITIDAS.has(`${de}>${para}`);

/** Os 25 pares possiveis, com o veredito esperado de cada um. */
const paresDeTransicao = () =>
  ESTADOS.flatMap(de =>
    ESTADOS.map(para => ({ de, para, permitida: transicaoPermitida(de, para) })),
  );

// [B] Prioridades. README secao 6.2 cita "status ou prioridade" sem enumerar.
const PRIORIDADES = ['LOW', 'MEDIUM', 'HIGH'];

// [B] Codigos de erro legiveis por maquina. Asserção sobre `code`, nunca sobre
// `message`: a mensagem e texto de exibicao e muda a cada ajuste de redacao.
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

// [B] Protocolo gerado pelo servidor: valor imprevisivel, formato especificado.
// Ancoras importam: sem elas um protocolo com lixo antes passaria.
const FORMATO_PROTOCOLO = /^DEM-\d{4}-\d{6}$/;

// [B] Limites de campo declarados no contrato do SUT de referencia.
const LIMITES = {
  descricaoMin: 20,
  descricaoMax: 1000,
  senhaMin: 8,
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
};

// [B] Regioes politico-administrativas aceitas em location.region.
const REGIOES = ['RPA_1', 'RPA_2', 'RPA_3', 'RPA_4', 'RPA_5', 'RPA_6'];

/**
 * [A] Campos que o cliente NUNCA deve conseguir definir no POST /api/demandas.
 * Sao atribuidos pelo servidor. Sustenta o teste de mass assignment.
 */
const CAMPOS_CONTROLADOS_PELO_SERVIDOR = ['id', 'protocol', 'status', 'author', 'createdAt'];

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
  REGIOES,
  CAMPOS_CONTROLADOS_PELO_SERVIDOR,
  CAMPOS_PROIBIDOS_EM_RESPOSTA,
};
