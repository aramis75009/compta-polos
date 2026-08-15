import { describe, expect, it } from "vitest";
import {
  appelsOutils,
  construireCorpsChat,
  ErreurAssistant,
  messageAssistantBrut,
  texteAssistant,
  type MessageChat,
  type OutilChat,
} from "./openrouterChat";

const outil: OutilChat = {
  type: "function",
  function: { name: "get_stats", description: "…", parameters: { type: "object", properties: {} } },
};

/** Enveloppe une réponse OpenRouter autour d'un message d'assistant. */
const reponse = (message: Record<string, unknown>) => ({
  choices: [{ message: { role: "assistant", ...message } }],
});

describe("construireCorpsChat", () => {
  it("place le system prompt en tête, avant l'historique", () => {
    const historique: MessageChat[] = [{ role: "user", content: "Combien de CA ?" }];
    const corps = construireCorpsChat("Tu es l'assistant.", [outil], historique, null);
    expect(corps.messages[0]).toEqual({ role: "system", content: "Tu es l'assistant." });
    expect(corps.messages[1]).toEqual(historique[0]);
  });

  it("retombe sur le modèle par défaut si aucun n'est fourni", () => {
    const corps = construireCorpsChat("s", [], [], null);
    expect(corps.model).toBe("anthropic/claude-sonnet-4.6");
  });

  it("passe le modèle demandé", () => {
    const corps = construireCorpsChat("s", [], [], "deepseek/deepseek-v4-flash-0731");
    expect(corps.model).toBe("deepseek/deepseek-v4-flash-0731");
  });

  it("laisse le modèle décider quand appeler un outil (tool_choice auto)", () => {
    expect(construireCorpsChat("s", [], [], null).tool_choice).toBe("auto");
  });
});

describe("texteAssistant", () => {
  it("lit le texte d'une réponse sans appel d'outil", () => {
    expect(texteAssistant(reponse({ content: "Le CA est de 1200€." }))).toBe(
      "Le CA est de 1200€.",
    );
  });

  it("renvoie une chaîne vide quand le tour ne contient que des appels d'outils", () => {
    expect(texteAssistant(reponse({ content: null, tool_calls: [] }))).toBe("");
  });

  it("lève si le corps porte une erreur malgré un 200", () => {
    // Piège connu côté OpenRouter (cf. lib/openrouter.ts) : crédits épuisés,
    // modèle indisponible… renvoyés avec un statut HTTP 200.
    expect(() => texteAssistant({ error: { message: "Insufficient credits." } })).toThrow(
      ErreurAssistant,
    );
  });

  it("lève si la réponse n'a aucun choix", () => {
    expect(() => texteAssistant({ choices: [] })).toThrow("Réponse vide du modèle.");
  });
});

describe("appelsOutils", () => {
  it("parse les arguments JSON de chaque appel", () => {
    const appels = appelsOutils(
      reponse({
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_stats", arguments: "{}" },
          },
          {
            id: "call_2",
            type: "function",
            function: { name: "get_articles", arguments: '{"marque":"Lacoste","limit":5}' },
          },
        ],
      }),
    );
    expect(appels).toEqual([
      { id: "call_1", name: "get_stats", input: {} },
      { id: "call_2", name: "get_articles", input: { marque: "Lacoste", limit: 5 } },
    ]);
  });

  it("renvoie un tableau vide en l'absence d'appel d'outil", () => {
    expect(appelsOutils(reponse({ content: "…" }))).toEqual([]);
  });

  it("nomme l'outil fautif quand ses arguments ne sont pas du JSON valide", () => {
    const bad = reponse({
      content: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "get_stats", arguments: "{not json" } },
      ],
    });
    expect(() => appelsOutils(bad)).toThrow("get_stats");
  });
});

describe("messageAssistantBrut", () => {
  it("garde tool_calls pour un tour qui en contient, à rejouer au tour suivant", () => {
    const toolCalls = [
      { id: "call_1", type: "function" as const, function: { name: "get_stats", arguments: "{}" } },
    ];
    expect(messageAssistantBrut(reponse({ content: null, tool_calls: toolCalls }))).toEqual({
      role: "assistant",
      content: null,
      tool_calls: toolCalls,
    });
  });

  it("omet tool_calls quand le tour n'en contient aucun", () => {
    expect(messageAssistantBrut(reponse({ content: "Voilà." }))).toEqual({
      role: "assistant",
      content: "Voilà.",
    });
  });
});
