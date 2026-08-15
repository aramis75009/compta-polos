import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { contexteTrello } from "@/lib/settings";
import { revoquerToken } from "@/lib/trelloOAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API = "https://api.trello.com/1";

// POST /api/trello/disconnect — révoque l'autorisation et efface tout.
//
// ⚠️ L'ORDRE COMPTE : on supprime le webhook AVANT de révoquer le jeton, parce
// qu'un webhook appartient au jeton qui l'a créé. Une fois le jeton révoqué, on
// ne peut plus supprimer le webhook, et Trello continue de frapper
// l'application jusqu'à ce qu'il le désactive de lui-même.
//
// Les deux appels à Trello sont best-effort : quoi qu'il arrive, les colonnes
// sont effacées. Un jeton qu'on ne stocke plus est inoffensif ; un jeton stocké
// qu'on croit révoqué ne l'est pas.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const ctx = await contexteTrello(userId);
    const s = await prisma.userSettings.findUnique({
      where: { userId },
      select: { trelloWebhookId: true },
    });

    if (ctx && s?.trelloWebhookId) {
      try {
        const res = await fetch(
          `${API}/webhooks/${s.trelloWebhookId}?key=${ctx.key}&token=${ctx.token}`,
          { method: "DELETE", cache: "no-store" },
        );
        // 404 = déjà supprimé côté Trello : le résultat voulu est atteint.
        if (!res.ok && res.status !== 404) {
          console.warn(`[trello] suppression du webhook : ${res.status}`);
        }
      } catch (e) {
        console.error("[trello] suppression du webhook échouée", e);
      }
    }

    // Seule une connexion OAuth se révoque : un jeton hérité a été émis avec la
    // clé personnelle de l'utilisateur, il n'appartient pas à MyFlip.
    if (ctx?.source === "oauth") {
      try {
        await revoquerToken(ctx.key, ctx.token);
      } catch (e) {
        console.error("[trello] révocation du jeton échouée", e);
      }
    }

    await prisma.userSettings.update({
      where: { userId },
      data: {
        trelloOauthToken: null,
        trelloOauthTokenSecret: null,
        trelloOauthRequestToken: null,
        trelloOauthRequestSecret: null,
        trelloOauthExpire: null,
        trelloMembreId: null,
        trelloMembreNom: null,
        trelloWebhookId: null,
        trelloBoardId: null,
        trelloLabelId: null,
        trelloComptabiliseLabelId: null,
        // La connexion héritée est effacée elle aussi : « Déconnecter Trello »
        // doit tout couper, pas basculer discrètement sur l'ancien accès.
        trelloKey: null,
        trelloToken: null,
        trelloSecret: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/trello/disconnect", err);
    return NextResponse.json({ error: "Déconnexion impossible." }, { status: 500 });
  }
}
