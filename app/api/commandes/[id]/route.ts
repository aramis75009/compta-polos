import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/apiAuth";
import { deriveVente, prixUnitaire, STATUT_VENDU } from "@/lib/calc";
import type { CommandeDTO } from "@/lib/types";

type PatchBody = {
  fournisseur?: string;
  date?: string;
  coutTotal?: number;
  nbArticles?: number;
};

// PATCH /api/commandes/[id]
// Si coutTotal ou nbArticles change, le prix unitaire est recalculé et propagé
// au prix d'achat de tous les articles de la commande (et les marges des
// articles vendus sont recalculées en conséquence).
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const body = (await req.json()) as PatchBody;

    const existing = await prisma.commande.findFirst({
      where: { id: params.id, userId },
      include: { lots: { orderBy: { createdAt: "asc" } } },
    });
    if (!existing) return notFound("Commande");

    const fournisseur =
      body.fournisseur !== undefined
        ? body.fournisseur.trim()
        : existing.fournisseur;
    if (!fournisseur)
      return NextResponse.json(
        { error: "Fournisseur requis." },
        { status: 400 },
      );

    const date = body.date !== undefined ? new Date(body.date) : existing.date;

    const coutTotal =
      body.coutTotal !== undefined
        ? Number(body.coutTotal)
        : existing.coutTotal;
    if (!Number.isFinite(coutTotal) || coutTotal <= 0)
      return NextResponse.json(
        { error: "Coût total invalide." },
        { status: 400 },
      );

    const nbArticles =
      body.nbArticles !== undefined
        ? Number(body.nbArticles)
        : existing.nbArticles;
    if (!Number.isInteger(nbArticles) || nbArticles <= 0)
      return NextResponse.json(
        { error: "Nombre d'articles invalide." },
        { status: 400 },
      );

    const prixAchat = prixUnitaire(coutTotal, nbArticles);
    const coutChanged =
      coutTotal !== existing.coutTotal || nbArticles !== existing.nbArticles;

    // ⚠️ Propager un prix unique n'a de sens que sur une commande à UN SEUL lot
    // saisi au forfait, où toutes les pièces partagent par définition le même
    // prix. Dès qu'il y a plusieurs lots, ou un lot saisi pièce par pièce,
    // l'`updateMany` ci-dessous écraserait par une moyenne des prix qui ne le
    // sont pas — les 30 t-shirts prendraient le prix des 50 polos, en silence.
    const lotUnique = existing.lots.length <= 1;
    const auForfait = existing.lots.every((l) => l.modeSaisie === "LOT");
    const propage =
      coutChanged &&
      lotUnique &&
      auForfait &&
      // Commandes antérieures aux lots : on retombe sur l'ancien critère.
      (existing.lots.length > 0 || existing.modeSaisie === "LISSE");

    if (coutChanged && !propage) {
      return NextResponse.json(
        {
          error: !lotUnique
            ? "Cette commande contient plusieurs lots, à des prix d'achat différents. Modifie le prix depuis le lot concerné, ou article par article dans le Stock."
            : "Ce lot est saisi pièce par pièce : son coût total découle des prix saisis. Modifie les prix depuis le Stock.",
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.commande.update({
        where: { id: params.id },
        data: { fournisseur, date, coutTotal, nbArticles },
      });

      if (propage) {
        // Le lot suit : sans cela, son prixTotal et sa quantité contrediraient
        // ceux de la commande dès la première modification.
        if (existing.lots.length === 1) {
          await tx.lot.update({
            where: { id: existing.lots[0].id },
            data: {
              quantite: nbArticles,
              prixTotal: Math.max(
                coutTotal - (existing.fraisLivraison ?? 0),
                0,
              ),
            },
          });
        }

        // Propage le nouveau prix d'achat à tous les articles (1 requête).
        await tx.article.updateMany({
          where: { commandeId: params.id },
          data: { prixAchat },
        });

        // Recalcule les marges des articles vendus (peu nombreux).
        const vendus = await tx.article.findMany({
          where: { commandeId: params.id, statut: STATUT_VENDU },
        });
        for (const a of vendus) {
          const d = deriveVente({
            statut: a.statut,
            prixAchat,
            prixVente: a.prixVente,
            dateVente: a.dateVente,
          });
          await tx.article.update({
            where: { id: a.id },
            data: {
              margeBrute: d.margeBrute,
              margeNette: d.margeNette,
              coefficient: d.coefficient,
            },
          });
        }
      }
    });

    const dto: CommandeDTO = {
      id: existing.id,
      date: date.toISOString(),
      fournisseur,
      nbArticles,
      coutTotal,
      prixUnitaire: prixAchat,
      fraisLivraison: existing.fraisLivraison,
      modeSaisie: existing.modeSaisie,
      marque: existing.marque,
      categorie: existing.categorie,
      grade: existing.grade,
      coefObjectif: existing.coefObjectif,
      lots: existing.lots.map((l) => ({
        id: l.id,
        nom: l.nom,
        marque: l.marque,
        categorie: l.categorie,
        prefixeSku: l.prefixeSku,
        modeSaisie: l.modeSaisie,
        quantite: propage ? nbArticles : l.quantite,
        prixTotal: propage
          ? Math.max(coutTotal - (existing.fraisLivraison ?? 0), 0)
          : l.prixTotal,
      })),
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("PATCH /api/commandes/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la commande." },
      { status: 500 },
    );
  }
}

// DELETE /api/commandes/[id] — supprime la commande et ses articles
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    // Appartenance vérifiée AVANT la transaction : sans ce contrôle, la
    // suppression en cascade des articles s'exécuterait sur la commande d'un
    // autre compte avant que le delete final n'échoue.
    const owned = await prisma.commande.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!owned) return notFound("Commande");

    await prisma.$transaction([
      prisma.article.deleteMany({ where: { commandeId: params.id, userId } }),
      prisma.commande.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/commandes/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la commande." },
      { status: 500 },
    );
  }
}
