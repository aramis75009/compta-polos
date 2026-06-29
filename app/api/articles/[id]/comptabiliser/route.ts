import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveVente, STATUT_VENDU } from "@/lib/calc";
import { toDTO } from "@/lib/serialize";
import { removeComptabiliserLabel } from "@/lib/trello";

export const dynamic = "force-dynamic";

type Body = { prixVente?: number; dateVente?: string; canal?: string };

// POST /api/articles/[id]/comptabiliser
// 1. Marque l'article comme vendu (prixVente, dateVente, marges, coef, canal)
// 2. Retire l'étiquette « À comptabiliser » de la carte Trello
//    (la carte reste visible dans Trello — pas d'archivage).
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = (await req.json()) as Body;
    const prixVente = Number(body.prixVente);
    if (!Number.isFinite(prixVente) || prixVente <= 0) {
      return NextResponse.json(
        { error: "Prix de vente invalide." },
        { status: 400 },
      );
    }
    const dateVente = body.dateVente ? new Date(body.dateVente) : new Date();
    const canal = body.canal ? String(body.canal).trim() : undefined;

    const existing = await prisma.article.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Article introuvable." },
        { status: 404 },
      );
    }

    const d = deriveVente({
      statut: STATUT_VENDU,
      prixAchat: existing.prixAchat,
      prixVente,
      dateVente,
    });

    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        statut: STATUT_VENDU,
        prixVente: d.prixVente,
        dateVente: d.dateVente,
        margeBrute: d.margeBrute,
        margeNette: d.margeNette,
        coefficient: d.coefficient,
        ...(canal ? { canal } : {}),
      },
      include: { commande: true },
    });

    // --- Trello (best-effort : ne bloque pas la validation comptable) ---
    let trello: string | null = null;
    if (existing.trelloCardId) {
      try {
        // On retire uniquement l'étiquette « À comptabiliser ».
        // La carte n'est PAS archivée : elle reste visible dans Trello
        // avec ses autres étiquettes.
        await removeComptabiliserLabel(existing.trelloCardId);
        trello = "Étiquette retirée.";
      } catch (e) {
        console.error("Trello (comptabiliser)", e);
        trello = "Article validé, mais la synchro Trello a échoué.";
      }
    }

    return NextResponse.json({ article: toDTO(updated), trello });
  } catch (err) {
    console.error("POST /api/articles/[id]/comptabiliser", err);
    return NextResponse.json(
      { error: "Erreur lors de la validation." },
      { status: 500 },
    );
  }
}
