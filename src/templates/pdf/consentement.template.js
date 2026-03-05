// templates/pdf/consentement.template.js

module.exports = function consentementTemplate({
  numeroFacture,
  nomClient,
  nomUtilisateur,
  montant,
  delais_execution
}) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Consentement Juridique - ${numeroFacture}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { text-align: center; font-size: 24px; }
        h2 { font-size: 18px; margin-top: 30px; }
        p { margin: 10px 0; }
        ul { margin: 10px 0 20px 20px; }
        .signature { margin-top: 50px; display: flex; justify-content: space-between; }
        .signature div { text-align: center; }
        .highlight { font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Consentement Contractuel et Reconnaissance des Obligations</h1>

      <p>Numéro du document : <span class="highlight">${numeroFacture}</span></p>

      <p>Ce document formalise le consentement libre, éclairé et conforme aux exigences du droit sénégalais des obligations.</p>

      <h2>1. Parties</h2>
      <ul>
        <li>Le client : <span class="highlight">${nomClient}</span></li>
        <li>Le prestataire / vendeur : <span class="highlight">${nomUtilisateur}</span></li>
      </ul>

      <h2>2. Cadre juridique du consentement</h2>
      <p>Selon le Code des Obligations Civiles et Commerciales du Sénégal, pour qu’un contrat soit valide, il doit répondre aux conditions suivantes :</p>
      <ul>
        <li><span class="highlight">Consentement libre et éclairé</span> des parties</li>
        <li><span class="highlight">Capacité juridique</span> de contracter</li>
        <li><span class="highlight">Objet déterminé et licite</span></li>
        <li><span class="highlight">Cause licite</span></li>
      </ul>

      <h2>3. Consentement libre et éclairé</h2>
      <p>Chaque partie déclare avoir lu, compris et accepté toutes les clauses du présent contrat :</p>
      <ul>
        <li>Nature et modalités de prestation ou de vente</li>
        <li>Obligations respectives des parties</li>
        <li>Délais d’exécution convenus : <span class="highlight">${delais_execution}</span></li>
        <li>Montant total de la transaction : <span class="highlight">${montant} FCFA</span></li>
      </ul>
      <p>Le consentement est exprimé sans erreur, tromperie (dol) ni violence. Aucune pression ou manœuvre frauduleuse n’est tolérée.</p>

      <h2>4. Effet juridique et engagement</h2>
      <p>En signant ce document, chaque partie reconnaît que :</p>
      <ul>
        <li>Le consentement est donné librement et en pleine connaissance de cause</li>
        <li>Les obligations contractuelles sont valables et exécutoires devant les tribunaux sénégalais</li>
        <li>Les parties s'engagent à respecter l’ensemble des termes et conditions du contrat principal</li>
      </ul>

      <p style="text-align:center; margin-top: 40px; font-size: 12px;">
        Ce document est généré automatiquement et a valeur légale après signatures électroniques.
      </p>
    </body>
    </html>
  `;
};
