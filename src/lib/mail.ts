import nodemailer, { type Transporter } from "nodemailer";

// Envoi SMTP des courriels de la file d'attente. Réglages dans .env.local (voir .env.example) :
// SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
// Tant que SMTP_HOST et SMTP_FROM ne sont pas renseignés, l'envoi est considéré non configuré
// (le dépôt de courriels en file d'attente continue, mais rien n'est expédié).

export function smtpConfigure(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

const globalPourMail = globalThis as unknown as { __transporteurMail?: Transporter };

function obtenirTransporteur(): Transporter {
  if (!globalPourMail.__transporteurMail) {
    globalPourMail.__transporteurMail = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "1",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return globalPourMail.__transporteurMail;
}

// `html` est facultatif : les courriels de notification (file d'attente, voir courriels.ts)
// restent en texte brut. `text` est toujours fourni en parallèle (certaines messageries l'affichent
// par défaut, et c'est plus robuste pour les lecteurs d'écran).
export async function envoyerCourriel(destinataire: string, sujet: string, corps: string, html?: string): Promise<void> {
  await obtenirTransporteur().sendMail({
    from: process.env.SMTP_FROM,
    to: destinataire,
    subject: sujet,
    text: corps,
    ...(html ? { html } : {}),
  });
}

// Habillage HTML simple pour les courriels transactionnels (connexion, inscription) : styles en
// ligne uniquement (sans dépendance externe), pour un rendu correct dans la plupart des messageries.
export function gabaritCourrielHtml(contenuHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px 16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e6ec;">
      <tr>
        <td style="background:#1f5f8b;padding:20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#ffffff;border-radius:8px;text-align:center;vertical-align:middle;font-weight:bold;color:#1f5f8b;font-size:18px;">F</td>
            <td style="padding-left:12px;color:#ffffff;font-size:17px;font-weight:bold;">Folio GEA</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;color:#1c2430;font-size:15px;line-height:1.55;">
          ${contenuHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;background:#f8f9fb;color:#5d6878;font-size:12px;border-top:1px solid #e2e6ec;">
          Portfolio de compétences du BUT GEA
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function echapperHtml(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
