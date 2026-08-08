import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import {
  apercuSecret,
  chiffrer,
  chiffrementDisponible,
  dechiffrerOuNull,
} from "@/lib/crypto";
import { reglagesBruts, resoudreReglages } from "@/lib/settings";
import type { UserSettingsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// Champs chiffrés, et le nom sous lequel le client les envoie.
const SECRETS = [
  "geminiKey",
  "anthropicKey",
  "openrouterKey",
  "trelloKey",
  "trelloToken",
  "trelloSecret",
] as const;

// Champs stockés en clair (identifiants publics, préférences).
const CLAIRS = [
  "trelloBoardId",
  "trelloLabelId",
  "trelloComptabiliseLabelId",
  "modeleIA",
] as const;

type Body = Partial<
  Record<(typeof SECRETS)[number] | (typeof CLAIRS)[number], string | null>
> & {
  objectifMensuel?: number | null;
  onboardingEtape?: number;
  onboardingTermine?: boolean;
};

/**
 * État d'un secret, tel que l'API le renvoie.
 *
 * Un secret déchiffré ne sort JAMAIS d'ici : seulement « est-il renseigné » et
 * ses 4 derniers caractères, assez pour que l'utilisateur reconnaisse sa clé
 * sans qu'elle puisse être reconstituée.
 */
function etatSecret(stocke: string | null | undefined) {
  const clair = dechiffrerOuNull(stocke);
  return {
    renseigne: Boolean(clair),
    apercu: clair ? apercuSecret(clair) : null,
  };
}

// GET /api/user/settings
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const s = await reglagesBruts(userId);
    const resolus = await resoudreReglages(userId);

    const dto: UserSettingsDTO = {
      gemini: etatSecret(s?.geminiKey),
      anthropic: etatSecret(s?.anthropicKey),
      openrouter: etatSecret(s?.openrouterKey),
      trelloKey: etatSecret(s?.trelloKey),
      trelloToken: etatSecret(s?.trelloToken),
      trelloSecret: etatSecret(s?.trelloSecret),
      trelloBoardId: s?.trelloBoardId ?? null,
      trelloLabelId: s?.trelloLabelId ?? null,
      trelloComptabiliseLabelId: s?.trelloComptabiliseLabelId ?? null,
      modeleIA: s?.modeleIA ?? null,
      objectifMensuel: s?.objectifMensuel ?? null,
      onboardingEtape: s?.onboardingEtape ?? 1,
      onboardingTermine: s?.onboardingTermine ?? false,
      // D'où vient la valeur réellement utilisée : du compte, ou de
      // l'application. C'est ce qui permet d'afficher « tu utilises la clé de
      // l'app » plutôt que de laisser croire que rien n'est configuré.
      source: resolus.source,
      chiffrementDisponible: chiffrementDisponible(),
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/user/settings", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des réglages." },
      { status: 500 },
    );
  }
}

// PUT /api/user/settings — mise à jour partielle.
//
// Convention : champ absent du corps = inchangé ; champ présent et vide = effacé.
// Sans cette distinction, un formulaire qui n'affiche pas les secrets (il ne
// peut pas) les effacerait à chaque enregistrement.
export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    if (!chiffrementDisponible()) {
      return NextResponse.json(
        {
          error:
            "ENCRYPTION_KEY absente ou invalide : impossible d'enregistrer un secret.",
        },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Body;
    const data: Record<string, string | number | boolean | null> = {};

    for (const champ of SECRETS) {
      if (!(champ in body)) continue;
      const valeur = body[champ]?.trim() ?? "";
      data[champ] = valeur ? chiffrer(valeur) : null;
    }

    for (const champ of CLAIRS) {
      if (!(champ in body)) continue;
      const valeur = body[champ]?.trim() ?? "";
      data[champ] = valeur || null;
    }

    if ("onboardingEtape" in body) {
      const n = Number(body.onboardingEtape);
      // Borné : une étape hors plage bloquerait le parcours sur un écran vide.
      data.onboardingEtape = Number.isInteger(n)
        ? Math.min(Math.max(n, 1), 4)
        : 1;
    }
    if ("onboardingTermine" in body) {
      data.onboardingTermine = Boolean(body.onboardingTermine);
    }

    if ("objectifMensuel" in body) {
      const n = Number(body.objectifMensuel);
      data.objectifMensuel =
        body.objectifMensuel == null || !Number.isFinite(n) || n < 0 ? null : n;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Rien à enregistrer." },
        { status: 400 },
      );
    }

    // `trelloBoardId` est unique : deux comptes ne peuvent pas revendiquer le
    // même board, sinon le webhook ne saurait plus à qui livrer l'événement.
    if (typeof data.trelloBoardId === "string") {
      const pris = await prisma.userSettings.findUnique({
        where: { trelloBoardId: data.trelloBoardId },
        select: { userId: true },
      });
      if (pris && pris.userId !== userId) {
        return NextResponse.json(
          { error: "Ce board Trello est déjà rattaché à un autre compte." },
          { status: 409 },
        );
      }
    }

    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/user/settings", err);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement des réglages." },
      { status: 500 },
    );
  }
}
