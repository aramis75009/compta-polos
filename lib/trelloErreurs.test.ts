import { describe, expect, it } from "vitest";
import { CODES_ERREUR, codeDepuisStatut, messageErreur } from "@/lib/trelloErreurs";

describe("messageErreur", () => {
  it("rend un message français pour chaque code", () => {
    for (const code of CODES_ERREUR) {
      const m = messageErreur(code);
      expect(m.length).toBeGreaterThan(10);
      expect(m).not.toMatch(/undefined|TODO/);
    }
  });

  it("annonce qu'aucun accès n'a été enregistré en cas de refus", () => {
    expect(messageErreur("refus")).toBe(
      "La connexion Trello a été refusée. Aucun accès n'a été enregistré.",
    );
  });

  it("invite à reconnecter quand le jeton n'est plus valide", () => {
    expect(messageErreur("token-invalide")).toBe(
      "Ta connexion Trello n'est plus valide. Reconnecte ton compte Trello.",
    );
  });

  it("retombe sur un message générique pour un code inconnu", () => {
    expect(messageErreur("code-qui-nexiste-pas" as never)).toBe(
      "La connexion à Trello a échoué. Réessaie dans un instant.",
    );
  });
});

describe("codeDepuisStatut", () => {
  it("traduit 401 en jeton invalide", () => {
    expect(codeDepuisStatut(401)).toBe("token-invalide");
  });

  it("traduit 404 en ressource absente", () => {
    expect(codeDepuisStatut(404)).toBe("introuvable");
  });

  it("traduit tout le reste en erreur d'API", () => {
    expect(codeDepuisStatut(500)).toBe("api");
    expect(codeDepuisStatut(429)).toBe("api");
  });
});
