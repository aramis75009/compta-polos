import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "onboarding@resend.dev";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendWelcomeEmail(email: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Bienvenue sur MyFlip 👋",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16261D">
        <div style="margin-bottom:24px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:#1B4332;border-radius:10px;color:white;font-size:20px;font-weight:700">M</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Bonjour ${name} 👋</h1>
        <p style="color:#71807A;font-size:15px;line-height:1.6;margin:0 0 24px">
          Ton compte MyFlip est prêt.<br>
          Commence par créer ta première commande pour alimenter ton stock et suivre ta rentabilité.
        </p>
        <a href="${BASE_URL}/dashboard"
           style="display:inline-block;background:#1B4332;color:white;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px">
          Accéder à MyFlip →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#94A29A">
          © 2026 MyFlip — outil personnel de pilotage de revente.
        </p>
      </div>
    `,
  });
}

export async function sendResetEmail(email: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Réinitialisation de ton mot de passe MyFlip",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16261D">
        <div style="margin-bottom:24px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:#1B4332;border-radius:10px;color:white;font-size:20px;font-weight:700">M</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Réinitialisation du mot de passe</h1>
        <p style="color:#71807A;font-size:15px;line-height:1.6;margin:0 0 24px">
          Tu as demandé à réinitialiser ton mot de passe MyFlip.<br>
          Ce lien est valable <strong>1 heure</strong>.
        </p>
        <a href="${url}"
           style="display:inline-block;background:#1B4332;color:white;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px">
          Réinitialiser mon mot de passe →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#94A29A">
          Si tu n'as pas fait cette demande, ignore cet email.
        </p>
        <p style="margin-top:8px;font-size:12px;color:#94A29A">
          © 2026 MyFlip
        </p>
      </div>
    `,
  });
}
