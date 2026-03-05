module.exports = ({ nomClient, numero_facture, type }) => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
      <p>Bonjour <strong>${nomClient}</strong>,</p>

      <p>
        Merci de recevoir en pièce jointe votre
        <strong>${type.toLowerCase()}</strong>
        portant le numéro <strong>${numero_facture}</strong>.
      </p>

      <p>
        Ce document fait office de facture / contrat conformément à nos engagements.
      </p>

      <p>
        Pour toute information complémentaire, n’hésitez pas à nous contacter.
      </p>

      <br>

      <p>Cordialement,</p>
      <p><strong>L’équipe</strong></p>
    </div>
  `;
};