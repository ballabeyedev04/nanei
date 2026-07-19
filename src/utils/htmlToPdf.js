'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const logger = require('../config/logger');

/**
 * Convertit une chaîne HTML en Buffer PDF via Puppeteer/Chromium.
 *
 * ── Pooling du navigateur ────────────────────────────────────────────────
 * Lancer un navigateur Chromium complet (~plusieurs centaines de ms à
 * quelques secondes, pic mémoire notable) à CHAQUE génération de PDF
 * (facture, étiquette, rapport) était le principal risque d'OOM sous
 * charge : chaque appel précédent faisait `puppeteer.launch()` +
 * `browser.close()`, donc plusieurs générations simultanées lançaient
 * plusieurs Chromium en parallèle.
 *
 * Un seul navigateur est maintenant lancé paresseusement et réutilisé pour
 * toutes les générations (une nouvelle `page` par appel, jamais un nouveau
 * `browser`). S'il se déconnecte (crash Chromium), il est relancé
 * automatiquement au prochain appel. Un sémaphore limite le nombre de
 * générations réellement concurrentes pour ne pas saturer la mémoire.
 *
 * Repris du backend Sign (src/utils/htmlToPdf.js), même approche.
 */

// Nombre max de rendus PDF simultanés — à ajuster selon les ressources du
// conteneur (mémoire contrainte en production).
const MAX_CONCURRENT_RENDERS = 3;

let browserPromise = null;
let activeRenders = 0;
const waitQueue = [];

async function getBrowser() {
  if (browserPromise) return browserPromise;

  browserPromise = puppeteer.launch({
    headless: true,
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: await chromium.executablePath(),
  }).then((browser) => {
    browser.on('disconnected', () => {
      logger.warn('[pdf] Navigateur Chromium déconnecté — relancement au prochain appel');
      browserPromise = null;
    });
    return browser;
  }).catch((err) => {
    // Un échec de lancement ne doit pas rester "collé" en cache — permettre
    // un nouvel essai au prochain appel.
    browserPromise = null;
    throw err;
  });

  return browserPromise;
}

/** Limite le nombre de rendus PDF exécutés en parallèle (voir MAX_CONCURRENT_RENDERS). */
function acquireSlot() {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSlot() {
  const next = waitQueue.shift();
  if (next) {
    next();
  } else {
    activeRenders = Math.max(0, activeRenders - 1);
  }
}

/**
 * @param {string} html  - HTML complet à convertir
 * @param {{ format?: string, margin?: { top?: string, right?: string, bottom?: string, left?: string }, waitForFonts?: boolean }} [options]
 * @returns {Promise<Buffer>}
 */
async function htmlToPdf(html, options = {}) {
  const {
    format = 'A4',
    margin = { top: '0', right: '0', bottom: '0', left: '0' },
    waitForFonts = false,
  } = options;

  await acquireSlot();

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    if (waitForFonts) {
      await page.evaluate(() => document.fonts.ready);
    }
    const buffer = await page.pdf({ format, printBackground: true, margin });
    return Buffer.from(buffer);
  } finally {
    if (page) {
      // Ne ferme que l'onglet, jamais le navigateur partagé.
      await page.close().catch(() => {});
    }
    releaseSlot();
  }
}

/**
 * Ferme proprement le navigateur partagé — à appeler sur arrêt gracieux du
 * process (SIGTERM/SIGINT), pour ne pas laisser un Chromium orphelin.
 */
async function closeBrowserPool() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (err) {
    logger.warn('[pdf] Erreur fermeture navigateur partagé:', err.message);
  } finally {
    browserPromise = null;
  }
}

process.on('SIGTERM', closeBrowserPool);
process.on('SIGINT', closeBrowserPool);

module.exports = htmlToPdf;
module.exports.closeBrowserPool = closeBrowserPool;
