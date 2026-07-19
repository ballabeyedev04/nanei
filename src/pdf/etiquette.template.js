const fs = require('fs');
const path = require('path');
const htmlToPdf = require('../utils/htmlToPdf');

const LOGO_B64 = (() => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'));
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return null;
  }
})();

/**
 * Génère un SVG de code-barres visuel (non scannable) à partir d'une chaîne.
 * Chaque caractère → barre de largeur (charCode % 4 + 1), alternant noir/blanc.
 */
function genererBarcode(reference) {
  const barWidth = 2;
  const height = 60;
  let x = 0;
  let bars = '';
  let noir = true;

  for (let i = 0; i < reference.length; i++) {
    const w = (reference.charCodeAt(i) % 4 + 1) * barWidth;
    if (noir) {
      bars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#111"/>`;
    }
    x += w;
    noir = !noir;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">${bars}</svg>`;
}

/**
 * Encode le SVG barcode en data URI pour embedding dans HTML.
 */
function barcodeDataUri(reference) {
  const svg = genererBarcode(reference);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function etiquetteHtml(data) {
  const {
    reference,
    expediteurNom,
    expediteurPrenom,
    expediteurTelephone,
    expediteurVille,
    recepteurNom,
    recepteurPrenom,
    recepteurTelephone,
    recepteurVille,
    recepteurPays,
    typeTransport,
    poids,
    createdAt,
  } = data;

  const transportLabel = typeTransport === 'aerien' ? 'AÉRIEN' : 'MARITIME';
  const transportColor = typeTransport === 'aerien' ? '#1463F3' : '#0A8A4B';

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const masquerTel = (tel) => {
    if (!tel) return '—';
    const c = tel.replace(/\s/g, '');
    if (c.length <= 4) return '****';
    return c.slice(0, 2) + '****' + c.slice(-2);
  };

  const barcodeSrc = barcodeDataUri(reference);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Étiquette ${reference}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, 'Segoe UI', sans-serif;
    background: white;
    width: 105mm;
    min-height: 148mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .etiquette {
    width: 105mm;
    min-height: 148mm;
    border: 2px dashed #CCC;
    padding: 6mm;
    display: flex;
    flex-direction: column;
    gap: 4mm;
  }

  /* Header */
  .header {
    background: #FF7A00;
    border-radius: 8px;
    padding: 14px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .header-logo {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    object-fit: contain;
    flex-shrink: 0;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 18px;
    color: #FF7A00;
    padding: 4px;
    margin-right: 10px;
  }
  .header-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 26px;
    font-weight: 700;
    color: white;
    letter-spacing: 1px;
  }

  /* Référence */
  .reference-block {
    text-align: center;
    padding: 6px 0 2px;
  }
  .reference-label {
    font-size: 8px;
    font-weight: 700;
    color: #AAA;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .reference-value {
    font-size: 22px;
    font-weight: 900;
    color: #111;
    letter-spacing: 1px;
    word-break: break-all;
  }

  /* Barcode */
  .barcode-block {
    text-align: center;
  }
  .barcode-block img {
    max-width: 100%;
    height: 50px;
  }
  .barcode-text {
    font-size: 8px;
    color: #AAA;
    margin-top: 2px;
    font-family: 'Courier New', monospace;
    letter-spacing: 2px;
  }

  /* Sections expéditeur/destinataire */
  .section {
    border: 1px solid #EEE;
    border-radius: 6px;
    padding: 7px 10px;
  }
  .section-label {
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #FF7A00;
    margin-bottom: 4px;
  }
  .section-label.dest { color: #111; }
  .section-name {
    font-size: 13px;
    font-weight: 700;
    color: #111;
    margin-bottom: 2px;
  }
  .section-detail {
    font-size: 10px;
    color: #666;
    line-height: 1.5;
  }
  .section-pays {
    font-size: 16px;
    font-weight: 900;
    color: #FF7A00;
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* Infos bas */
  .infos-bas {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: auto;
  }
  .info-chip {
    background: #F5F5F5;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 9px;
    color: #555;
    font-weight: 600;
  }
  .transport-chip {
    background: ${transportColor};
    color: white;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
<div class="etiquette">

  <!-- Header -->
  <div class="header">
    ${LOGO_B64
      ? `<img src="${LOGO_B64}" class="header-logo" alt="Nanei"/>`
      : `<div class="header-logo">N</div>`
    }
    <div class="header-title">Nanei</div>
  </div>

  <!-- Référence -->
  <div class="reference-block">
    <div class="reference-label">Référence colis</div>
    <div class="reference-value">${reference}</div>
  </div>

  <!-- Barcode visuel -->
  <div class="barcode-block">
    <img src="${barcodeSrc}" alt="barcode"/>
    <div class="barcode-text">${reference}</div>
  </div>

  <!-- Expéditeur -->
  <div class="section">
    <div class="section-label">Expéditeur</div>
    <div class="section-name">${expediteurPrenom || ''} ${expediteurNom || ''}</div>
    <div class="section-detail">
      Tél : ${masquerTel(expediteurTelephone)}<br/>
      ${expediteurVille || ''}
    </div>
  </div>

  <!-- Destinataire -->
  <div class="section">
    <div class="section-label dest">Destinataire</div>
    <div class="section-name">${recepteurPrenom || ''} ${recepteurNom || ''}</div>
    <div class="section-detail">
      Tél : ${recepteurTelephone || '—'}<br/>
      ${recepteurVille || ''}
    </div>
    <div class="section-pays">${recepteurPays || ''}</div>
  </div>

  <!-- Infos bas -->
  <div class="infos-bas">
    <div class="transport-chip">${transportLabel}</div>
    <div class="info-chip">Poids : ${poids || '—'} kg</div>
    <div class="info-chip">Créé le ${dateStr}</div>
  </div>

</div>
</body>
</html>`;
}

/**
 * Génère le PDF d'une étiquette A6.
 * @param {object} colisData - Données du colis
 * @returns {Promise<Buffer>} Buffer PDF
 */
async function genererEtiquette(colisData) {
  const html = etiquetteHtml(colisData);

  return htmlToPdf(html, {
    format: 'A6',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
}

module.exports = { genererEtiquette };
