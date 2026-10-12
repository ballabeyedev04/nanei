'use strict';

/**
 * Journal d'audit — filtres de GET /nanei/admin/audit-logs.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Un filtre « Action » qui ne trouve rien pour une saisie partielle ou en
 *   minuscules (« update » au lieu de « UPDATE_STATUT ») : l'admin croit
 *   qu'aucune action n'a eu lieu.
 * - Une date de fin qui exclut la journée choisie.
 * - Une pagination non bornée (`limit` énorme) ou qui plante sur une valeur
 *   non numérique.
 */

jest.mock('../middlewares/auth.middleware', () => (req, res, next) => { req.user = { id: 'admin-1', role: 'Admin' }; next(); });
jest.mock('../middlewares/isAdmin.middlewares', () => (req, res, next) => next());
jest.mock('../models/auditlog.model', () => ({ findAndCountAll: jest.fn(async () => ({ count: 0, rows: [] })) }));
jest.mock('../models/utilisateur.model', () => ({}));

const express = require('express');
const request = require('supertest');
const { Op } = require('sequelize');
const AuditLog = require('../models/auditlog.model');
const routeur = require('../routes/admin/auditlog.route');

const app = express();
app.use('/nanei/admin/audit-logs', routeur);

const derniereRequete = () => AuditLog.findAndCountAll.mock.calls.at(-1)[0];

describe('GET /nanei/admin/audit-logs', () => {
  it('filtre « Action » : correspondance partielle, sans casse', async () => {
    await request(app).get('/nanei/admin/audit-logs?action=update').expect(200);
    expect(derniereRequete().where.action).toEqual({ [Op.iLike]: '%update%' });
  });

  it('date de fin incluse : jusqu’au début du jour suivant', async () => {
    await request(app).get('/nanei/admin/audit-logs?date_debut=2026-10-01&date_fin=2026-10-11').expect(200);
    const plage = derniereRequete().where.created_at;
    expect(plage[Op.gte].getDate()).toBe(1);
    expect(plage[Op.lt].getDate()).toBe(12);
  });

  it('date illisible → 400', async () => {
    await request(app).get('/nanei/admin/audit-logs?date_fin=abc').expect(400);
  });

  it('pagination bornée (limit ≤ 100) et tolérante aux valeurs non numériques', async () => {
    const r = await request(app).get('/nanei/admin/audit-logs?page=x&limit=5000').expect(200);
    expect(derniereRequete().limit).toBe(100);
    expect(r.body.pagination).toEqual({ page: 1, limit: 100, total: 0, pages: 1 });
  });
});
