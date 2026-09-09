/**
 * lib/inspecao.js - Biblioteca base. Inspecao de respostas.
 *
 * Funcoes PURAS que extraem e procuram. Nenhuma delas afirma nada: a assercao
 * mora no teste, sempre. Estas funcoes devolvem o dado (ou a lista de
 * violacoes) para que o teste decida e para que a mensagem de falha diga
 * exatamente ONDE o problema esta.
 */

/**
 * O contrato pode envelopar a carga em `data`. Normalizamos em um lugar so.
 * O back-end real ainda aninha uma demanda unica sob `data.demanda` (ver
 * controllers/demandas_controller.py); desembrulhamos isso tambem, sem
 * quebrar o formato mais raso do duplo de referencia (que nao tem essa
 * chave, entao o fallback abaixo mantem `d` como esta).
 */
const carga = body => {
  const d = body?.data ?? body;
  return d?.demanda ?? d;
};

/** Extrai a lista de itens de uma resposta de listagem, envelopada ou nao. */
function lista(body) {
  const c = carga(body);
  if (Array.isArray(c)) return c;
  if (Array.isArray(c?.items)) return c.items;
  if (Array.isArray(c?.demandas)) return c.demandas;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

/**
 * Extrai o bloco de paginacao, qualquer que seja o nome usado. O back-end
 * real usa `paginacao` (dentro de `data`), com campos em portugues
 * (`paginas`, `pagina_atual`, `por_pagina` em vez de `totalPages` etc.) -
 * ver services/demandas_service.py + controllers/demandas_controller.py.
 */
const paginacao = body =>
  body?.pagination ?? body?.meta ?? carga(body)?.pagination ?? body?.data?.paginacao ?? null;

/**
 * Codigo de erro legivel por maquina. Nunca asserte sobre `message`: a
 * mensagem e texto de exibicao e muda a cada ajuste de redacao.
 */
const codigoDeErro = body => body?.error?.code ?? body?.code ?? null;

/**
 * Lista de `field` apontados em error.details. O back-end real devolve os
 * erros de validacao em `data.errors` (controllers/auth_controller.py e
 * demandas_controller.py, branch `ValidationError`/`ValueError`).
 */
function camposComErro(body) {
  const detalhes = body?.error?.details ?? body?.details ?? body?.errors ?? body?.data?.errors ?? [];
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
