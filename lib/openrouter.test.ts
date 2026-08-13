import { describe, expect, it } from "vitest";
import { construireRequete, lireReponse } from "./openrouter";

const img = (data: string, mimeType = "image/jpeg") => ({ mimeType, data });

/** Enveloppe une réponse OpenRouter autour d'un contenu d'assistant. */
const reponse = (content: unknown) => ({
  choices: [{ message: { role: "assistant", content } }],
});

const annonce = {
  titre: "Polo Ralph Lauren",
  description: "Belle pièce.",
  motsCles: "polo, ralph lauren",
};

describe("construireRequete", () => {
  it("place le prompt puis les photos dans un seul message utilisateur", () => {
    const corps = construireRequete("Rédige l'annonce.", [img("AAA"), img("BBB")], "x/y");
    expect(corps.messages).toHaveLength(1);
    expect(corps.messages[0].role).toBe("user");
    expect(corps.messages[0].content).toEqual([
      { type: "text", text: "Rédige l'annonce." },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAA" } },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,BBB" } },
    ]);
  });

  it("reporte le type MIME réel dans la data-URL", () => {
    // Une photo passée en PNG annoncée en JPEG est refusée par certains
    // fournisseurs : le préfixe doit suivre le fichier, pas une constante.
    const corps = construireRequete("p", [img("ZZZ", "image/png")], "x/y");
    expect(corps.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,ZZZ" },
    });
  });

  it("passe le modèle demandé", () => {
    expect(construireRequete("p", [img("A")], "anthropic/claude-haiku-4.5").model).toBe(
      "anthropic/claude-haiku-4.5",
    );
  });

  it("contraint la sortie aux trois champs de l'annonce, et à eux seuls", () => {
    // `strict` sans `additionalProperties: false` est refusé par l'API : les
    // deux vont ensemble, d'où le test qui les tient.
    const { json_schema } = construireRequete("p", [img("A")], "x/y").response_format;
    expect(json_schema.strict).toBe(true);
    expect(json_schema.schema.additionalProperties).toBe(false);
    expect(Object.keys(json_schema.schema.properties).sort()).toEqual([
      "description",
      "motsCles",
      "titre",
    ]);
    expect(json_schema.schema.required.sort()).toEqual([
      "description",
      "motsCles",
      "titre",
    ]);
  });

  it("conserve un budget de réflexion", () => {
    // Voir le commentaire de generateListing : saturer un titre à 100
    // caractères et sortir ~80 mots-clés sans doublon ne se fait pas en un
    // passage. Remettre ce budget à 0 coûte une annonce à recorriger.
    expect(construireRequete("p", [img("A")], "x/y").reasoning).toEqual({
      max_tokens: 1024,
    });
  });
});

describe("lireReponse", () => {
  it("lit une réponse JSON nominale", () => {
    expect(lireReponse(reponse(JSON.stringify(annonce)))).toEqual(annonce);
  });

  it("retire les fences markdown que les modèles ajoutent malgré le schéma", () => {
    const contenu = "```json\n" + JSON.stringify(annonce) + "\n```";
    expect(lireReponse(reponse(contenu))).toEqual(annonce);
  });

  it("restaure les sauts de ligne doublement échappés", () => {
    // Vu régulièrement : le modèle écrit "\\n" là où il voulait un retour à la
    // ligne, et la description arrivait sur une seule ligne dans l'annonce.
    const brut = JSON.stringify({ ...annonce, description: "Ligne 1\\nLigne 2" });
    expect(lireReponse(reponse(brut)).description).toBe("Ligne 1\nLigne 2");
  });

  it("accepte un contenu découpé en plusieurs blocs de texte", () => {
    // Certains fournisseurs renvoient `content` en tableau de parts plutôt
    // qu'en chaîne. Sans recollage, le JSON était tronqué.
    const s = JSON.stringify(annonce);
    const parts = [
      { type: "text", text: s.slice(0, 10) },
      { type: "text", text: s.slice(10) },
    ];
    expect(lireReponse(reponse(parts))).toEqual(annonce);
  });

  it("rejette une erreur renvoyée dans un corps par ailleurs valide", () => {
    // OpenRouter répond parfois 200 avec l'erreur dans le corps : sans cette
    // garde, le message affiché était « réponse vide », qui n'aide personne.
    expect(() =>
      lireReponse({ error: { message: "Insufficient credits" } }),
    ).toThrow(/Insufficient credits/);
  });

  it("rejette une réponse sans choix", () => {
    expect(() => lireReponse({ choices: [] })).toThrow(/vide/i);
  });

  it("rejette un contenu qui n'est pas du JSON", () => {
    expect(() => lireReponse(reponse("Voici votre annonce !"))).toThrow(/JSON/i);
  });

  it("rejette une annonce à laquelle il manque un champ", () => {
    // Un titre vide passait jusqu'à l'écran d'export, où il devenait une
    // annonce sans nom : mieux vaut échouer ici.
    const partiel = JSON.stringify({ titre: "", description: "d", motsCles: "m" });
    expect(() => lireReponse(reponse(partiel))).toThrow(/titre/i);
  });
});
