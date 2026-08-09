import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { inviteCodeValide } from "@/lib/invite";
import { DEFAULT_PROMPT_CONTENU } from "@/lib/promptSelect";
import { sendWelcomeEmail } from "@/lib/emails";
import { origineDe } from "@/lib/hosts";

export const dynamic = "force-dynamic";

// Offres de la landing. Purement indicatif : aucun quota ni facturation n'est
// appliqué aujourd'hui, on mémorise seulement le bouton cliqué.
const PLANS = ["solo", "atelier", "negoce"];

type Body = {
  prenom?: string;
  email?: string;
  password?: string;
  code?: string;
  plan?: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const prenom = body.prenom?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    // Le code est vérifié EN PREMIER, avant toute requête en base : sans lui,
    // la route ne doit rien révéler — pas même si un e-mail est déjà pris.
    if (!inviteCodeValide(body.code)) {
      return NextResponse.json(
        { error: "Code d'invitation invalide." },
        { status: 403 },
      );
    }

    if (!prenom) {
      return NextResponse.json({ error: "Prénom requis." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 8 caractères." },
        { status: 400 },
      );
    }

    const existant = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existant) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email." },
        { status: 409 },
      );
    }

    const hash = await bcrypt.hash(password, 10);
    const plan = PLANS.includes(body.plan ?? "") ? body.plan : null;

    // Compte et prompt par défaut dans la même transaction : un utilisateur sans
    // prompt ne pourrait pas générer d'annonce, et `ensureDefaultPrompt` ne
    // s'exécute qu'au premier passage sur la page concernée.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, password: hash, prenom, plan },
      });

      await tx.promptTemplate.create({
        data: {
          nom: "Prompt par défaut",
          contenu: DEFAULT_PROMPT_CONTENU,
          estDefaut: true,
          userId: user.id,
        },
      });
    });

    // Best-effort, comme la synchro Trello : une clé Resend absente ou en panne
    // ne doit pas annuler un compte déjà créé.
    try {
      await sendWelcomeEmail(email, prenom, origineDe(req));
    } catch (e) {
      console.error("[signup] email de bienvenue non envoyé", e);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/auth/signup", err);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte." },
      { status: 500 },
    );
  }
}
