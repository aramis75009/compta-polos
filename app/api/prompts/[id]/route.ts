import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPromptDTO } from "@/lib/promptsServer";

type Body = {
  nom?: string;
  marque?: string | null;
  categorie?: string | null;
  contenu?: string;
  estDefaut?: boolean;
};

function critere(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "toutes") return null;
  return t;
}

// PATCH /api/prompts/[id] — édition
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json()) as Body;
    const data: Record<string, unknown> = {};
    if (body.nom !== undefined) {
      const nom = body.nom.trim();
      if (!nom) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
      data.nom = nom;
    }
    if (body.contenu !== undefined) {
      const contenu = body.contenu.trim();
      if (!contenu)
        return NextResponse.json({ error: "Contenu requis." }, { status: 400 });
      data.contenu = contenu;
    }
    if (body.marque !== undefined) data.marque = critere(body.marque);
    if (body.categorie !== undefined) data.categorie = critere(body.categorie);
    if (body.estDefaut !== undefined) data.estDefaut = Boolean(body.estDefaut);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.estDefaut === true) {
        await tx.promptTemplate.updateMany({
          where: { estDefaut: true, id: { not: params.id } },
          data: { estDefaut: false },
        });
      }
      return tx.promptTemplate.update({ where: { id: params.id }, data });
    });

    return NextResponse.json(toPromptDTO(updated));
  } catch (err) {
    console.error("PATCH /api/prompts/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du prompt." },
      { status: 500 },
    );
  }
}

// DELETE /api/prompts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.promptTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/prompts/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du prompt." },
      { status: 500 },
    );
  }
}
