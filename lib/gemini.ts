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
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante.");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/** Envoie le prompt compilé + les photos à Gemini et renvoie l'annonce structurée. */
export async function generateListing(
  prompt: string,
  images: GeminiImage[],
): Promise<ListingResult> {
  const ai = getClient();
  const res = await ai.models.generateContent({
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

  const text = res.text;
  if (!text) throw new Error("Réponse vide de Gemini.");

  let parsed: Partial<ListingResult>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Réponse Gemini non-JSON.");
  }
  return {
    titre: String(parsed.titre ?? "").trim(),
    description: String(parsed.description ?? "").trim(),
    motsCles: String(parsed.motsCles ?? "").trim(),
  };
}
