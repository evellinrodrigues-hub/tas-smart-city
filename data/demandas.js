/**
 * data/demandas.js - Massa de dados. Fonte unica.
 *
 * `valida()` e uma FUNCAO, e nao um objeto constante. A diferenca importa: um
 * objeto compartilhado pode ser modificado por um teste e contaminar os
 * demais, produzindo falhas que dependem da ordem de execucao. A funcao
 * devolve um objeto novo a cada chamada.
 *
 * Nomes de campo em portugues (titulo/descricao/categoria/localizacao/
 * prioridade): confirmado em schemas/demandas_schema.py do back-end real [C]
 * em data/contrato.js. O README do produto so documenta rotas e perfis, nunca
 * o payload - ver contrato.js para a proveniencia completa.
 */

const contrato = require('./contrato');

/**
 * Titulo unico por chamada. O back-end real recusa titulo duplicado (409/422
 * "Ja existe uma demanda com este titulo"); sem isso, a segunda chamada de
 * `valida()` numa mesma execucao colidiria com a primeira.
 */
const tituloNovo = () => `Buraco na via ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Demanda que satisfaz todas as regras do contrato. */
const valida = () => ({
  titulo: tituloNovo(),
  categoria: contrato.CATEGORIAS[0],
  descricao: 'Buraco de grande porte na pista da direita, proximo ao cruzamento.',
  localizacao: 'Rua das Flores, 123 - Bairro Boa Viagem',
  prioridade: contrato.PRIORIDADES[0],
});

/**
 * Produz variantes sem repetir os campos validos.
 * com({ categoria: 'BURACO' }) e a demanda valida com uma categoria invalida.
 */
const com = extra => ({ ...valida(), ...extra });

/** Variante sem um campo, para testar obrigatoriedade. */
const sem = campo => {
  const d = valida();
  delete d[campo];
  return d;
};

/** Texto com exatamente `n` caracteres, para testar valor limite. */
const textoCom = n => 'a'.repeat(n);

/**
 * Casos invalidos rastreaveis: cada entrada declara o campo que a API deve
 * apontar em error.details. Sem isso, o teste passaria se a API recusasse a
 * demanda pelo motivo errado.
 */
const invalidas = () => [
  {
    nome: 'categoria fora da lista fechada',
    corpo: com({ categoria: 'BURACO' }),
    campoEsperado: 'categoria',
  },
  {
    nome: 'descricao abaixo do minimo',
    corpo: com({ descricao: textoCom(contrato.LIMITES.descricaoMin - 1) }),
    campoEsperado: 'descricao',
  },
  {
    nome: 'descricao acima do maximo',
    corpo: com({ descricao: textoCom(contrato.LIMITES.descricaoMax + 1) }),
    campoEsperado: 'descricao',
  },
  {
    nome: 'localizacao abaixo do minimo',
    corpo: com({ localizacao: textoCom(contrato.LIMITES.localizacaoMin - 1) }),
    campoEsperado: 'localizacao',
  },
  {
    nome: 'prioridade fora da lista fechada',
    corpo: com({ prioridade: 'agora-mesmo' }),
    campoEsperado: 'prioridade',
  },
  {
    nome: 'titulo abaixo do minimo',
    corpo: com({ titulo: textoCom(contrato.LIMITES.tituloMin - 1) }),
    campoEsperado: 'titulo',
  },
  {
    nome: 'categoria ausente',
    corpo: sem('categoria'),
    campoEsperado: 'categoria',
  },
  {
    nome: 'descricao ausente',
    corpo: sem('descricao'),
    campoEsperado: 'descricao',
  },
  {
    nome: 'titulo ausente',
    corpo: sem('titulo'),
    campoEsperado: 'titulo',
  },
  {
    nome: 'corpo vazio',
    corpo: {},
    campoEsperado: 'titulo',
  },
];

/** Valores limite aceitos: o contrato diz que a fronteira e inclusiva. */
const limitesAceitos = () => [
  {
    nome: `descricao com exatamente ${contrato.LIMITES.descricaoMin} caracteres`,
    corpo: com({ descricao: textoCom(contrato.LIMITES.descricaoMin) }),
  },
  {
    nome: `descricao com exatamente ${contrato.LIMITES.descricaoMax} caracteres`,
    corpo: com({ descricao: textoCom(contrato.LIMITES.descricaoMax) }),
  },
  {
    nome: `localizacao com exatamente ${contrato.LIMITES.localizacaoMin} caracteres`,
    corpo: com({ localizacao: textoCom(contrato.LIMITES.localizacaoMin) }),
  },
];

module.exports = { valida, com, sem, tituloNovo, textoCom, invalidas, limitesAceitos };
