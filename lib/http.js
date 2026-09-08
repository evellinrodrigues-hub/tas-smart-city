/**
 * lib/http.js - Biblioteca base. Adaptacao ao SUT via HTTP.
 *
 * Sabe: fetch, cabecalhos, status, JSON.
 * Nao sabe: o que e uma demanda.
 * Nunca contem: assercoes.
 *
 * A decisao mais importante desta camada: a funcao NUNCA lanca excecao por
 * status de erro. Um 403 e resultado a verificar, nao acidente. Se lib/
 * decidisse que 4xx e falha, seria impossivel testar autorizacao.
 */

const { BASE_URL, TIMEOUT_MS } = require('./config');

/**
 * @param {string} metodo
 * @param {string} caminho
 * @param {object} [opcoes]
 * @param {string} [opcoes.token]           Bearer token.
 * @param {object} [opcoes.corpo]           Serializado como JSON.
 * @param {string} [opcoes.corpoBruto]      Enviado sem serializar (corpo malformado).
 * @param {object} [opcoes.cabecalhos]      Sobrescreve/acrescenta cabecalhos.
 * @param {string} [opcoes.autorizacaoBruta] Header Authorization literal, sem "Bearer ".
 * @returns {Promise<{status:number, body:any, headers:Headers, raw:string, ehJson:boolean}>}
 */
async function requisitar(metodo, caminho, opcoes = {}) {
  const { token, corpo, corpoBruto, cabecalhos = {}, autorizacaoBruta } = opcoes;

  const headers = {};

  // O cabecalho de tipo so faz sentido quando ha corpo. Comparacao com
  // undefined, e nao verificacao de veracidade: corpo vazio ou 0 e valido.
  if (corpo !== undefined || corpoBruto !== undefined) {
    headers['content-type'] = 'application/json';
  }

  // Requisicoes publicas nao enviam autorizacao. Enviar cabecalho vazio pode
  // gerar 401 e um teste que falha pelo motivo errado.
  if (autorizacaoBruta !== undefined) headers.authorization = autorizacaoBruta;
  else if (token) headers.authorization = `Bearer ${token}`;

  Object.assign(headers, cabecalhos);

  let resposta;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      method: metodo,
      headers,
      body: corpoBruto !== undefined
        ? corpoBruto
        : corpo === undefined
          ? undefined
          : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (erro) {
    // Falha de transporte NAO e falha do produto. Distinguir uma da outra e
    // competencia central: a mensagem precisa dizer que o alvo nao respondeu.
    throw new Error(
      `SUT inacessivel em ${BASE_URL}${caminho} (${metodo}): ${erro.message}. ` +
      `Confira se o alvo esta no ar e se BASE_URL aponta para ele.`,
    );
  }

  // Uma resposta 204 nao tem corpo, e ler JSON diretamente lancaria excecao.
  // Lendo como texto primeiro, tratamos o vazio como nulo e conseguimos
  // verificar se a API devolveu HTML onde deveria devolver JSON.
  const raw = await resposta.text();
  let body = null;
  let ehJson = false;
  if (raw) {
    try {
      body = JSON.parse(raw);
      ehJson = true;
    } catch {
      body = null;
      ehJson = false;
    }
  }

  return { status: resposta.status, body, headers: resposta.headers, raw, ehJson };
}

const get = (caminho, opcoes) => requisitar('GET', caminho, opcoes);
const post = (caminho, corpo, opcoes) => requisitar('POST', caminho, { ...opcoes, corpo });
const patch = (caminho, corpo, opcoes) => requisitar('PATCH', caminho, { ...opcoes, corpo });
const put = (caminho, corpo, opcoes) => requisitar('PUT', caminho, { ...opcoes, corpo });
const del = (caminho, opcoes) => requisitar('DELETE', caminho, opcoes);

module.exports = { requisitar, get, post, patch, put, del, BASE_URL };
