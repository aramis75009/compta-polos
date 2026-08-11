import { describe, expect, it } from "vitest";
import { cleRegroupement, libelleLot, LOT_INDETERMINE } from "./calc";

/**
 * Ces tests figent le comportement du regroupement du détail commande.
 *
 * Deux régressions à empêcher, dans cet ordre d'importance :
 *
 * 1. NE PAS APLATIR. Regrouper sur `lotId` écrase 6 commandes sur 22 en une
 *    seule ligne, parce que la migration a créé un `Lot` unique par commande.
 *    Le seul groupement fidèle est `Article.lot`.
 * 2. NE PAS RETOMBER SUR LA CATÉGORIE. Le tableau affichait « Polo » là où
 *    l'utilisateur attend « Polo Ralph Lauren ».
 */

const base = {
  lotId: null,
  lot: null,
  lotRef: null,
  marque: "Ralph Lauren",
  categorie: "Polo",
};

describe("cleRegroupement", () => {
  it("RÉGRESSION — n'aplatit pas des lots distincts partageant le même Lot", () => {
    // Cas réel : commande Grossiste KZ du 20/01/2026. La migration a rattaché
    // ses 6 lots à UN seul Lot nommé « Chemise Dickies ». Grouper sur lotId
    // ou sur lotRef.nom fondrait les six en une ligne portant le mauvais nom.
    const memeLot = { lotId: "lot_unique_migration", lotRef: { nom: "Chemise Dickies" } };
    const polaires = cleRegroupement({ ...base, ...memeLot, lot: "Crazy Polaires" });
    const islandais = cleRegroupement({ ...base, ...memeLot, lot: "Pulls islandais" });
    const dickies = cleRegroupement({ ...base, ...memeLot, lot: "Chemise Dickies" });

    expect(polaires.cle).not.toBe(islandais.cle);
    expect(polaires.cle).not.toBe(dickies.cle);
    expect(polaires.libelle).toBe("Crazy Polaires");
    expect(islandais.libelle).toBe("Pulls islandais");
  });

  it("RÉGRESSION — n'affiche jamais la catégorie seule quand un libellé existe", () => {
    const r = cleRegroupement({ ...base, lot: "Polo Ralph Lauren" });
    expect(r.libelle).toBe("Polo Ralph Lauren");
    expect(r.libelle).not.toBe("Polo");
  });

  it("préfère le libellé de l'article au nom du lot rattaché", () => {
    const r = cleRegroupement({
      ...base,
      lotId: "lot_x",
      lot: "Torsadé Ralph Lauren",
      lotRef: { nom: "Half Zip Tommy Hilfinger" },
    });
    expect(r.libelle).toBe("Torsadé Ralph Lauren");
  });

  it("retombe sur le nom du lot rattaché quand l'article n'a pas de libellé", () => {
    // Atteignable depuis le 11/08/2026 : `lot` est éditable via PATCH.
    const r = cleRegroupement({
      ...base,
      lotId: "lot_x",
      lot: null,
      lotRef: { nom: "Pull Lacoste" },
    });
    expect(r.libelle).toBe("Pull Lacoste");
  });

  it("reconstruit depuis marque et catégorie en dernier recours", () => {
    const r = cleRegroupement({ ...base, lot: null, lotRef: null });
    expect(r.libelle).toBe("Polo Ralph Lauren");
  });

  it("regroupe ensemble deux articles du même libellé", () => {
    const a = cleRegroupement({ ...base, lot: "Pull Lacoste" });
    const b = cleRegroupement({ ...base, lot: "Pull Lacoste", marque: "Autre" });
    expect(a.cle).toBe(b.cle);
  });

  it("accepte un lot collectif : « Mix TNF/PAT/COL » est une réponse honnête", () => {
    const r = cleRegroupement({ ...base, lot: "Mix TNF/PAT/COL" });
    expect(r.libelle).toBe("Mix TNF/PAT/COL");
  });

  it("ne rend jamais une chaîne vide", () => {
    const r = cleRegroupement({
      lotId: null,
      lot: null,
      lotRef: null,
      marque: "",
      categorie: "",
    });
    expect(r.cle).toBe(LOT_INDETERMINE);
    expect(r.libelle).toBe(LOT_INDETERMINE);
  });
});

describe("libelleLot — invariants dont dépend cleRegroupement", () => {
  it("compose catégorie + marque", () => {
    expect(libelleLot("Nike", "Sac à dos")).toBe("Sac à dos Nike");
  });

  it("ne double pas quand la marque contient déjà la catégorie", () => {
    expect(libelleLot("Polo Ralph Lauren", "Polo")).toBe("Polo Ralph Lauren");
  });

  it("ne double pas un libellé collectif", () => {
    expect(libelleLot("Mix", "Mix")).toBe("Mix");
  });
});
