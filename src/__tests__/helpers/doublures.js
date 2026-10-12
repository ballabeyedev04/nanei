'use strict';

/**
 * Doublures communes à TOUS les fichiers de test (setupFilesAfterEnv).
 *
 * Le défaut rendu impossible : un test qui envoie un vrai e-mail (Resend), un
 * vrai SMS (Twilio, Orange), un fichier sur le vrai bucket R2, une
 * notification Firebase, un appel Wave / Orange Money, lance un Chromium ou
 * laisse une tâche cron armée qui empêche Jest de se terminer.
 *
 * Un fichier de test qui a besoin du VRAI module l'obtient explicitement par
 * `jest.requireActual(...)`.
 *
 * Journaux : silencieux par défaut (TEST_LOGS=1 pour les voir).
 */

jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ stop: jest.fn(), start: jest.fn() })) }));

jest.mock('../../services/resend.service', () => ({
  sendEmail: jest.fn(async () => ({ id: 'email-test' })),
  sendOtpEmail: jest.fn(async () => ({ id: 'otp-test' })),
}));

jest.mock('../../services/sms.service', () => ({
  sendSMS: jest.fn(async () => ({ success: true })),
}));

jest.mock('../../services/twilio.service', () => ({
  ...jest.requireActual('../../services/twilio.service'),
  sendSMS: jest.fn(async () => ({ success: true })),
}));

jest.mock('../../services/r2.service', () => ({
  uploadImage: jest.fn(async (_buffer, nom, dossier) => `https://r2.test/${dossier}/${nom}`),
  deleteFile: jest.fn(async () => {}),
}));

jest.mock('../../services/notification.service', () => ({
  envoyerPushNotification: jest.fn(async () => {}),
}));

jest.mock('../../services/payment/wave.service', () => ({
  initierPaiement: jest.fn(async () => ({ checkoutUrl: 'https://pay.wave.test/c/1', referenceSession: 'cos-test' })),
  verifierStatut: jest.fn(async () => ({ checkout_status: 'processing' })),
}));

jest.mock('../../services/payment/orangeMoney.service', () => ({
  initierPaiement: jest.fn(async () => ({ checkoutUrl: 'https://pay.om.test/1', referenceSession: 'om-test' })),
  getAccessToken: jest.fn(async () => 'jeton-om-test'),
}));

jest.mock('../../utils/htmlToPdf', () => {
  const fn = jest.fn(async () => Buffer.from('%PDF-1.4 test'));
  fn.closeBrowserPool = jest.fn(async () => {});
  return fn;
});

// Filet de sécurité : tout appel `fetch` (sms.service l'utilise pour Orange)
// échoue au lieu de partir sur Internet.
global.fetch = async (url) => {
  throw new Error(`Appel réseau interdit pendant les tests : ${url}`);
};

if (!process.env.TEST_LOGS) {
  require('../../config/logger').silent = true;
}
