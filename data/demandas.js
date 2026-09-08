/**
 * data/demandas.js - Massa de dados. Fonte unica.
 *
 * `valida()` e uma FUNCAO, e nao um objeto constante. A diferenca importa: um
 * objeto compartilhado pode ser modificado por um teste e contaminar os
 * demais, produzindo falhas que dependem da ordem de execucao. A funcao
 * devolve um objeto novo a cada chamada.
 */

const contrato = require('./contrato');

/** Demanda que satisfaz todas as regras do contrato. */
const valida = () => ({
  category: contrato.CATEGORIAS[0],
  description: 'Buraco de grande porte na pista da direita, proximo ao cruzamento.',
  location: { latitude: -8.0578, longitude: -34.8829, region: 'RPA_3' },
});

/**
 * Produz variantes sem repetir os campos validos.
 * com({ category: 'BURACO' }) e a demanda valida com uma categoria invalida.
 */
const com = extra => ({ ...valida(), ...extra });

/** Variante sem um campo, para testar obrigatoriedade. */
const sem = campo => {
  const d = valida();
  delete d[campo];
  return d;
};

/** Descricao com exatamente `n` caracteres, para testar valor limite. */
const descricaoCom = n => 'a'.repeat(n);

/**
 * Casos invalidos rastreaveis: cada entrada declara o campo que a API deve
 * apontar em error.details. Sem isso, o teste passaria se a API recusasse a
 * demanda pelo motivo errado.
 */
const invalidas = () => [
  {
    nome: 'categoria fora da lista fechada',
    corpo: com({ category: 'BURACO' }),
    campoEsperado: 'category',
  },
  {
    nome: 'descricao abaixo do minimo',
    corpo: com({ description: descricaoCom(contrato.LIMITES.descricaoMin - 1) }),
    campoEsperado: 'description',
  },
  {
    nome: 'descricao acima do maximo',
    corpo: com({ description: descricaoCom(contrato.LIMITES.descricaoMax + 1) }),
    campoEsperado: 'description',
  },
  {
    nome: 'latitude fora da faixa',
    corpo: com({ location: { latitude: 999, longitude: -34.8829, region: 'RPA_3' } }),
    campoEsperado: 'location.latitude',
  },
  {
    nome: 'longitude fora da faixa',
    corpo: com({ location: { latitude: -8.0578, longitude: 999, region: 'RPA_3' } }),
    campoEsperado: 'location.longitude',
  },
  {
    nome: 'regiao inexistente',
    corpo: com({ location: { latitude: -8.0578, longitude: -34.8829, region: 'RPA_99' } }),
    campoEsperado: 'location.region',
  },
  {
    nome: 'categoria ausente',
    corpo: sem('category'),
    campoEsperado: 'category',
  },
  {
    nome: 'descricao ausente',
    corpo: sem('description'),
    campoEsperado: 'description',
  },
  {
    nome: 'corpo vazio',
    corpo: {},
    campoEsperado: 'category',
  },
];

/** Valores limite aceitos: o contrato diz que a fronteira e inclusiva. */
const limitesAceitos = () => [
  {
    nome: `descricao com exatamente ${contrato.LIMITES.descricaoMin} caracteres`,
    corpo: com({ description: descricaoCom(contrato.LIMITES.descricaoMin) }),
  },
  {
    nome: `descricao com exatamente ${contrato.LIMITES.descricaoMax} caracteres`,
    corpo: com({ description: descricaoCom(contrato.LIMITES.descricaoMax) }),
  },
  {
    nome: 'latitude no limite inferior da faixa',
    corpo: com({
      location: { latitude: contrato.LIMITES.latitude.min, longitude: -34.8829, region: 'RPA_3' },
    }),
  },
];

module.exports = { valida, com, sem, descricaoCom, invalidas, limitesAceitos };
