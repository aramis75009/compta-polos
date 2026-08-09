import { Resend } from "resend";

// Client instancié paresseusement (même pattern que lib/gemini.ts).
// Au niveau module, `new Resend()` s'exécuterait pendant `next build` — Next
// charge les routes pour collecter leurs métadonnées — et ferait échouer le
// build sur tout déploiement où RESEND_API_KEY n'est pas définie.
// Un build ne doit jamais dépendre d'un secret d'exécution.
let resend: Resend | null = null;
function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[resend] RESEND_API_KEY introuvable — vérifier .env.local / variables Vercel.",
    );
    throw new Error("RESEND_API_KEY manquante.");
  }
  if (!resend) resend = new Resend(apiKey);
  return resend;
}

const FROM = "onboarding@resend.dev";

/**
 * Adresse de base des liens envoyés par e-mail.
 *
 * Passée par l'appelant, qui la déduit de la requête (`origineDe`). Elle était
 * lue dans `NEXTAUTH_URL` : après un changement de domaine, les liens de
 * réinitialisation pointaient sur l'ancienne adresse — ou pire, sur
 * `localhost` si la variable disparaissait. Un lien mort dans un e-mail ne se
 * rattrape pas : l'utilisateur ne peut plus se connecter et n'a aucun recours.
 *
 * Le repli sur `NEXTAUTH_URL` reste pour les appels sans requête (scripts).
 */
const base = (baseUrl?: string) =>
  (baseUrl || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );

export async function sendWelcomeEmail(
  email: string,
  name: string,
  baseUrl?: string,
) {
  const BASE_URL = base(baseUrl);
  await getResend().emails.send({
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

export async function sendResetEmail(
  email: string,
  token: string,
  baseUrl?: string,
) {
  const url = `${base(baseUrl)}/reset-password?token=${token}`;
  await getResend().emails.send({
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
