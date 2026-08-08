import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { ensureDefaultPrompt, toPromptDTO } from "@/lib/promptsServer";
import { compilePrompt, pickPrompt } from "@/lib/promptSelect";
import { generateListing, type GeminiImage } from "@/lib/gemini";
import { resoudreReglages } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // la génération Gemini peut être longue

type Body = {
  sku?: string;
  marque?: string | null;
  categorie?: string | null;
  taille?: string | null;
  etat?: string | null;
  matiere?: string | null;
  details?: string | null; // infos libres saisies par l'utilisateur
  images?: string[]; // dataURL ("data:image/jpeg;base64,…") ou base64 brut
  promptId?: string; // prompt choisi manuellement côté client
};

// Parse une image client (dataURL ou base64 brut) → { mimeType, data }.
function parseImage(raw: string): GeminiImage {
  const m = raw.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/jpeg", data: raw };
}

// POST /api/listings/generate
export async function POST(req: NextRequest) {
  // Cette route consomme la clé Gemini du serveur : sans garde, n'importe qui
  // pouvait générer des annonces aux frais du déploiement.
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const body = (await req.json()) as Body;
    const images = (body.images ?? []).filter(Boolean);
    if (images.length === 0) {
      return NextResponse.json(
        { error: "Au moins une photo est requise." },
        { status: 400 },
      );
    }

    // Sélection du prompt : manuel (promptId fourni) ou automatique.
    await ensureDefaultPrompt(userId);
    let tmpl = null;
    if (body.promptId) {
      // findFirst avec userId : un promptId d'un autre compte est traité comme
      // inexistant et retombe sur la sélection automatique.
      const found = await prisma.promptTemplate.findFirst({
        where: { id: body.promptId, userId },
      });
      if (found) tmpl = toPromptDTO(found);
    }
    if (!tmpl) {
      const prompts = await prisma.promptTemplate.findMany({
        where: { userId },
      });
      tmpl = pickPrompt(
        prompts.map(toPromptDTO),
        body.marque ?? null,
        body.categorie ?? null,
      );
    }
    if (!tmpl) {
      return NextResponse.json(
        { error: "Aucun prompt disponible." },
        { status: 500 },
      );
    }

    const compiled = compilePrompt(tmpl.contenu, {
      marque: body.marque,
      categorie: body.categorie,
      taille: body.taille,
      etat: body.etat,
      matiere: body.matiere,
      sku: body.sku,
      details: body.details,
    });

    // Clé de l'utilisateur si elle existe, sinon celle de l'application.
    const reglages = await resoudreReglages(userId);
    const result = await generateListing(
      compiled,
      images.map(parseImage),
      reglages.geminiKey,
    );

    return NextResponse.json({ ...result, promptNom: tmpl.nom });
  } catch (err) {
    console.error("POST /api/listings/generate", err);
    const message =
      err instanceof Error ? err.message : "Erreur lors de la génération.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
