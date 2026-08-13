import { describe, expect, it } from "vitest";
import { fichiersImages } from "./_fichiers";

/** Un fichier tel que le navigateur le présente : un nom, un type MIME. */
const f = (name: string, type: string) => ({ name, type });

describe("fichiersImages", () => {
  it("garde les images reconnues par leur type MIME", () => {
    const entree = [f("a.jpg", "image/jpeg"), f("b.png", "image/png")];
    expect(fichiersImages(entree)).toEqual(entree);
  });

  it("écarte ce qui n'est pas une image", () => {
    expect(
      fichiersImages([f("facture.pdf", "application/pdf"), f("notes.txt", "text/plain")]),
    ).toEqual([]);
  });

  it("garde un HEIC dont le navigateur n'a pas su nommer le type", () => {
    // Le cas nominal : une photo d'iPhone glissée depuis le Finder ou Photos
    // arrive régulièrement avec type === "".
    expect(fichiersImages([f("IMG_4821.HEIC", "")])).toEqual([f("IMG_4821.HEIC", "")]);
  });

  it("écarte un fichier sans type ni extension d'image", () => {
    // Un dossier déposé se présente ainsi : ni type, ni extension.
    expect(fichiersImages([f("Photos du lot", ""), f("archive.zip", "")])).toEqual([]);
  });

  it("préserve l'ordre du dépôt, qui fixe l'ordre des vignettes", () => {
    const entree = [f("3.jpg", "image/jpeg"), f("doc.pdf", "application/pdf"), f("1.jpg", "")];
    expect(fichiersImages(entree).map((x) => x.name)).toEqual(["3.jpg", "1.jpg"]);
  });
});
