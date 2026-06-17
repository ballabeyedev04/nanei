module.exports = function reponseMessageTemplate({ objet, messageOriginal, reponse }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réponse Nanei</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#FF7A00,#e56e00);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">📦 Nanei</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Réponse de notre équipe</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
                Nous avons bien reçu votre message et voici notre réponse :
              </p>

              <div style="background:#fff7ed;border-left:4px solid #FF7A00;border-radius:8px;padding:18px 20px;margin:0 0 20px;">
                <p style="margin:0 0 6px;color:#9a3412;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">Votre message — ${objet}</p>
                <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.7;white-space:pre-wrap;">${messageOriginal}</p>
              </div>

              <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:18px 20px;margin:0 0 32px;">
                <p style="margin:0 0 6px;color:#166534;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">Notre réponse</p>
                <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;white-space:pre-wrap;">${reponse}</p>
              </div>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;" />
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} Nanei — Service d'envoi de colis Franco-Mali.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};
