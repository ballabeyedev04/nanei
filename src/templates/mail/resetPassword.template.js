module.exports = ({ nom, resetLink }) => {
  const logoUrl = 'http://localhost:3000/uploads/logo-sign.png';

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Réinitialisation du mot de passe</title>
    <style>
      body { font-family: 'Helvetica', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .logo { text-align: center; margin-bottom: 30px; }
      .logo img { max-width: 160px; }
      h1 { color: #111827; font-size: 22px; margin-bottom: 20px; }
      p { color: #374151; font-size: 16px; line-height: 1.5; margin-bottom: 15px; }
      .btn { display: inline-block; padding: 14px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); transition: background 0.3s ease; margin-top: 20px; }
      .btn:hover { background-color: #1e40af; }
      .info { margin-top: 20px; background-color: #f1f5f9; padding: 15px; border-left: 4px solid #2563eb; font-size: 14px; text-align: left; }
      .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 30px; }
      @media (max-width: 640px) {
        .container { padding: 20px; margin: 20px; }
        h1 { font-size: 20px; }
        p { font-size: 15px; }
      }
    </style>
  </head>
  <body>
    <div class="container">

      <!-- LOGO -->
      <div class="logo">
        <img src="${logoUrl}" alt="Sign Logo" />
      </div>

      <h1>Bonjour ${nom},</h1>

      <p>Une demande de réinitialisation de mot de passe a été effectuée sur votre compte <strong>Sign</strong>.</p>
      <p>Pour des raisons de sécurité, nous devons vérifier que cette demande provient bien de vous.</p>

      <div class="info">
        👉 Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.<br/>
        ⏱️ Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.
      </div>

      <div style="text-align:center;">
        <a class="btn" href="${resetLink}">Réinitialiser mon mot de passe</a>
      </div>

      <p>Si vous n'êtes pas à l'origine de cette demande, aucune action n'est requise. Votre mot de passe actuel restera inchangé.</p>

      <div class="footer">
        © ${new Date().getFullYear()} – Sign<br/>
        Email automatique, merci de ne pas répondre.
      </div>

    </div>
  </body>
  </html>
  `;
};
