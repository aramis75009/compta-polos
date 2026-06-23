// Client Gemini pour la génération d'annonces (serveur uniquement).
import { GoogleGenAI, Type } from "@google/genai";

export type ListingResult = {
  titre: string;
  description: string;
  motsCles: string;
};

export type GeminiImage = { mimeType: string; data: string }; // data = base64 (sans préfixe)

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

/** Envoie le prompt compilé + les photos à Gemini et renvoie l'annonce structurée. */
export async function generateListing(
  prompt: string,
  images: GeminiImage[],
): Promise<ListingResult> {
  const ai = getClient();
  let res;
  try {
    res = await ai.models.generateContent({
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
    });
  } catch (err) {
    console.error("[gemini] Échec de generateContent :", err);
    throw new Error(
      `Appel Gemini échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
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
  return {
    titre: String(parsed.titre ?? "").trim(),
    description: String(parsed.description ?? "").trim(),
    motsCles: String(parsed.motsCles ?? "").trim(),
  };
}
