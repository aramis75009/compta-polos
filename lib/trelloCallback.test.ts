import { describe, expect, it } from "vitest";
import { origineAutorisee, retourAvecCode, urlCallback } from "@/lib/trelloCallback";

describe("urlCallback", () => {
  it("construit l'URL de retour depuis l'origine servie", () => {
    expect(urlCallback("https://myflip-app.vercel.app")).toBe(
      "https://myflip-app.vercel.app/api/trello/callback",
    );
  });

  it("supprime la barre oblique finale", () => {
    expect(urlCallback("https://x.test/")).toBe("https://x.test/api/trello/callback");
  });
});

describe("origineAutorisee", () => {
  it("accepte tout quand aucun hôte d'application n'est configuré", () => {
    expect(origineAutorisee("https://n-importe-quoi.test", null)).toBe(true);
  });

  it("accepte l'origine qui correspond à l'hôte configuré", () => {
    expect(origineAutorisee("https://app.myflip.fr", "app.myflip.fr")).toBe(true);
  });

  it("refuse une origine qui ne correspond pas", () => {
    expect(origineAutorisee("https://attaquant.test", "app.myflip.fr")).toBe(false);
  });

  it("ignore la casse", () => {
    expect(origineAutorisee("https://APP.MyFlip.fr", "app.myflip.fr")).toBe(true);
  });

  it("accepte localhost en développement même avec un hôte configuré", () => {
    expect(origineAutorisee("http://localhost:3000", "app.myflip.fr")).toBe(true);
  });

  it("refuse une origine illisible", () => {
    expect(origineAutorisee("pas-une-url", "app.myflip.fr")).toBe(false);
  });
});

describe("retourAvecCode", () => {
  it("marque le succès", () => {
    expect(retourAvecCode("https://x.test", "/compte", "ok")).toBe(
      "https://x.test/compte?trello=ok",
    );
  });

  it("transporte le code d'erreur", () => {
    expect(retourAvecCode("https://x.test", "/demarrage", "refus")).toBe(
      "https://x.test/demarrage?trello=refus",
    );
  });
});
