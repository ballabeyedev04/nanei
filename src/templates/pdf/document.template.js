module.exports = ({
  numeroFacture,
  nomClient,
  nomUtilisateur,
  delais_execution,
  date_execution,
  avance,
  lieu_execution,
  moyen_paiement,
  dateGeneration,
  items = []
}) => {

  const logoUrl = 'file:///' + (process.cwd() + '/uploads/logo/logo-sign.png').replace(/\\/g, '/');

  // Calcul du montant total
  const montantTotal = items.reduce((total, item) => total + (item.quantite * item.prix_unitaire), 0);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Document</title>
<style>
@page { size: A4; margin: 20mm 15mm; }
body { font-family: Arial, sans-serif; font-size: 14px; color: #000; }
.logo { text-align: center; margin-bottom: 20px; }
.logo img { max-width: 120px; }
.titre { border: 2px solid #000; padding: 10px; text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; }
.infos { display: flex; justify-content: space-between; margin-bottom: 30px; }
.infos-left, .infos-right { width: 48%; }
table { width: 100%; border-collapse: collapse; margin-top: 15px; }
th, td { border: 1px solid #000; padding: 10px; text-align: center; }
th { background-color: #f2f2f2; }
.signatures { margin-top: 70px; display: flex; justify-content: space-between; }
.signature-box { width: 45%; text-align: center; }
.signature-img { max-width: 200px; max-height: 90px; margin-top: 10px; object-fit: contain; }
.footer { margin-top: 60px; text-align: center; font-size: 12px; color: #666; }
</style>
</head>
<body>

<div class="logo">
  <img src="${logoUrl}" />
</div>

<div class="titre">
  DOCUMENT
</div>

<div class="infos">
  <div class="infos-left">
    <p><strong>Numéro :</strong> ${numeroFacture}</p>
    <p><strong>Client :</strong> ${nomClient}</p>
    <p><strong>Professionnel :</strong> ${nomUtilisateur}</p>
    <p><strong>Exécution :</strong> ${delais_execution} / ${date_execution}</p>
    <p><strong>Avance :</strong> ${avance ? `${avance} FCFA` : '-'}</p>
    <p><strong>Lieu :</strong> ${lieu_execution || '-'}</p>
  </div>
  <div class="infos-right">
    <p><strong>Date :</strong><br>${dateGeneration}</p>
  </div>
</div>

<table>
<thead>
<tr>
  <th>Désignation</th>
  <th>Quantité</th>
  <th>Prix Unitaire</th>
  <th>Sous-Total</th>
</tr>
</thead>
<tbody>
${items.map(item => `
<tr>
  <td>${item.designation}</td>
  <td>${item.quantite}</td>
  <td>${item.prix_unitaire.toLocaleString()} FCFA</td>
  <td>${(item.quantite * item.prix_unitaire).toLocaleString()} FCFA</td>
</tr>
`).join('')}
<tr>
  <td colspan="3" style="text-align:right;font-weight:bold;">Montant Total</td>
  <td style="font-weight:bold;">${montantTotal.toLocaleString()} FCFA</td>
</tr>
</tbody>
</table>

<div class="footer">
© ${new Date().getFullYear()} – Sign
</div>

</body>
</html>
`;
};
