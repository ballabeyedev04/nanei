module.exports = ({ nomClient, numero_facture, type }) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:30px;">

          <!-- Header -->
          <tr>
            <td style="text-align:center; padding-bottom:20px;">
              <h2 style="margin:0; color:#0f172a;">Votre document est prêt</h2>
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="color:#334155; font-size:15px; line-height:1.6;">
              <p>Bonjour <strong>${nomClient}</strong>,</p>

              <p>
                Votre document <strong>${type}</strong>
                <span style="color:#0f766e; font-weight:bold;">(${numero_facture})</span>
                a été généré avec succès.
              </p>

              <p>
                Vous trouverez le document PDF en pièce jointe à cet email.
                Merci de le consulter attentivement.
              </p>

              <p>
                Si une signature est requise, nous vous invitons à signer le document
                dans les meilleurs délais.
              </p>

              <p style="margin-top:25px;">
                Merci pour votre confiance.
              </p>

              <p>
                Cordialement,<br />
                <strong>L’équipe SIGN</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e5e7eb; padding-top:15px; text-align:center;">
              <p style="font-size:12px; color:#64748b; margin:0;">
                © ${new Date().getFullYear()} SIGN – Tous droits réservés
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
