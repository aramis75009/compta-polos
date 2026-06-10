import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { STATUTS } from "@/lib/calc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHEET_NAME = "GESTION DE STOCK";

// --- Helpers de parsing ---

function parseNum(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const n = parseFloat(
    String(val).replace(/[€\s]/g, "").replace(",", "."),
  );
  return Number.isFinite(n) ? n : null;
}

// "x2,25" → 2.25 ; number → tel quel ; null → null
function parseCoef(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const s = String(val).toLowerCase().replace("x", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Date JS → tel quel ; serial Excel (number) → conversion ; sinon parse string
function parseDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    return new Date((val - 25569) * 86400 * 1000);
  }
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Normalise un statut vers la liste connue ; sinon "Brouillon".
function normStatut(val: unknown): string {
  const s = String(val ?? "").trim();
  if (!s) return "Brouillon";
  const found = STATUTS.find((x) => x.toLowerCase() === s.toLowerCase());
  return found ?? "Brouillon";
}

function str(val: unknown): string {
  return String(val ?? "").trim();
}

// POST /api/commandes/import — multipart/form-data
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const fournisseur = str(form.get("fournisseur"));
    const dateStr = str(form.get("date"));
    const file = form.get("fichier");

    if (!fournisseur) {
      return NextResponse.json(
        { error: "Fournisseur requis." },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Fichier .xlsx requis." },
        { status: 400 },
      );
    }

    const date = dateStr ? new Date(dateStr) : new Date();

    // Lecture du classeur (cellDates → cellules date en objets Date).
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[SHEET_NAME];
    if (!sheet) {
      return NextResponse.json(
        {
          error: `Feuille « ${SHEET_NAME} » introuvable. Feuilles disponibles : ${wb.SheetNames.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      blankrows: false,
    });

    let nbErreurs = 0;
    let nbDoublons = 0;
    const categoriesSet = new Set<string>();
    const seen = new Set<string>();
    type Parsed = {
      sku: string;
      categorie: string;
      marque: string;
      grade: string | null;
      statut: string;
      prixAchat: number;
      prixVente: number | null;
      margeBrute: number | null;
      margeNette: number | null;
      coefficient: number | null;
      dateVente: Date | null;
    };
    const parsed: Parsed[] = [];

    // Colonnes : 0 Catégorie | 1 SKU | 2 Grade | 3 Statut | 4 Prix achat |
    // 5 Prix vente | 6 Marge brute | 7 Marge nette | 8 Coeff | 9 Date vente
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r)) continue;
      try {
        const sku = str(r[1]);
        if (!sku) continue; // ignorer lignes sans SKU
        if (seen.has(sku)) {
          nbDoublons += 1; // doublon interne au fichier
          continue;
        }
        seen.add(sku);

        const categorie = str(r[0]) || "À définir";
        categoriesSet.add(categorie);

        parsed.push({
          sku,
          categorie,
          marque: categorie, // pas de colonne marque dans la feuille
          grade: str(r[2]) || null,
          statut: normStatut(r[3]),
          prixAchat: parseNum(r[4]) ?? 0,
          prixVente: parseNum(r[5]),
          margeBrute: parseNum(r[6]),
          margeNette: parseNum(r[7]),
          coefficient: parseCoef(r[8]),
          dateVente: parseDate(r[9]),
        });
      } catch {
        nbErreurs += 1;
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne valide (SKU manquant) dans la feuille." },
        { status: 400 },
      );
    }

    const coutTotal = parsed.reduce((s, p) => s + p.prixAchat, 0);
    const nbArticles = parsed.length;

    // Création de la commande.
    const commande = await prisma.commande.create({
      data: { fournisseur, date, coutTotal, nbArticles },
    });

    // SKU déjà existants en base → on rattache (pas de doublon).
    const skus = parsed.map((p) => p.sku);
    const existingRows = await prisma.article.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });
    const existingSet = new Set(existingRows.map((r) => r.sku));

    const toCreate = parsed
      .filter((p) => !existingSet.has(p.sku))
      .map((p) => ({ ...p, commandeId: commande.id }));
    const dupSkus = parsed
      .filter((p) => existingSet.has(p.sku))
      .map((p) => p.sku);

    await prisma.$transaction([
      prisma.article.createMany({ data: toCreate }),
      prisma.article.updateMany({
        where: { sku: { in: dupSkus } },
        data: { commandeId: commande.id },
      }),
    ]);

    return NextResponse.json({
      commandeId: commande.id,
      nbImportes: toCreate.length,
      nbDoublons: nbDoublons + dupSkus.length,
      nbErreurs,
      categories: Array.from(categoriesSet),
    });
  } catch (err) {
    const e = err as Error;
    console.error("POST /api/commandes/import", err);
    return NextResponse.json(
      { error: `Erreur d'import : ${e.message}` },
      { status: 500 },
    );
  }
}
