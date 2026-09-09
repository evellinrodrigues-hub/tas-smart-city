/**
 * api/smart-city.js - Logica de negocio do teste.
 *
 * Sabe: caminhos e formatos do contrato.
 * Nao sabe: como HTTP funciona (quem sabe e lib/http.js).
 * Nunca contem: assercoes. Se criarDemanda() afirmasse que o status e 201,
 * seria impossivel escrever o teste do 403.
 *
 * O sentido das dependencias aponta sempre para a direita:
 *   tests/ -> api/ -> lib/
 *   tests/ -> data/
 */

const http = require('../lib/http');
const { ROTAS, USUARIOS } = require('../lib/config');
const contrato = require('../data/contrato');

// ---------------------------------------------------------------------------
// Autenticacao
// ---------------------------------------------------------------------------

/**
 * Autentica e devolve os tokens. Aqui a excecao E correta, e a contradicao com
 * lib/ e so aparente: a autenticacao e PREPARACAO, nao o comportamento sob
 * teste. Se ela falhar, a mensagem precisa dizer isso, em vez de o teste
 * falhar dez linhas adiante com erro sobre propriedade de valor indefinido.
 */
async function autenticar(usuario) {
  const { status, body } = await login(usuario.email, usuario.senha);

  if (status !== 200) {
    throw new Error(
      `Preparacao falhou: login de ${usuario.email} respondeu ${status}: ` +
      `${JSON.stringify(body)}. O usuario de teste existe no alvo?`,
    );
  }

  const tokens = extrairTokens(body);
  if (!tokens.accessToken) {
    throw new Error(
      `Preparacao falhou: login de ${usuario.email} respondeu 200 mas sem token ` +
      `reconhecivel no corpo: ${JSON.stringify(body)}`,
    );
  }
  return tokens;
}

/** Atalho: devolve so o access token, que e o que a maioria dos testes usa. */
const tokenDe = async usuario => (await autenticar(usuario)).accessToken;

/**
 * O contrato do Smart-City nomeia os campos como access_token/refresh_token,
 * enquanto o SUT didatico usa accessToken. Normalizamos em UM lugar: se o
 * back-end fechar o nome, muda aqui, uma vez, e nenhum teste muda.
 */
function extrairTokens(body) {
  const raiz = body?.data ?? body ?? {};
  return {
    accessToken: raiz.access_token ?? raiz.accessToken ?? raiz.token ?? null,
    refreshToken: raiz.refresh_token ?? raiz.refreshToken ?? null,
    usuario: raiz.user ?? raiz.usuario ?? null,
  };
}

const login = (email, senha) => http.post(ROTAS.login, { email, password: senha });

const registrar = dados => http.post(ROTAS.registrar, dados);

const meuPerfil = token => http.get(ROTAS.eu, { token });

const atualizarPerfil = (token, dados) => http.patch(ROTAS.atualizarPerfil, dados, { token });

const renovarToken = (refreshToken, corpo) =>
  http.post(ROTAS.renovarToken, corpo ?? { refresh_token: refreshToken }, { token: refreshToken });

const logout = token => http.get(ROTAS.logout, { token });

// ---------------------------------------------------------------------------
// Demandas
// ---------------------------------------------------------------------------

const criarDemanda = (token, demanda) => http.post(ROTAS.demandas, demanda, { token });

const listarDemandas = (token, filtros = {}) => {
  const query = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null),
  ).toString();
  return http.get(`${ROTAS.demandas}${query ? `?${query}` : ''}`, { token });
};

const obterDemanda = (token, id) => http.get(ROTAS.demanda(id), { token });

const atualizarDemanda = (token, id, dados) => http.patch(ROTAS.demanda(id), dados, { token });

const excluirDemanda = (token, id) => http.del(ROTAS.demanda(id), { token });

const mudarStatus = (token, id, status) => atualizarDemanda(token, id, { status });

/**
 * Percorre TODAS as paginas da listagem e devolve os itens reunidos.
 *
 * Por que isto existe: uma assercao de AUSENCIA sobre a primeira pagina e um
 * falso negativo esperando para acontecer. "A demanda alheia nao aparece" pode
 * significar "nao vazou" ou "vazou, mas esta na pagina 2" — e o teste passaria
 * verde nos dois casos. Verificar isolamento exige olhar a listagem inteira.
 *
 * O limite de paginas evita laco infinito se a paginacao do SUT estiver
 * quebrada: melhor a suite parar e reclamar do que rodar para sempre.
 */
async function percorrerListagem(token, filtros = {}, maxPaginas = 50) {
  const insp = require('../lib/inspecao');
  const itens = [];

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    // `per_page`: nome real do parametro (schemas/demandas_schema.py,
    // DemandaQuerySchema). O duplo de referencia aceita os dois nomes.
    const resposta = await listarDemandas(token, { ...filtros, page: pagina, pageSize: 100, per_page: 100 });
    if (resposta.status !== 200) {
      throw new Error(
        `Listagem falhou na pagina ${pagina}: ${resposta.status} ${resposta.raw.slice(0, 200)}`,
      );
    }

    const lote = insp.lista(resposta.body);
    itens.push(...lote);

    const pag = insp.paginacao(resposta.body);
    const totalPaginas = Number(pag?.totalPages ?? pag?.paginas ?? 1);
    if (lote.length === 0 || pagina >= totalPaginas) return itens;
  }

  throw new Error(
    `A listagem passou de ${maxPaginas} paginas sem terminar: a paginacao do SUT nao converge`,
  );
}

/** Procura uma demanda especifica em toda a listagem visivel ao token. */
const localizarNaListagem = async (token, id, filtros) =>
  (await percorrerListagem(token, filtros)).find(d => d.id === id) ?? null;

// ---------------------------------------------------------------------------
// Preparacao de cenario
// ---------------------------------------------------------------------------

/**
 * Cria uma demanda e a conduz, por transicoes validas, ate o estado pedido.
 * Preparacao de massa, nao verificacao: por isso lanca se o caminho quebrar.
 */
async function demandaNoEstado(estadoAlvo, dadosDemanda) {
  const insp = require('../lib/inspecao');
  const tokenCidadao = await tokenDe(USUARIOS.cidadao);
  const criacao = await criarDemanda(tokenCidadao, dadosDemanda);

  if (criacao.status !== 201) {
    throw new Error(
      `Preparacao falhou: criacao de demanda respondeu ${criacao.status}: ` +
      `${JSON.stringify(criacao.body)}`,
    );
  }

  const demanda = insp.carga(criacao.body);
  const id = demanda?.id ?? demanda?.protocol;

  if (estadoAlvo === contrato.STATUS_INICIAL) return { id, demanda, tokenCidadao };

  const tokenGestor = await tokenDe(USUARIOS.gestor);
  for (const passo of caminhoAte(estadoAlvo)) {
    const r = await mudarStatus(tokenGestor, id, passo);
    if (r.status !== 200) {
      throw new Error(
        `Preparacao falhou: transicao para ${passo} respondeu ${r.status}: ` +
        `${JSON.stringify(r.body)}`,
      );
    }
  }

  return { id, demanda, tokenCidadao, tokenGestor };
}

/**
 * Menor caminho de transicoes validas do estado inicial ate `destino`.
 * Derivado do oraculo, nao escrito a mao: se a maquina de estados mudar no
 * contrato, a preparacao acompanha sozinha.
 */
function caminhoAte(destino) {
  const fila = [[contrato.STATUS_INICIAL, []]];
  const vistos = new Set([contrato.STATUS_INICIAL]);

  while (fila.length) {
    const [atual, caminho] = fila.shift();
    if (atual === destino) return caminho;

    for (const proximo of contrato.ESTADOS) {
      if (vistos.has(proximo)) continue;
      if (!contrato.transicaoPermitida(atual, proximo)) continue;
      vistos.add(proximo);
      fila.push([proximo, [...caminho, proximo]]);
    }
  }

  throw new Error(`Nao ha caminho de transicoes validas ate ${destino}`);
}

module.exports = {
  autenticar,
  tokenDe,
  extrairTokens,
  login,
  registrar,
  meuPerfil,
  atualizarPerfil,
  renovarToken,
  logout,
  criarDemanda,
  listarDemandas,
  percorrerListagem,
  localizarNaListagem,
  obterDemanda,
  atualizarDemanda,
  excluirDemanda,
  mudarStatus,
  demandaNoEstado,
  caminhoAte,
};
