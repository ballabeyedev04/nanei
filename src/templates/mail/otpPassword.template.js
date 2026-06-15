module.exports = function otpPasswordTemplate({ nom, otp }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réinitialisation de mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0057A8,#003d78);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">nanei</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Réinitialisation de mot de passe</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;">Bonjour <strong>${nom}</strong>,</p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                Vous avez demandé la réinitialisation de votre mot de passe. Utilisez le code ci-dessous dans l'application.
                Ce code est valable pendant <strong>1 heure</strong>.
              </p>
              <div style="background:#f0f4ff;border:2px dashed #0057A8;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre code de réinitialisation</p>
                <span style="font-size:36px;font-weight:800;color:#0057A8;letter-spacing:8px;font-family:'Courier New',monospace;">${otp}</span>
              </div>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                Votre mot de passe actuel reste inchangé.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;">
                © ${new Date().getFullYear()} nanei — Ne répondez pas à cet email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
