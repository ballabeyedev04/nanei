const fs = require('fs');
const path = require('path');

const LOGO_B64 = (() => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'));
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return null;
  }
})();

const ETAPES = [
  { key: 'en_attente', label: 'En attente',  icone: '📦' },
  { key: 'recupere',   label: 'Récupéré',    icone: '🚚' },
  { key: 'livre',      label: 'Livré',       icone: '✅' },
];

const STATUT_INFO = {
  en_attente: { label: 'En attente de collecte', couleur: '#B45309', bg: '#FEF3C7' },
  recupere:   { label: 'Récupéré — en transit',  couleur: '#1D4ED8', bg: '#DBEAFE' },
  livre:      { label: 'Livré',                  couleur: '#059669', bg: '#D1FAE5' },
};

function formatDateHeure(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(' à ', ' à ');
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Page HTML publique de suivi d'un colis — accessible sans authentification
 * (scan du QR code de l'étiquette, lien partagé). Design pro aux couleurs
 * Nanei, historique complet avec horodatage de chaque changement de statut.
 */
function suiviPublicHtml(colis) {
  const {
    reference, statut, destination, poids, type_colis,
    created_at, expediteur, recepteur, historique = [],
  } = colis;

  const statutInfo = STATUT_INFO[statut] || STATUT_INFO.en_attente;
  const etapeActuelleIndex = ETAPES.findIndex((e) => e.key === statut);

  const transportLabel = type_colis === 'aerien' ? 'Transport aérien' : 'Transport maritime';
  const transportIcone = type_colis === 'aerien' ? '✈️' : '🚢';

  // Historique trié du plus récent au plus ancien pour l'affichage (timeline
  // descendante — l'événement le plus récent en haut, plus intuitif).
  const historiqueTrie = [...historique].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const stepperHtml = ETAPES.map((etape, i) => {
    const atteinte = etapeActuelleIndex >= 0 && i <= etapeActuelleIndex;
    const active = i === etapeActuelleIndex;
    return `
      <div class="step ${atteinte ? 'step-done' : ''} ${active ? 'step-active' : ''}">
        <div class="step-dot">${atteinte ? etape.icone : ''}</div>
        <div class="step-label">${etape.label}</div>
      </div>
      ${i < ETAPES.length - 1 ? `<div class="step-line ${i < etapeActuelleIndex ? 'step-line-done' : ''}"></div>` : ''}
    `;
  }).join('');

  const timelineHtml = historiqueTrie.length
    ? historiqueTrie.map((h) => {
        const info = STATUT_INFO[h.nouveau_statut] || {};
        return `
          <div class="timeline-item">
            <div class="timeline-dot" style="background:${info.couleur || '#9CA3AF'}"></div>
            <div class="timeline-content">
              <div class="timeline-top">
                <span class="timeline-statut" style="color:${info.couleur || '#374151'}">${info.label || h.nouveau_statut}</span>
                <span class="timeline-date">${formatDateHeure(h.created_at)}</span>
              </div>
              ${h.commentaire ? `<div class="timeline-comment">${h.commentaire}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')
    : `
      <div class="timeline-item">
        <div class="timeline-dot" style="background:${STATUT_INFO.en_attente.couleur}"></div>
        <div class="timeline-content">
          <div class="timeline-top">
            <span class="timeline-statut" style="color:${STATUT_INFO.en_attente.couleur}">Colis enregistré</span>
            <span class="timeline-date">${formatDateHeure(created_at)}</span>
          </div>
        </div>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Suivi colis ${reference} · Nanei</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --primary: #FF7A00;
    --primary-dark: #E06900;
    --dark: #111827;
    --gray-600: #4B5563;
    --gray-400: #9CA3AF;
    --gray-100: #F3F4F6;
    --border: #E5E7EB;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #F8F9FB;
    color: var(--dark);
    -webkit-font-smoothing: antialiased;
  }

  .page {
    max-width: 560px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    padding: 28px 20px 40px;
    text-align: center;
    color: white;
  }
  .header-logo {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }
  .header-logo img { width: 40px; height: 40px; object-fit: contain; }
  .header-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .header-sub {
    font-size: 12.5px;
    opacity: 0.85;
    margin-top: 4px;
    font-weight: 500;
  }

  /* ── Carte principale (chevauche le header) ── */
  .main-card {
    background: white;
    border-radius: 20px;
    margin: -28px 16px 0;
    padding: 24px 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
    position: relative;
    z-index: 2;
  }
  .reference-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-400);
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .reference-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--dark);
    margin-top: 4px;
    letter-spacing: 0.5px;
  }
  .statut-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    margin-top: 12px;
  }

  /* ── Stepper ── */
  .stepper {
    display: flex;
    align-items: flex-start;
    margin: 28px 4px 4px;
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 64px;
  }
  .step-dot {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--gray-100);
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    transition: all 0.2s;
  }
  .step-done .step-dot {
    background: #FFF4E8;
    border-color: var(--primary);
  }
  .step-active .step-dot {
    background: var(--primary);
    border-color: var(--primary);
    box-shadow: 0 0 0 5px rgba(255,122,0,0.15);
  }
  .step-label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--gray-400);
    margin-top: 6px;
    text-align: center;
  }
  .step-done .step-label, .step-active .step-label { color: var(--dark); }
  .step-line {
    flex: 1;
    height: 2px;
    background: var(--border);
    margin-top: 17px;
    border-radius: 2px;
  }
  .step-line-done { background: var(--primary); }

  /* ── Cartes info ── */
  .section {
    margin: 20px 16px 0;
  }
  .section-title {
    font-size: 11px;
    font-weight: 800;
    color: var(--gray-400);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 10px;
    padding: 0 4px;
  }
  .info-card {
    background: white;
    border-radius: 16px;
    padding: 16px 18px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px solid #F3F4F6;
  }
  .info-row:last-child { border-bottom: none; }
  .info-key { font-size: 13px; color: var(--gray-600); font-weight: 500; }
  .info-val { font-size: 13px; color: var(--dark); font-weight: 700; text-align: right; }

  .parties-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .partie-card {
    background: white;
    border-radius: 16px;
    padding: 14px 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  }
  .partie-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--primary);
    margin-bottom: 6px;
  }
  .partie-nom { font-size: 13.5px; font-weight: 700; color: var(--dark); }
  .partie-tel { font-size: 11.5px; color: var(--gray-400); margin-top: 2px; }

  /* ── Timeline historique ── */
  .timeline {
    background: white;
    border-radius: 16px;
    padding: 18px 18px 6px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  }
  .timeline-item {
    display: flex;
    gap: 12px;
    padding-bottom: 18px;
    position: relative;
  }
  .timeline-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 14px;
    bottom: 0;
    width: 2px;
    background: #F0F0F0;
  }
  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 3px;
    flex-shrink: 0;
    box-shadow: 0 0 0 3px white;
  }
  .timeline-content { flex: 1; }
  .timeline-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
  }
  .timeline-statut { font-size: 13.5px; font-weight: 700; }
  .timeline-date { font-size: 11px; color: var(--gray-400); font-weight: 500; }
  .timeline-comment {
    font-size: 12px;
    color: var(--gray-600);
    margin-top: 4px;
    line-height: 1.4;
  }

  /* ── Footer ── */
  .footer {
    margin-top: auto;
    padding: 32px 20px 24px;
    text-align: center;
  }
  .footer-brand {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 15px;
    font-weight: 700;
    color: var(--dark);
  }
  .footer-sub {
    font-size: 11px;
    color: var(--gray-400);
    margin-top: 4px;
  }

  @media (max-width: 380px) {
    .step { width: 54px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="Nanei"/>` : ''}
    </div>
    <div class="header-title">NANEI</div>
    <div class="header-sub">Suivi de votre colis en temps réel</div>
  </div>

  <!-- Carte principale -->
  <div class="main-card">
    <div class="reference-label">Référence colis</div>
    <div class="reference-value">${reference}</div>
    <div class="statut-badge" style="background:${statutInfo.bg};color:${statutInfo.couleur}">
      ${statutInfo.label}
    </div>

    <!-- Stepper -->
    <div class="stepper">
      ${stepperHtml}
    </div>
  </div>

  <!-- Infos colis -->
  <div class="section">
    <div class="section-title">Détails de l'envoi</div>
    <div class="info-card">
      <div class="info-row">
        <span class="info-key">🌍 Destination</span>
        <span class="info-val">${destination || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-key">${transportIcone} Transport</span>
        <span class="info-val">${transportLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-key">⚖️ Poids</span>
        <span class="info-val">${poids ?? '—'} kg</span>
      </div>
      <div class="info-row">
        <span class="info-key">📅 Enregistré le</span>
        <span class="info-val">${formatDate(created_at)}</span>
      </div>
    </div>
  </div>

  <!-- Expéditeur / Destinataire -->
  <div class="section">
    <div class="section-title">Expéditeur & destinataire</div>
    <div class="parties-grid">
      <div class="partie-card">
        <div class="partie-label">Expéditeur</div>
        <div class="partie-nom">${expediteur ? `${expediteur.prenom || ''} ${expediteur.nom || ''}`.trim() : '—'}</div>
        <div class="partie-tel">${expediteur?.telephone || '—'}</div>
      </div>
      <div class="partie-card">
        <div class="partie-label">Destinataire</div>
        <div class="partie-nom">${recepteur ? `${recepteur.prenom || ''} ${recepteur.nom || ''}`.trim() : '—'}</div>
        <div class="partie-tel">${recepteur?.telephone || '—'}</div>
      </div>
    </div>
  </div>

  <!-- Historique -->
  <div class="section">
    <div class="section-title">Historique du colis</div>
    <div class="timeline">
      ${timelineHtml}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">NANEI</div>
    <div class="footer-sub">Service d'envoi international de colis · FrancoMaliShip</div>
  </div>

</div>
</body>
</html>`;
}

/**
 * Page HTML affichée quand la référence scannée/partagée ne correspond à
 * aucun colis — même identité visuelle que la page de suivi, pour ne jamais
 * retomber sur une erreur brute illisible.
 */
function suiviIntrouvableHtml(reference) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Colis introuvable · Nanei</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #F8F9FB;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: white;
    border-radius: 24px;
    padding: 40px 28px;
    max-width: 380px;
    width: 100%;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  }
  .icon {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: #FEF2F2;
    display: flex; align-items: center; justify-content: center;
    font-size: 30px;
    margin: 0 auto 20px;
  }
  h1 { font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 8px; }
  p { font-size: 13.5px; color: #6B7280; line-height: 1.5; }
  .ref { font-weight: 700; color: #111827; }
  .brand {
    margin-top: 28px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    font-weight: 700;
    color: #FF7A00;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">🔍</div>
    <h1>Colis introuvable</h1>
    <p>Aucun colis ne correspond à la référence <span class="ref">${reference}</span>. Vérifiez le lien ou le code scanné.</p>
    <div class="brand">NANEI</div>
  </div>
</body>
</html>`;
}

module.exports = { suiviPublicHtml, suiviIntrouvableHtml };
