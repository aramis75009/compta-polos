import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { contexteTrello } from "@/lib/settings";
import { origineDe } from "@/lib/hosts";
import { createWebhook, listBoardLabels, listBoards } from "@/lib/trello";
import type { TrelloBoardDTO, TrelloLabelDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/user/settings/trello        → boards accessibles (teste les clés)
// GET /api/user/settings/trello?boardId=… → étiquettes de ce board
//
// Lecture seule : l'utilisateur choisit son board et ses étiquettes dans des
// menus déroulants au lieu de recopier des identifiants à la main.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const ctx = await contexteTrello(userId);
    if (!ctx) {
      return NextResponse.json(
        { error: "Renseigne d'abord ta clé et ton token Trello." },
        { status: 400 },
      );
    }

    const boardId = req.nextUrl.searchParams.get("boardId");
    if (boardId) {
      const labels = await listBoardLabels(ctx, boardId);
      const dto: TrelloLabelDTO[] = labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      }));
      return NextResponse.json({ labels: dto });
    }

    const boards = await listBoards(ctx);
    const dto: TrelloBoardDTO[] = boards.map((b) => ({
      id: b.id,
      name: b.name,
    }));
    return NextResponse.json({ boards: dto });
  } catch (err) {
    console.error("GET /api/user/settings/trello", err);
    // Le message d'erreur Trello contient le statut HTTP, utile à l'utilisateur
    // (401 = clés invalides, 404 = board inaccessible avec ce token).
    const message =
      err instanceof Error ? err.message : "Trello n'a pas répondu.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// POST /api/user/settings/trello — enregistre le webhook sur le board du compte.
//
// C'est `scripts/setup-trello-webhook.ts` devenu une action applicative : le
// frère n'a pas de terminal.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const ctx = await contexteTrello(userId);
    // Un `boardId` présent appartient forcément au compte depuis le 15/08/2026 :
    // la cascade ne retombe plus sur le board du déploiement. Le garde-fou
    // `boardDuCompte` qui protégeait cette écriture est devenu structurel.
    if (!ctx?.boardId) {
      return NextResponse.json(
        { error: "Choisis d'abord ton board Trello." },
        { status: 400 },
      );
    }

    // L'URL de rappel est déduite de la requête, pas de NEXTAUTH_URL : un
    // webhook enregistré sur une adresse que l'application ne sert plus est un
    // webhook mort, que Trello finit par désactiver.
    const base = origineDe(req).replace(/\/$/, "");
    if (!base || base.includes("localhost")) {
      return NextResponse.json(
        {
          error:
            "Trello ne peut pas appeler localhost : cette connexion doit se faire depuis l'application en ligne.",
        },
        { status: 400 },
      );
    }

    const webhook = (await createWebhook(
      ctx,
      `${base}/api/webhooks/trello`,
      ctx.boardId,
    )) as { id?: string };

    // L'id est conservé pour pouvoir SUPPRIMER le webhook à la déconnexion.
    // Sans lui, un compte déconnecté laisse derrière lui un webhook orphelin
    // qui continue de frapper l'application jusqu'à ce que Trello le désactive.
    if (webhook.id) {
      await prisma.userSettings.update({
        where: { userId },
        data: { trelloWebhookId: webhook.id },
      });
    }

    return NextResponse.json({ ok: true, webhookId: webhook.id ?? null });
  } catch (err) {
    console.error("POST /api/user/settings/trello", err);
    const message =
      err instanceof Error ? err.message : "Création du webhook impossible.";
    // Trello renvoie 400 « A webhook with that callback, model, and token
    // already exists » quand la connexion est déjà en place : ce n'est pas un
    // échec du point de vue de l'utilisateur.
    if (/already exists/i.test(message)) {
      return NextResponse.json({ ok: true, deja: true });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
