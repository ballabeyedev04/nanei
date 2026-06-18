module.exports = ({ nom, prenom, resetLink }) => {
  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Réinitialisation du mot de passe Administrateur</title>
    <style>
      body { font-family: 'Helvetica', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #ffffff; padding: 36px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
      .header { text-align: center; margin-bottom: 32px; }
      .logo-box { display: inline-flex; align-items: center; gap: 10px; }
      .logo-icon { width: 48px; height: 48px; background: #FF7A00; border-radius: 12px; display: inline-block; line-height: 48px; text-align: center; font-size: 22px; }
      .brand { font-size: 22px; font-weight: 800; color: #111827; }
      .badge { display: inline-block; margin-top: 12px; background: #FFF4E8; color: #FF7A00; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; border: 1px solid #FFB066; }
      h1 { color: #111827; font-size: 20px; margin: 28px 0 8px; }
      p { color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 14px; }
      .alert-box { background: #FFF4E8; border-left: 4px solid #FF7A00; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #7C2D12; }
      .btn-wrap { text-align: center; margin: 28px 0; }
      .btn { display: inline-block; padding: 14px 32px; background-color: #FF7A00; color: #fff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 16px rgba(255,122,0,0.35); letter-spacing: 0.01em; }
      .security-note { background: #F3F4F6; border-radius: 8px; padding: 14px 18px; font-size: 13px; color: #6B7280; margin-top: 20px; }
      .footer { text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 32px; border-top: 1px solid #E5E7EB; padding-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo-box">
          <span class="logo-icon">🚀</span>
          <span class="brand">Nanei</span>
        </div>
        <br/>
        <span class="badge">🔒 Espace Administrateur</span>
      </div>

      <h1>Bonjour ${prenom} ${nom},</h1>

      <p>
        Vous avez demandé la réinitialisation du mot de passe de votre compte
        <strong>administrateur Nanei</strong>. Cette action est sensible et sécurisée.
      </p>

      <div class="alert-box">
        ⏱️ Ce lien est valable <strong>10 minutes</strong> uniquement et ne peut être utilisé qu'une seule fois.<br/>
        🔑 Il est réservé exclusivement aux administrateurs actifs.
      </div>

      <div class="btn-wrap">
        <a class="btn" href="${resetLink}">Réinitialiser mon mot de passe</a>
      </div>

      <p>Si vous ne cliquez pas sur ce lien dans les 10 minutes, il expirera automatiquement et votre mot de passe actuel restera inchangé.</p>

      <div class="security-note">
        🛡️ <strong>Vous n'avez pas fait cette demande ?</strong><br/>
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et contactez immédiatement votre équipe de sécurité. Votre compte n'a pas été compromis.
      </div>

      <div class="footer">
        © ${new Date().getFullYear()} Nanei — Tableau de bord Administration<br/>
        Email automatique, merci de ne pas répondre directement.
      </div>
    </div>
  </body>
  </html>
  `;
};
