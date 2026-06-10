import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { deriveVente, euros, STATUT_VENDU, STATUTS } from "@/lib/calc";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const MUTATING = new Set(["update_articles_status", "mark_articles_sold"]);

// ---------- Définition des outils exposés à Claude ----------

const tools: Anthropic.Tool[] = [
  {
    name: "get_stats",
    description:
      "Récupère les indicateurs globaux : chiffre d'affaires total, marge nette totale, nombre d'articles en stock, nombre d'articles vendus et total d'articles.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_articles",
    description:
      "Récupère la liste des articles, avec filtres optionnels. 'sku' accepte un SKU exact, un préfixe (ex. 'PRL') ou une liste séparée par des virgules.",
    input_schema: {
      type: "object",
      properties: {
        marque: { type: "string", description: "Nom exact de la marque" },
        statut: { type: "string", description: "Statut exact" },
        sku: { type: "string", description: "SKU exact, préfixe ou liste" },
        limit: { type: "number", description: "Nombre max d'articles (défaut 50)" },
      },
    },
  },
  {
    name: "count_articles",
    description:
      "Compte les articles correspondant à un filtre (marque, statut, sku).",
    input_schema: {
      type: "object",
      properties: {
        marque: { type: "string" },
        statut: { type: "string" },
        sku: { type: "string", description: "SKU exact, préfixe ou liste" },
      },
    },
  },
  {
    name: "update_articles_status",
    description:
      "Modifie le statut d'un ensemble d'articles. Ne pas utiliser pour le statut 'Vendu' (utiliser mark_articles_sold). Le filtre peut cibler par marque, statut actuel, sku (exact/préfixe/liste) et limiter le nombre.",
    input_schema: {
      type: "object",
      properties: {
        filtre: {
          type: "object",
          properties: {
            marque: { type: "string" },
            statut_actuel: { type: "string" },
            sku: { type: "string", description: "SKU exact, préfixe ou liste" },
            limit: { type: "number", description: "Nombre max d'articles à modifier" },
          },
        },
        nouveau_statut: { type: "string", description: "Le nouveau statut" },
      },
      required: ["filtre", "nouveau_statut"],
    },
  },
  {
    name: "mark_articles_sold",
    description:
      "Marque des articles comme vendus avec un prix de vente et une date de vente (format ISO ou YYYY-MM-DD). Le filtre cible par marque, sku (exact/préfixe/liste) et limit.",
    input_schema: {
      type: "object",
      properties: {
        filtre: {
          type: "object",
          properties: {
            marque: { type: "string" },
            sku: { type: "string", description: "SKU exact, préfixe ou liste" },
            limit: { type: "number" },
          },
        },
        prixVente: { type: "number" },
        dateVente: { type: "string", description: "Date ISO ou YYYY-MM-DD" },
      },
      required: ["prixVente", "dateVente"],
    },
  },
];

const SYSTEM = `Tu es l'assistant IA de "Compta Polos", une application de gestion de stock pour un revendeur de vêtements de marque.
Réponds TOUJOURS en français, de façon concise.

Marques : "Polo Ralph Lauren" (SKU préfixe PRL), "Lacoste" (LAC), "Tommy Hilfiger" (TH).
Les SKU ont la forme PRL-001, LAC-001, TH-001.
Statuts possibles : ${STATUTS.join(", ")}.

Règles :
- Pour répondre à une QUESTION (CA, stock, comptage, liste), appelle les outils de lecture (get_stats, get_articles, count_articles) puis donne une réponse claire avec les chiffres réels. N'invente jamais de chiffres.
- Pour une ACTION de modification (changer un statut, marquer comme vendu), commence ta réponse par un plan clair commençant par "Je vais …", puis appelle l'outil correspondant (update_articles_status ou mark_articles_sold) pour préparer l'action.
- Quand l'utilisateur cite un préfixe comme "PRL", "LAC" ou "TH", utilise le filtre sku avec ce préfixe.
- Pour "les N premiers X", utilise le filtre sku (préfixe) avec limit = N.
- Pour mettre des articles "Vendu", utilise mark_articles_sold (jamais update_articles_status).`;

// ---------- Construction des filtres Prisma ----------

function skuWhere(sku?: string): Prisma.ArticleWhereInput {
  if (!sku) return {};
  const t = sku.trim();
  if (!t) return {};
  if (t.includes(",")) {
    return {
      sku: { in: t.split(",").map((s) => s.trim()).filter(Boolean) },
    };
  }
  return { sku: { startsWith: t } };
}

function buildWhere(f: {
  marque?: string;
  statut?: string;
  sku?: string;
}): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = { ...skuWhere(f.sku) };
  if (f.marque) where.marque = f.marque;
  if (f.statut) where.statut = f.statut;
  return where;
}

// ---------- Outils de lecture ----------

async function runRead(name: string, input: Record<string, unknown>) {
  if (name === "get_stats") {
    const arts = await prisma.article.findMany({
      select: { statut: true, prixVente: true, margeNette: true },
    });
    const vendus = arts.filter((a) => a.statut === STATUT_VENDU);
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      caTotal: round(vendus.reduce((s, a) => s + (a.prixVente ?? 0), 0)),
      margeNetteTotal: round(
        vendus.reduce((s, a) => s + (a.margeNette ?? 0), 0),
      ),
      enStock: arts.filter((a) => a.statut === "En stock").length,
      vendus: vendus.length,
      totalArticles: arts.length,
    };
  }

  if (name === "count_articles") {
    const where = buildWhere({
      marque: input.marque as string | undefined,
      statut: input.statut as string | undefined,
      sku: input.sku as string | undefined,
    });
    const count = await prisma.article.count({ where });
    return { count };
  }

  if (name === "get_articles") {
    const where = buildWhere({
      marque: input.marque as string | undefined,
      statut: input.statut as string | undefined,
      sku: input.sku as string | undefined,
    });
    const total = await prisma.article.count({ where });
    const limit = Math.min(Number(input.limit) || 50, 200);
    const articles = await prisma.article.findMany({
      where,
      orderBy: { sku: "asc" },
      take: limit,
      select: {
        sku: true,
        marque: true,
        statut: true,
        prixAchat: true,
        prixVente: true,
      },
    });
    return { total, retournes: articles.length, articles };
  }

  throw new Error(`Outil de lecture inconnu : ${name}`);
}

// ---------- Outils de mutation (exécutés après confirmation) ----------

async function runMutation(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === "update_articles_status") {
    const filtre = (input.filtre ?? {}) as {
      marque?: string;
      statut_actuel?: string;
      sku?: string;
      limit?: number;
    };
    const nouveau = String(input.nouveau_statut ?? "").trim();

    if (!STATUTS.includes(nouveau as never)) {
      return `❌ Statut invalide : « ${nouveau} ».`;
    }
    if (nouveau === STATUT_VENDU) {
      return "❌ Pour marquer des articles comme vendus, un prix de vente est requis (utilise « marquer comme vendu »).";
    }

    const where = buildWhere({
      marque: filtre.marque,
      statut: filtre.statut_actuel,
      sku: filtre.sku,
    });

    // Champs de vente remis à null si on quitte un état vendu (règle centrale).
    const data = {
      statut: nouveau,
      prixVente: null,
      dateVente: null,
      margeBrute: null,
      margeNette: null,
      coefficient: null,
    };

    let count: number;
    if (filtre.limit && filtre.limit > 0) {
      const ids = await prisma.article.findMany({
        where,
        orderBy: { sku: "asc" },
        take: filtre.limit,
        select: { id: true },
      });
      const res = await prisma.article.updateMany({
        where: { id: { in: ids.map((a) => a.id) } },
        data,
      });
      count = res.count;
    } else {
      const res = await prisma.article.updateMany({ where, data });
      count = res.count;
    }

    return `✓ ${count} article(s) passés au statut « ${nouveau} ».`;
  }

  if (name === "mark_articles_sold") {
    const filtre = (input.filtre ?? {}) as {
      marque?: string;
      sku?: string;
      limit?: number;
    };
    const prixVente = Number(input.prixVente);
    if (!Number.isFinite(prixVente) || prixVente <= 0) {
      return "❌ Prix de vente invalide.";
    }
    const dateVente = input.dateVente
      ? new Date(String(input.dateVente))
      : new Date();

    const where = buildWhere({ marque: filtre.marque, sku: filtre.sku });
    const articles = await prisma.article.findMany({
      where,
      orderBy: { sku: "asc" },
      take: filtre.limit && filtre.limit > 0 ? filtre.limit : undefined,
    });

    if (articles.length === 0) return "Aucun article ne correspond au filtre.";

    await prisma.$transaction(
      articles.map((a) => {
        const d = deriveVente({
          statut: STATUT_VENDU,
          prixAchat: a.prixAchat,
          prixVente,
          dateVente,
        });
        return prisma.article.update({
          where: { id: a.id },
          data: {
            statut: STATUT_VENDU,
            prixVente: d.prixVente,
            dateVente: d.dateVente,
            margeBrute: d.margeBrute,
            margeNette: d.margeNette,
            coefficient: d.coefficient,
          },
        });
      }),
    );

    return `✓ ${articles.length} article(s) marqués comme vendus à ${euros(prixVente)}.`;
  }

  return `❌ Action inconnue : ${name}.`;
}

function defaultPlan(name: string, input: Record<string, unknown>): string {
  if (name === "update_articles_status") {
    return `Je vais modifier le statut des articles correspondants vers « ${input.nouveau_statut} ».`;
  }
  if (name === "mark_articles_sold") {
    return `Je vais marquer les articles correspondants comme vendus à ${euros(Number(input.prixVente))}.`;
  }
  return "Je vais exécuter l'action demandée.";
}

// ---------- Handler ----------

type Body = {
  message?: string;
  confirmed?: boolean;
  pendingAction?: { tool: string; input: Record<string, unknown> } | null;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Clé ANTHROPIC_API_KEY manquante côté serveur." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Body;

    // --- Exécution après confirmation ---
    if (body.confirmed && body.pendingAction) {
      const { tool, input } = body.pendingAction;
      if (!MUTATING.has(tool)) {
        return NextResponse.json(
          { error: "Action non autorisée." },
          { status: 400 },
        );
      }
      const result = await runMutation(tool, input ?? {});
      return NextResponse.json({ result });
    }

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Message vide." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: message },
    ];

    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools,
      messages,
    });

    // Boucle : on exécute les outils de LECTURE et on relance Claude ;
    // dès qu'un outil de MUTATION apparaît, on s'arrête et on attend confirmation.
    for (let i = 0; i < 5; i++) {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const texte = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (toolUses.length === 0) {
        return NextResponse.json({ result: texte || "…" });
      }

      const mutation = toolUses.find((t) => MUTATING.has(t.name));
      if (mutation) {
        return NextResponse.json({
          plan: texte || defaultPlan(mutation.name, mutation.input as Record<string, unknown>),
          pendingAction: {
            tool: mutation.name,
            input: mutation.input as Record<string, unknown>,
          },
        });
      }

      // Tous les outils sont en lecture : on les exécute et on continue.
      messages.push({
        role: "assistant",
        content: response.content as Anthropic.ContentBlockParam[],
      });
      const toolResults: Anthropic.ContentBlockParam[] = [];
      for (const t of toolUses) {
        const data = await runRead(
          t.name,
          t.input as Record<string, unknown>,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: t.id,
          content: JSON.stringify(data),
        });
      }
      messages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        tools,
        messages,
      });
    }

    return NextResponse.json({
      result: "Je n'ai pas pu finaliser la demande, peux-tu reformuler ?",
    });
  } catch (err) {
    console.error("POST /api/chat", err);
    // Erreurs renvoyées par l'API Anthropic (crédits, quota, clé…) :
    // on remonte un message clair plutôt qu'un générique.
    if (err instanceof Anthropic.APIError) {
      const apiMsg =
        (err as { error?: { error?: { message?: string } } }).error?.error
          ?.message ?? err.message;
      let friendly = `Assistant indisponible : ${apiMsg}`;
      if (err.status === 400 && /credit balance/i.test(apiMsg)) {
        friendly =
          "Assistant indisponible : le solde de crédits du compte Anthropic est insuffisant. Ajoute des crédits sur console.anthropic.com (Plans & Billing).";
      } else if (err.status === 401) {
        friendly = "Assistant indisponible : clé API Anthropic invalide.";
      } else if (err.status === 429) {
        friendly = "Assistant indisponible : limite de requêtes atteinte, réessaie dans un instant.";
      }
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Erreur de l'assistant IA." },
      { status: 500 },
    );
  }
}
