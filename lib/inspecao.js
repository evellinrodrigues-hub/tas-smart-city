/**
 * lib/inspecao.js - Biblioteca base. Inspecao de respostas.
 *
 * Funcoes PURAS que extraem e procuram. Nenhuma delas afirma nada: a assercao
 * mora no teste, sempre. Estas funcoes devolvem o dado (ou a lista de
 * violacoes) para que o teste decida e para que a mensagem de falha diga
 * exatamente ONDE o problema esta.
 */

/** O contrato pode envelopar a carga em `data`. Normalizamos em um lugar so. */
const carga = body => body?.data ?? body;

/** Extrai a lista de itens de uma resposta de listagem, envelopada ou nao. */
function lista(body) {
  const c = carga(body);
  if (Array.isArray(c)) return c;
  if (Array.isArray(c?.items)) return c.items;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

/** Extrai o bloco de paginacao, qualquer que seja o nome usado. */
const paginacao = body => body?.pagination ?? body?.meta ?? carga(body)?.pagination ?? null;

/**
 * Codigo de erro legivel por maquina. Nunca asserte sobre `message`: a
 * mensagem e texto de exibicao e muda a cada ajuste de redacao.
 */
const codigoDeErro = body => body?.error?.code ?? body?.code ?? null;

/** Lista de `field` apontados em error.details. */
function camposComErro(body) {
  const detalhes = body?.error?.details ?? body?.details ?? body?.errors ?? [];
  if (Array.isArray(detalhes)) {
    return detalhes.map(d => d?.field ?? d?.campo ?? d?.loc).filter(Boolean).map(String);
  }
  if (detalhes && typeof detalhes === 'object') return Object.keys(detalhes);
  return [];
}

/**
 * Percorre a resposta inteira procurando chaves que nunca deveriam trafegar.
 * Devolve os CAMINHOS encontrados, para que a falha diga onde vazou.
 */
function camposProibidos(valor, proibidos, caminho = '$') {
  const achados = [];

  if (Array.isArray(valor)) {
    valor.forEach((item, i) => achados.push(...camposProibidos(item, proibidos, `${caminho}[${i}]`)));
    return achados;
  }

  if (valor && typeof valor === 'object') {
    for (const [chave, sub] of Object.entries(valor)) {
      const aqui = `${caminho}.${chave}`;
      if (proibidos.some(p => chave.toLowerCase() === p.toLowerCase())) achados.push(aqui);
      achados.push(...camposProibidos(sub, proibidos, aqui));
    }
  }

  return achados;
}

/** Lista de chaves ausentes em `objeto`, para mensagens de contrato uteis. */
const camposAusentes = (objeto, esperados) =>
  esperados.filter(campo => carga(objeto)?.[campo] === undefined);

/** Tipo de midia declarado, sem os parametros (charset etc.). */
const tipoDeMidia = headers => (headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

/** Resumo curto de uma resposta, para mensagem de falha legivel sem reexecutar. */
const resumo = r =>
  `status=${r.status} tipo=${tipoDeMidia(r.headers) || '(ausente)'} corpo=${
    r.raw ? r.raw.slice(0, 300) : '(vazio)'
  }`;

module.exports = {
  carga,
  lista,
  paginacao,
  codigoDeErro,
  camposComErro,
  camposProibidos,
  camposAusentes,
  tipoDeMidia,
  resumo,
};
