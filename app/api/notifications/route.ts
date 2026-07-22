import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";
import type { NotificationItem, NotificationsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/notifications — rappels d'actions à mener, dérivés du stock.
// Une seule requête, agrégée en mémoire (volume faible, cf. dashboard).
export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      select: { statut: true, titreAnnonce: true },
    });

    const aComptabiliser = articles.filter(
      (a) => a.statut === STATUT_A_COMPTABILISER,
    ).length;

    const brouillons = articles.filter((a) => a.statut === "Brouillon").length;

    // Articles photographiés, prêts pour la rédaction de l'annonce.
    const photosPretes = articles.filter(
      (a) => a.statut === "Photos prêtes",
    ).length;

    // « En stock » = pas encore photographié (les photographiés sont « Photos prêtes »).
    const sansPhotos = articles.filter((a) => a.statut === "En stock").length;

    // Annonce rédigée mais article pas encore mis en vente : il ne reste qu'à publier.
    const annoncePrete = articles.filter(
      (a) =>
        !!a.titreAnnonce &&
        (a.statut === "Brouillon" || a.statut === "En stock"),
    ).length;

    const encodeStatut = (s: string) => `/stock?statut=${encodeURIComponent(s)}`;

    // Ordre = priorité d'affichage. Chaque entrée n'apparaît que si count > 0.
    const candidats: NotificationItem[] = [
      {
        key: "a-comptabiliser",
        severity: "action",
        title: "Articles à comptabiliser",
        message:
          aComptabiliser > 1
            ? `${aComptabiliser} ventes attendent leur saisie comptable.`
            : "1 vente attend sa saisie comptable.",
        count: aComptabiliser,
        href: "/a-comptabiliser",
      },
      {
        key: "annonce-prete",
        severity: "action",
        title: "Annonces prêtes à publier",
        message:
          annoncePrete > 1
            ? `${annoncePrete} annonces sont rédigées mais pas encore en vente.`
            : "1 annonce est rédigée mais pas encore en vente.",
        count: annoncePrete,
        href: encodeStatut("Brouillon"),
      },
      {
        key: "brouillons",
        severity: "action",
        title: "Brouillons à mettre en vente",
        message:
          brouillons > 1
            ? `${brouillons} articles sont encore en brouillon.`
            : "1 article est encore en brouillon.",
        count: brouillons,
        href: encodeStatut("Brouillon"),
      },
      {
        key: "photos-pretes",
        severity: "action",
        title: "Photos prêtes à mettre en vente",
        message:
          photosPretes > 1
            ? `${photosPretes} articles sont photographiés, prêts pour la mise en vente.`
            : "1 article est photographié, prêt pour la mise en vente.",
        count: photosPretes,
        href: encodeStatut("Photos prêtes"),
      },
      {
        key: "sans-photos",
        severity: "info",
        title: "Stock sans photos prêtes",
        message:
          sansPhotos > 1
            ? `${sansPhotos} articles en stock attendent leurs photos avant mise en vente.`
            : "1 article en stock attend ses photos avant mise en vente.",
        count: sansPhotos,
        href: encodeStatut("En stock"),
      },
    ];

    const items = candidats.filter((n) => n.count > 0);
    const total = items.reduce((s, n) => s + n.count, 0);

    const dto: NotificationsDTO = { items, total };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/notifications", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des notifications." },
      { status: 500 },
    );
  }
}
