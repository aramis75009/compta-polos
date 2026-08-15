import { describe, expect, it } from "vitest";
import { contexteDepuisReglages, type ReglagesTrelloBruts } from "@/lib/settings";

const APP = { key: "cle-app", secret: "secret-app" };

// `contexteDepuisReglages` reçoit les secrets DÉJÀ DÉCHIFFRÉS : le
// déchiffrement dépend de process.env, qu'on ne veut pas dans un test pur.
const reglages = (over: Partial<ReglagesTrelloBruts> = {}): ReglagesTrelloBruts => ({
  oauthToken: null,
  heriteeKey: null,
  heriteeToken: null,
  heriteeSecret: null,
  boardId: null,
  labelId: null,
  comptabiliseLabelId: null,
  ...over,
});

describe("contexteDepuisReglages", () => {
  it("préfère le jeton OAuth et l'associe à la clé de l'application", () => {
    const ctx = contexteDepuisReglages(
      reglages({ oauthToken: "jeton-oauth", boardId: "b1", labelId: "l1" }),
      APP,
    );
    expect(ctx).toMatchObject({
      key: "cle-app",
      token: "jeton-oauth",
      secret: "secret-app",
      boardId: "b1",
      labelId: "l1",
      source: "oauth",
    });
  });

  it("retombe sur les clés héritées du compte quand il n'y a pas d'OAuth", () => {
    const ctx = contexteDepuisReglages(
      reglages({
        heriteeKey: "cle-perso",
        heriteeToken: "jeton-perso",
        heriteeSecret: "secret-perso",
        boardId: "b2",
      }),
      APP,
    );
    expect(ctx).toMatchObject({
      key: "cle-perso",
      token: "jeton-perso",
      secret: "secret-perso",
      source: "heritee",
    });
  });

  it("ignore une clé héritée sans son jeton : les deux vont ensemble", () => {
    expect(contexteDepuisReglages(reglages({ heriteeKey: "cle-perso" }), APP)).toBeNull();
    expect(contexteDepuisReglages(reglages({ heriteeToken: "jeton" }), APP)).toBeNull();
  });

  it("ne retombe JAMAIS sur les identifiants du déploiement", () => {
    // Le trou d'isolation d'avant le 15/08/2026 : un compte sans réglages
    // héritait de la clé, du jeton ET du board du propriétaire.
    expect(contexteDepuisReglages(reglages(), APP)).toBeNull();
    expect(contexteDepuisReglages(null, APP)).toBeNull();
  });

  it("rend null quand l'application n'est pas configurée mais que le compte a un OAuth", () => {
    // Un jeton OAuth sans la clé de l'app qui l'a émis est inutilisable.
    expect(contexteDepuisReglages(reglages({ oauthToken: "jeton" }), null)).toBeNull();
  });

  it("laisse passer une connexion héritée même sans configuration d'application", () => {
    const ctx = contexteDepuisReglages(
      reglages({ heriteeKey: "k", heriteeToken: "t" }),
      null,
    );
    expect(ctx?.source).toBe("heritee");
  });

  it("n'invente pas de board : sans board choisi, boardId reste null", () => {
    const ctx = contexteDepuisReglages(reglages({ oauthToken: "jeton" }), APP);
    expect(ctx?.boardId).toBeNull();
    expect(ctx?.labelId).toBeNull();
    expect(ctx?.comptabiliseLabelId).toBeNull();
  });
});
