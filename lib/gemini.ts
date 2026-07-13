// Client Gemini pour la génération d'annonces (serveur uniquement).
import { GoogleGenAI, Type } from "@google/genai";

export type ListingResult = {
  titre: string;
  description: string;
  motsCles: string;
};

export type GeminiImage = { mimeType: string; data: string }; // data = base64 (sans préfixe)

// gemini-2.5-flash : modèle flash actuel disponible (gemini-2.0-flash a été
// retiré par Google → 404 NOT_FOUND). Erreur exacte loggée en cas d'échec.
const MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "[gemini] GEMINI_API_KEY introuvable dans process.env — vérifier .env.local / variables Vercel.",
    );
    throw new Error("GEMINI_API_KEY manquante.");
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Nettoie la réponse texte de Gemini avant JSON.parse : retire les fences
 * markdown (```json … ```) que le modèle ajoute parfois malgré responseMimeType.
 */
function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return t.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Détecte une erreur de surcharge Gemini (503 UNAVAILABLE). */
function is503(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b503\b/.test(msg) || /UNAVAILABLE/i.test(msg);
}

/** Envoie le prompt compilé + les photos à Gemini et renvoie l'annonce structurée. */
export async function generateListing(
  prompt: string,
  images: GeminiImage[],
): Promise<ListingResult> {
  const ai = getClient();
  const request = {
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...images.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      // Budget de réflexion volontairement conservé : les prompts d'annonce
      // demandent des tâches de comptage et de vérification (saturer le titre à
      // 100 caractères sans le dépasser, ~80 mots-clés sur 7 langues sans
      // doublon, contrôle qualité final). Un modèle rate ces tâches en un seul
      // passage. Ne pas remettre thinkingBudget à 0 pour gagner quelques
      // secondes : le coût est une annonce à recorriger à la main.
      thinkingConfig: { thinkingBudget: 1024 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titre: { type: Type.STRING },
          description: { type: Type.STRING },
          motsCles: { type: Type.STRING },
        },
        required: ["titre", "description", "motsCles"],
      },
    },
  };

  // Retry sur 503 (UNAVAILABLE) : Gemini surchargé. 3 tentatives, 2 s d'attente.
  const MAX_TRIES = 3;
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await ai.models.generateContent(request);
      break;
    } catch (err) {
      if (is503(err)) {
        if (attempt < MAX_TRIES) {
          console.error(
            `[gemini] 503 UNAVAILABLE (tentative ${attempt}/${MAX_TRIES}), nouvel essai dans 2 s…`,
          );
          await sleep(2000);
          continue;
        }
        console.error(
          `[gemini] 503 UNAVAILABLE après ${MAX_TRIES} tentatives :`,
          err,
        );
        throw new Error("Gemini surchargé, réessaie dans quelques instants.");
      }
      console.error("[gemini] Échec de generateContent :", err);
      throw new Error(
        `Appel Gemini échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const text = res.text;
  if (!text) {
    console.error("[gemini] Réponse vide. Réponse brute :", res);
    throw new Error("Réponse vide de Gemini.");
  }

  let parsed: Partial<ListingResult>;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch (err) {
    console.error(
      "[gemini] Parsing JSON impossible. Erreur :",
      err,
      "\nTexte brut :",
      text,
    );
    throw new Error("Réponse Gemini non-JSON.");
  }
  // Gemini échappe parfois les sauts de ligne une seconde fois ("\\n" littéral
  // dans la chaîne parsée) → on les restaure en vrais retours à la ligne.
  const unescape = (v: unknown) => String(v ?? "").trim().replace(/\\n/g, "\n");
  return {
    titre: unescape(parsed.titre),
    description: unescape(parsed.description),
    motsCles: unescape(parsed.motsCles),
  };
}
