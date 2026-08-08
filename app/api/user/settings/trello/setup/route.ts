import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { contexteTrello } from "@/lib/settings";
import { preparerBoard } from "@/lib/trelloSetup";

export const dynamic = "force-dynamic";

// POST /api/user/settings/trello/setup
//
// Crée sur le board de l'utilisateur les colonnes et les étiquettes attendues
// par MyFlip, puis enregistre les identifiants des deux étiquettes de
// comptabilité. Idempotent : relancer ne duplique rien.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      transporteurs?: boolean;
    };

    const ctx = await contexteTrello(userId);
    // `boardDuCompte` et pas seulement `boardId` : sans board explicitement
    // choisi, la cascade retombe sur le board du déploiement, et on créerait
    // des colonnes sur le Trello de quelqu'un d'autre.
    if (!ctx?.boardId || !ctx.boardDuCompte) {
      return NextResponse.json(
        { error: "Choisis d'abord ton board Trello." },
        { status: 400 },
      );
    }

    const resultat = await preparerBoard(ctx, ctx.boardId, {
      transporteurs: body.transporteurs !== false,
    });

    // Les deux étiquettes de comptabilité sont enregistrées dans la foulée :
    // les créer sans les désigner à MyFlip ne servirait à rien.
    if (resultat.labelId || resultat.comptabiliseLabelId) {
      await prisma.userSettings.update({
        where: { userId },
        data: {
          ...(resultat.labelId ? { trelloLabelId: resultat.labelId } : {}),
          ...(resultat.comptabiliseLabelId
            ? { trelloComptabiliseLabelId: resultat.comptabiliseLabelId }
            : {}),
        },
      });
    }

    return NextResponse.json({ ok: true, ...resultat });
  } catch (err) {
    console.error("POST /api/user/settings/trello/setup", err);
    const message =
      err instanceof Error ? err.message : "Préparation du board impossible.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
