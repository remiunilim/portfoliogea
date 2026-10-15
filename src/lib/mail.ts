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

export async function envoyerCourriel(destinataire: string, sujet: string, corps: string): Promise<void> {
  await obtenirTransporteur().sendMail({
    from: process.env.SMTP_FROM,
    to: destinataire,
    subject: sujet,
    text: corps,
  });
}
