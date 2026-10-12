'use strict';

/**
 * Pagination facultative des listes (utils/pagination.js).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Casser les versions du mobile déjà installées : SANS `page` ni `limit`,
 *   la liste doit rester complète et la réponse identique (pas de clé
 *   `pagination`).
 * - Une page démesurée (`limit=100000`) qui charge toute la table.
 * - Un total faux quand la requête porte des `include` (`distinct: true`).
 * - Trouvé en écrivant ce test : la recherche `q` contenant `%` ou `_`.
 *   `motifRecherche` écrivait `\${c}` dans un gabarit, c'est-à-dire le texte
 *   littéral « ${c} » : « 50% » devenait « %50${c}% » et ne trouvait rien.
 */

const express = require('express');
const request = require('supertest');
const {
  lirePagination, metaPagination, paginer, paginerTableau, motifRecherche, avecPagination,
  paginerReponse, LIMITE_DEFAUT, LIMITE_MAX,
} = require('../utils/pagination');

describe('lirePagination', () => {
  it('sans page ni limit : null (liste complète, comportement historique)', () => {
    expect(lirePagination({})).toBeNull();
    expect(lirePagination(undefined)).toBeNull();
    expect(lirePagination({ q: 'x', statut: 'livre' })).toBeNull();
  });

  it('valeurs par défaut et bornes', () => {
    expect(lirePagination({ page: '1' })).toEqual({ page: 1, limit: LIMITE_DEFAUT, offset: 0 });
    expect(lirePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, offset: 20 });
    expect(lirePagination({ limit: '100000' }).limit).toBe(LIMITE_MAX);
    expect(lirePagination({ page: '-4', limit: '0' })).toEqual({ page: 1, limit: LIMITE_DEFAUT, offset: 0 });
    expect(lirePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: LIMITE_DEFAUT, offset: 0 });
  });

  it('réglages propres à une route', () => {
    expect(lirePagination({ limit: '80' }, { max: 50 }).limit).toBe(50);
    expect(lirePagination({ page: '2' }, { defaut: 5 }).limit).toBe(5);
  });
});

describe('metaPagination', () => {
  it('pages >= 1 même sans résultat', () => {
    expect(metaPagination({ page: 1, limit: 20 }, 0)).toEqual({ page: 1, limit: 20, total: 0, pages: 1 });
    expect(metaPagination({ page: 2, limit: 20 }, 41)).toEqual({ page: 2, limit: 20, total: 41, pages: 3 });
  });
});

describe('paginer (modèle Sequelize doublé)', () => {
  const Modele = { findAll: jest.fn(), findAndCountAll: jest.fn() };

  it('sans pagination : findAll avec les options inchangées', async () => {
    Modele.findAll.mockResolvedValue(['a', 'b']);
    const r = await paginer(Modele, { where: { x: 1 } }, {});
    expect(r).toEqual({ lignes: ['a', 'b'], pagination: null });
    expect(Modele.findAll).toHaveBeenCalledWith({ where: { x: 1 } });
    expect(Modele.findAndCountAll).not.toHaveBeenCalled();
  });

  it('avec pagination : findAndCountAll, limit/offset et distinct (compte juste malgré les include)', async () => {
    Modele.findAndCountAll.mockResolvedValue({ count: 45, rows: ['c'] });
    const r = await paginer(Modele, { where: { x: 1 }, include: [{}] }, { page: '3', limit: '20' });
    expect(Modele.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 40, distinct: true, where: { x: 1 } }));
    expect(r).toEqual({ lignes: ['c'], pagination: { page: 3, limit: 20, total: 45, pages: 3 } });
  });
});

describe('paginerTableau / avecPagination', () => {
  it('découpe un tableau en mémoire', () => {
    const t = Array.from({ length: 25 }, (_, i) => i);
    expect(paginerTableau(t, {})).toEqual({ lignes: t, pagination: null });
    const r = paginerTableau(t, { page: '2', limit: '10' });
    expect(r.lignes).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(r.pagination).toEqual({ page: 2, limit: 10, total: 25, pages: 3 });
  });

  it('n’ajoute la clé `pagination` que si elle a été demandée', () => {
    expect(avecPagination({ data: [] }, null)).toEqual({ data: [] });
    expect(avecPagination({ data: [] }, { page: 1 })).toEqual({ data: [], pagination: { page: 1 } });
  });
});

describe('motifRecherche', () => {
  it('vide ou blanc : null (pas de filtre)', () => {
    expect(motifRecherche(undefined)).toBeNull();
    expect(motifRecherche('   ')).toBeNull();
  });

  it('encadre de % et coupe à 100 caractères', () => {
    expect(motifRecherche('  dupont ')).toBe('%dupont%');
    expect(motifRecherche('x'.repeat(300))).toBe(`%${'x'.repeat(100)}%`);
  });

  it('% _ et \\ saisis sont pris LITTÉRALEMENT (échappés par \\)', () => {
    expect(motifRecherche('50%')).toBe('%50\\%%');
    expect(motifRecherche('a_b')).toBe('%a\\_b%');
    expect(motifRecherche('c:\\x')).toBe('%c:\\\\x%');
    // eslint-disable-next-line no-template-curly-in-string -- on vérifie justement qu'un gabarit non interpolé « ${c} » ne fuit pas
    expect(motifRecherche('50%')).not.toContain('${c}');
  });
});

describe('paginerReponse (middleware des petites tables)', () => {
  const app = express();
  app.get('/pays', paginerReponse('data'), (req, res) => res.json({ message: 'ok', data: Array.from({ length: 7 }, (_, i) => i) }));
  app.get('/erreur', paginerReponse('data'), (req, res) => res.status(400).json({ message: 'non', data: [1, 2, 3] }));

  it('sans paramètre : réponse inchangée', async () => {
    const r = await request(app).get('/pays');
    expect(r.body).toEqual({ message: 'ok', data: [0, 1, 2, 3, 4, 5, 6] });
  });

  it('avec page/limit : tranche + méta', async () => {
    const r = await request(app).get('/pays?page=2&limit=3');
    expect(r.body).toEqual({ message: 'ok', data: [3, 4, 5], pagination: { page: 2, limit: 3, total: 7, pages: 3 } });
  });

  it('une réponse d’erreur n’est jamais découpée', async () => {
    const r = await request(app).get('/erreur?page=1&limit=1');
    expect(r.body).toEqual({ message: 'non', data: [1, 2, 3] });
  });
});
