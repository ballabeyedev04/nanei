const fs   = require('fs');
const path = require('path');

const LOGO_B64 = (() => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'));
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return null;
  }
})();

/**
 * Génère le HTML de la facture de paiement — design orange Nanei.
 */
function factureHtml(data) {
  const {
    factureNumero, dateEmission,
    colisReference, destination, poids, typeColis,
    payeurPrenom, payeurNom, payeurEmail, payeurTelephone,
    prixTotal, montantPaye, moyenPaiement, dateReglement,
  } = data;

  const moyenLabel = moyenPaiement === 'wave' ? 'Wave' : moyenPaiement === 'orange_money' ? 'Orange Money' : '—';
  const moyenColor = moyenPaiement === 'wave' ? '#1463F3' : '#CC5F00';
  const moyenBg    = moyenPaiement === 'wave' ? '#EEF3FF' : '#FFF4E8';
  const moyenBorder= moyenPaiement === 'wave' ? '#B5D0F8' : '#FFD9A8';

  const formatXOF = (n) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0) + ' FCFA';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Facture ${factureNumero} — Nanei</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #F7F7F5;
    color: #111;
    font-size: 13px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: 794px;
    margin: 0 auto;
    background: white;
    display: flex;
    flex-direction: column;
  }

  /* ── Top accent bar ── */
  .top-bar { height: 5px; background: #FF7A00; }

  /* ── Header ── */
  .header {
    padding: 28px 48px 20px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1px solid #F0F0EE;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-logo {
    width: 50px; height: 50px;
    border-radius: 14px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .brand-name { font-size: 22px; font-weight: 900; color: #111; letter-spacing: -0.5px; line-height: 1; }

  .invoice-id { text-align: right; }
  .invoice-label {
    font-size: 10px; font-weight: 800; color: #FF7A00;
    text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 3px;
  }
  .invoice-num { font-size: 18px; font-weight: 900; color: #111; letter-spacing: -0.3px; }
  .invoice-status {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 6px;
    background: #FFF4E8; border: 1px solid #FFD9A8;
    border-radius: 20px; padding: 3px 10px;
  }
  .invoice-status-dot { width: 6px; height: 6px; background: #FF7A00; border-radius: 50%; }
  .invoice-status-text { font-size: 11px; font-weight: 700; color: #CC5F00; }

  /* ── Meta bar ── */
  .meta-bar {
    padding: 13px 48px;
    background: #FAFAF8;
    border-bottom: 1px solid #F0F0EE;
    display: flex; gap: 36px;
  }
  .meta-item .meta-label {
    font-size: 10px; font-weight: 700; color: #BBB;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;
  }
  .meta-item .meta-val { font-size: 13px; font-weight: 600; color: #111; }
  .meta-item .meta-val.accent { color: ${moyenColor}; font-weight: 700; }

  /* ── Body ── */
  .body { padding: 24px 48px 16px; }

  /* ── Section title ── */
  .section-title {
    font-size: 10px; font-weight: 800; color: #CCC;
    text-transform: uppercase; letter-spacing: 1.5px;
    margin-bottom: 10px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-title::after {
    content: ''; flex: 1; height: 1px; background: #F0F0EE;
  }

  /* ── Parties ── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .party-card {
    border: 1px solid #F0F0EE;
    border-radius: 10px; padding: 16px;
  }
  .party-card.accent { border-left: 3px solid #FF7A00; }
  .party-role {
    font-size: 10px; font-weight: 800; color: #FF7A00;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 7px;
  }
  .party-role.muted { color: #BBB; }
  .party-name { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 5px; }
  .party-detail { font-size: 12px; color: #777; line-height: 1.65; }

  /* ── Colis card ── */
  .colis-card {
    border: 1px solid #F0F0EE;
    border-radius: 10px; padding: 16px;
    margin-bottom: 18px;
  }
  .colis-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .colis-icon-box {
    width: 42px; height: 42px;
    background: #FFF4E8;
    border: 1px solid #FFD9A8;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .colis-ref { font-size: 16px; font-weight: 800; color: #111; }
  .colis-sub { font-size: 11px; color: #AAA; font-weight: 500; margin-top: 1px; }
  .colis-stamp {
    margin-left: auto;
    border: 2.5px solid #FF7A00;
    border-radius: 8px;
    padding: 5px 14px;
    transform: rotate(-3deg);
    flex-shrink: 0;
  }
  .colis-stamp-text  { font-size: 14px; font-weight: 900; color: #FF7A00; text-transform: uppercase; letter-spacing: 1px; line-height: 1; }
  .colis-stamp-date  { font-size: 9px; font-weight: 700; color: #FF7A00; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; text-align: center; }

  .colis-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .colis-item { background: #FAFAF8; border-radius: 8px; padding: 10px 12px; }
  .colis-item-label { font-size: 10px; font-weight: 700; color: #BBB; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 3px; }
  .colis-item-val   { font-size: 13px; font-weight: 700; color: #111; }

  /* ── Invoice table ── */
  .invoice-table {
    border: 1px solid #F0F0EE;
    border-radius: 10px; overflow: hidden;
    margin-bottom: 18px;
  }
  .inv-head {
    display: flex; justify-content: space-between;
    padding: 9px 16px;
    background: #FAFAF8;
    border-bottom: 1px solid #F0F0EE;
  }
  .inv-head span { font-size: 10px; font-weight: 700; color: #CCC; text-transform: uppercase; letter-spacing: 0.8px; }
  .inv-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid #F8F8F6;
  }
  .inv-row:last-child { border-bottom: none; }
  .inv-row-label { font-size: 13px; font-weight: 600; color: #111; }
  .inv-row-sub   { font-size: 11px; color: #AAA; margin-top: 2px; }
  .inv-row-val   { font-size: 13px; font-weight: 700; color: #111; }
  .inv-row.muted .inv-row-label { color: #AAA; font-weight: 500; }
  .inv-row.muted .inv-row-val   { color: #AAA; font-weight: 500; }
  .inv-total {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px;
    background: #FF7A00;
  }
  .inv-total-label { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.85); }
  .inv-total-val   { font-size: 20px; font-weight: 900; color: white; letter-spacing: -0.5px; }

  /* ── Moyen badge ── */
  .moyen-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: ${moyenBg}; border: 1px solid ${moyenBorder};
    border-radius: 20px; padding: 3px 10px;
    font-size: 12px; font-weight: 700; color: ${moyenColor};
  }
  .moyen-dot { width: 6px; height: 6px; border-radius: 50%; background: ${moyenColor}; }

  /* ── Auth box ── */
  .auth-box {
    display: flex; align-items: center; gap: 14px;
    background: #FFF4E8;
    border: 1px solid #FFD9A8;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 16px;
  }
  .auth-icon-box {
    width: 38px; height: 38px;
    background: #FF7A00; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .auth-check { font-size: 18px; color: white; font-weight: 900; }
  .auth-title { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 2px; }
  .auth-sub   { font-size: 11px; color: #888; }
  .auth-ref {
    margin-left: auto; flex-shrink: 0;
    font-family: 'Courier New', monospace;
    font-size: 10px; font-weight: 700; color: #CC5F00;
    background: white; border: 1px solid #FFD9A8;
    padding: 5px 10px; border-radius: 7px;
    max-width: 170px; text-align: center; line-height: 1.5; word-break: break-all;
  }

  /* ── Legal mention ── */
  .legal {
    text-align: center; padding-bottom: 8px;
    font-size: 11px; color: #CCC; line-height: 1.7; font-weight: 500;
  }
  .legal strong { color: #FF7A00; font-weight: 700; }

  /* ── Footer ── */
  .footer {
    background: #111;
    padding: 16px 48px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .footer-brand { font-size: 15px; font-weight: 900; color: white; }
  .footer-sub   { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
  .footer-mid   { font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; }
  .footer-right { font-size: 10px; color: rgba(255,255,255,0.3); text-align: right; line-height: 1.6; }
</style>
</head>
<body>
<div class="page">

  <div class="top-bar"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      ${LOGO_B64 ? `<img src="${LOGO_B64}" class="brand-logo" alt="Nanei"/>` : `<div class="brand-logo" style="background:#FF7A00;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:white;">N</div>`}
      <div>
        <div class="brand-name">Nanei</div>
      </div>
    </div>
    <div class="invoice-id">
      <div class="invoice-label">Facture</div>
      <div class="invoice-num">${factureNumero}</div>
      <div class="invoice-status">
        <div class="invoice-status-dot"></div>
        <span class="invoice-status-text">Payé · ${dateReglement}</span>
      </div>
    </div>
  </div>

  <!-- META BAR -->
  <div class="meta-bar">
    <div class="meta-item">
      <div class="meta-label">Date d'émission</div>
      <div class="meta-val">${dateEmission}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Référence colis</div>
      <div class="meta-val">${colisReference}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Destination</div>
      <div class="meta-val">${destination}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Mode de paiement</div>
      <div class="meta-val accent">${moyenLabel}</div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- Parties -->
    <div class="section-title">Informations client</div>
    <div class="parties">
      <div class="party-card accent">
        <div class="party-role">Expéditeur / Payeur</div>
        <div class="party-name">${payeurPrenom} ${payeurNom}</div>
        <div class="party-detail">
          ${payeurEmail || '—'}<br/>
          ${payeurTelephone || '—'}
        </div>
      </div>
      <div class="party-card">
        <div class="party-role muted">Destination du colis</div>
        <div class="party-name">${destination}</div>
        <div class="party-detail">
          Type : ${typeColis || 'Standard'}<br/>
          Poids : ${poids} kg
        </div>
      </div>
    </div>

    <!-- Colis -->
    <div class="section-title">Détails du colis</div>
    <div class="colis-card">
      <div class="colis-top">
        <div class="colis-icon-box">📦</div>
        <div>
          <div class="colis-ref">${colisReference}</div>
          <div class="colis-sub">${typeColis || 'Standard'} · ${destination}</div>
        </div>
        <div class="colis-stamp">
          <div class="colis-stamp-text">Payé</div>
          <div class="colis-stamp-date">${dateReglement}</div>
        </div>
      </div>
      <div class="colis-grid">
        <div class="colis-item">
          <div class="colis-item-label">Destination</div>
          <div class="colis-item-val">${destination}</div>
        </div>
        <div class="colis-item">
          <div class="colis-item-label">Poids</div>
          <div class="colis-item-val">${poids} kg</div>
        </div>
        <div class="colis-item">
          <div class="colis-item-label">Type</div>
          <div class="colis-item-val">${typeColis || 'Standard'}</div>
        </div>
      </div>
    </div>

    <!-- Tableau paiement -->
    <div class="section-title">Récapitulatif du paiement</div>
    <div class="invoice-table">
      <div class="inv-head">
        <span>Description</span>
        <span>Montant</span>
      </div>
      <div class="inv-row">
        <div>
          <div class="inv-row-label">Service d'envoi de colis</div>
          <div class="inv-row-sub">${colisReference} · ${destination} · ${poids} kg</div>
        </div>
        <div class="inv-row-val">${formatXOF(prixTotal)}</div>
      </div>
      <div class="inv-row">
        <div>
          <div class="inv-row-label">Mode de paiement</div>
        </div>
        <div><span class="moyen-badge"><span class="moyen-dot"></span>${moyenLabel}</span></div>
      </div>
      <div class="inv-row muted">
        <div class="inv-row-label">Frais de traitement</div>
        <div class="inv-row-val">Inclus</div>
      </div>
      <div class="inv-total">
        <div class="inv-total-label">Montant total réglé</div>
        <div class="inv-total-val">${formatXOF(montantPaye)}</div>
      </div>
    </div>

    <!-- Auth -->
    <div class="auth-box">
      <div class="auth-icon-box">
        <span class="auth-check">✓</span>
      </div>
      <div>
        <div class="auth-title">Paiement confirmé et authentifié</div>
        <div class="auth-sub">Ce document fait foi de règlement pour le colis ${colisReference}.</div>
      </div>
      <div class="auth-ref">${factureNumero}</div>
    </div>

    <!-- Legal -->
    <div class="legal">
      Ce document est une facture officielle. Conservez-le comme preuve de paiement.<br/>
      Pour toute réclamation, mentionnez la référence <strong>${factureNumero}</strong>.
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <div class="footer-brand">Nanei</div>
      <div class="footer-sub">francomaliship.com</div>
    </div>
    <div class="footer-mid">Merci de votre confiance<br/>Votre colis est pris en charge.</div>
    <div class="footer-right">Page 1 / 1<br/>© 2026 Nanei — Tous droits réservés</div>
  </div>

</div>
</body>
</html>`;
}

module.exports = { factureHtml };
