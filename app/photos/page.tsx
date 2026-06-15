"use client";

import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import JSZip from "jszip";
import { useUpdateArticle } from "@/lib/hooks";
import type { ArticleDTO } from "@/lib/types";
import StatutBadge from "@/components/StatutBadge";

const MAX_PHOTOS = 20;

type Photo = {
  id: string;
  url: string; // object URL de l'aperçu (image corrigée)
  blob: Blob; // JPEG corrigé prêt à télécharger
};

/**
 * Corrige l'orientation EXIF d'une photo et garantit un rendu portrait.
 * Tout est fait côté client via <canvas> — aucun upload serveur.
 */
async function processImage(file: File): Promise<Blob> {
  // 1) Orientation EXIF (1..8). exifr renvoie undefined si absent.
  const orientation = ((await exifr
    .orientation(file)
    .catch(() => 1)) as number | undefined) || 1;

  // 2) Décodage des pixels BRUTS (sans auto-rotation du navigateur).
  const bitmap = await createImageBitmap(file, { imageOrientation: "none" });
  const w = bitmap.width;
  const h = bitmap.height;

  // 3) Canvas remis à l'endroit selon l'orientation EXIF.
  const swap = orientation >= 5 && orientation <= 8;
  const upright = document.createElement("canvas");
  upright.width = swap ? h : w;
  upright.height = swap ? w : h;
  const uctx = upright.getContext("2d");
  if (!uctx) throw new Error("Canvas indisponible.");
  switch (orientation) {
    case 2:
      uctx.transform(-1, 0, 0, 1, w, 0);
      break;
    case 3:
      uctx.transform(-1, 0, 0, -1, w, h);
      break;
    case 4:
      uctx.transform(1, 0, 0, -1, 0, h);
      break;
    case 5:
      uctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      uctx.transform(0, 1, -1, 0, h, 0);
      break;
    case 7:
      uctx.transform(0, -1, -1, 0, h, w);
      break;
    case 8:
      uctx.transform(0, -1, 1, 0, 0, w);
      break;
    default:
      break;
  }
  uctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // 4) Forcer le portrait : si l'image est paysage, rotation 90° horaire.
  let final = upright;
  if (upright.width > upright.height) {
    const rot = document.createElement("canvas");
    rot.width = upright.height;
    rot.height = upright.width;
    const rctx = rot.getContext("2d");
    if (!rctx) throw new Error("Canvas indisponible.");
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(upright, -upright.width / 2, -upright.height / 2);
    final = rot;
  }

  return new Promise<Blob>((resolve, reject) => {
    final.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion impossible."))),
      "image/jpeg",
      0.92,
    );
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Laisse le temps au navigateur de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function PhotosPage() {
  const [sku, setSku] = useState("");
  const [article, setArticle] = useState<ArticleDTO | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [processing, setProcessing] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Le partage de fichiers (Web Share API niveau 2) n'est dispo que sur
  // certains navigateurs (Safari iOS surtout). Sinon → fallback ZIP.
  const [canShareFiles, setCanShareFiles] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const updateArticle = useUpdateArticle();

  useEffect(() => {
    try {
      const probe = new File(["t"], "probe.jpg", { type: "image/jpeg" });
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [probe] })
      ) {
        setCanShareFiles(true);
      }
    } catch {
      /* API indisponible → on garde le fallback ZIP */
    }
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const q = sku.trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupError(null);
    setArticle(null);
    try {
      const res = await fetch(`/api/articles?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Erreur lors de la recherche.");
      const list = (await res.json()) as ArticleDTO[];
      const match = list.find(
        (a) => a.sku.toLowerCase() === q.toLowerCase(),
      );
      if (!match) {
        setLookupError(`Aucun article trouvé pour le SKU « ${q} ».`);
        return;
      }
      setArticle(match);
    } catch (err) {
      setLookupError((err as Error).message);
    } finally {
      setLookupLoading(false);
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = ""; // reset pour re-sélection
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    const toProcess = files.slice(0, Math.max(0, room));
    setProcessing((n) => n + toProcess.length);

    for (const file of toProcess) {
      try {
        const blob = await processImage(file);
        const photo: Photo = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: URL.createObjectURL(blob),
          blob,
        };
        setPhotos((prev) =>
          prev.length >= MAX_PHOTOS ? prev : [...prev, photo],
        );
      } catch {
        // Fichier illisible (non-JPEG, corrompu…) → on l'ignore.
      } finally {
        setProcessing((n) => Math.max(0, n - 1));
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  const fileName = (index: number) =>
    `${article?.sku ?? "PHOTO"}_${String(index + 1).padStart(2, "0")}.jpg`;

  // Marque l'article « photos prêtes » (invalide le cache → icône 📷 au stock).
  function markPhotosPretes() {
    if (!article) return;
    updateArticle.mutate(
      { id: article.id, patch: { photosPretes: true } },
      {
        onSuccess: () =>
          setArticle((a) => (a ? { ...a, photosPretes: true } : a)),
      },
    );
  }

  async function downloadAll() {
    if (!article || photos.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      photos.forEach((p, i) => zip.file(fileName(i), p.blob));
      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(content, `${article.sku}_photos.zip`);
      markPhotosPretes();
    } finally {
      setZipping(false);
    }
  }

  async function shareAll() {
    if (!article || photos.length === 0) return;
    const files = photos.map(
      (p, i) => new File([p.blob], fileName(i), { type: "image/jpeg" }),
    );
    // Re-vérifie avec les vrais fichiers : certaines plateformes refusent
    // un gros lot d'images même si canShare a dit oui sur un échantillon.
    if (!navigator.canShare || !navigator.canShare({ files })) {
      return downloadAll();
    }
    setSharing(true);
    try {
      await navigator.share({ files, title: article.sku });
      markPhotosPretes();
    } catch (err) {
      // L'utilisateur a annulé la feuille de partage → on ne fait rien.
      if ((err as Error).name !== "AbortError") {
        // Échec réel du partage → on bascule sur le ZIP.
        await downloadAll();
      }
    } finally {
      setSharing(false);
    }
  }

  const atMax = photos.length >= MAX_PHOTOS;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8 pb-24 md:pb-8">
      <header className="mb-6">
        <h1 className="text-display-lg text-ink">Photos</h1>
        <p className="mt-1 text-body-md text-ink-muted">
          Corrige l’orientation des photos et exporte-les renommées par SKU.
          Tout reste sur ton appareil — aucun envoi serveur.
        </p>
      </header>

      {/* 1. Recherche du SKU */}
      <form
        onSubmit={lookup}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-label-sm font-medium uppercase tracking-wide text-ink-faint">
            SKU de l’article
          </label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Ex : LAC50"
            autoCapitalize="characters"
            className="w-full rounded-md border border-line bg-surface px-4 py-2.5 font-mono text-body-md text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={lookupLoading || !sku.trim()}
          className="rounded-full bg-primary px-6 py-2.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {lookupLoading ? "Recherche…" : "Vérifier"}
        </button>
      </form>

      {lookupError && (
        <p className="mt-3 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-body-md text-error">
          {lookupError}
        </p>
      )}

      {article && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
          <span className="font-mono text-headline-md text-ink">
            {article.sku}
          </span>
          <StatutBadge statut={article.statut} />
          <span className="text-body-md text-ink-muted">
            <span className="text-ink-faint">Marque : </span>
            {article.marque}
          </span>
          <span className="text-body-md text-ink-muted">
            <span className="text-ink-faint">Catégorie : </span>
            {article.categorie}
          </span>
        </div>
      )}

      {/* 2-3. Upload + galerie (uniquement après un SKU valide) */}
      {article && (
        <section className="mt-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={atMax}
              className="rounded-full bg-primary px-5 py-2.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              Ajouter des photos
            </button>
            <span className="text-body-md text-ink-muted">
              {photos.length} / {MAX_PHOTOS}
              {processing > 0 && (
                <span className="ml-2 text-ink-faint">
                  · traitement de {processing}…
                </span>
              )}
            </span>
          </div>

          {/* Enregistrement groupé — en haut de la galerie, bien visible. */}
          {photos.length > 0 &&
            (canShareFiles ? (
              <div className="mt-5 flex flex-col items-center gap-1.5">
                <button
                  onClick={shareAll}
                  disabled={sharing}
                  className="w-full max-w-sm rounded-full bg-primary px-6 py-3 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {sharing ? "Ouverture…" : "📷 Enregistrer dans Photos"}
                </button>
                <button
                  onClick={downloadAll}
                  disabled={zipping}
                  className="text-label-sm text-ink-faint underline underline-offset-2 transition-colors hover:text-ink-muted disabled:opacity-50"
                >
                  {zipping ? "Création du ZIP…" : "ou télécharger en ZIP"}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <button
                  onClick={downloadAll}
                  disabled={zipping}
                  className="w-full max-w-sm rounded-full bg-mint px-6 py-3 text-body-md font-semibold text-primary-dark transition-colors hover:bg-mint-soft disabled:opacity-50"
                >
                  {zipping ? "Création du ZIP…" : "Télécharger tout (ZIP)"}
                </button>
              </div>
            ))}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,.jpg,.jpeg"
            multiple
            onChange={onFiles}
            className="hidden"
          />

          {atMax && (
            <p className="mt-2 text-label-sm text-ink-faint">
              Limite de {MAX_PHOTOS} photos atteinte.
            </p>
          )}

          {photos.length === 0 && processing === 0 ? (
            <div className="mt-6 rounded-card border border-dashed border-line bg-surface-soft px-6 py-16 text-center text-ink-faint">
              Aucune photo pour l’instant. Ajoute jusqu’à {MAX_PHOTOS} photos
              JPG.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {photos.map((p, i) => (
                <figure
                  key={p.id}
                  className="group relative overflow-hidden rounded-card border border-line bg-surface shadow-card"
                >
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-ink/80 px-2 py-0.5 text-label-sm font-semibold text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => removePhoto(p.id)}
                    aria-label={`Supprimer la photo ${i + 1}`}
                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-error/90 text-white transition-colors hover:bg-error"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="h-4 w-4"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={fileName(i)}
                    className="aspect-[3/4] w-full bg-surface-soft object-contain"
                  />
                  <figcaption className="border-t border-line p-2">
                    <button
                      onClick={() => triggerDownload(p.blob, fileName(i))}
                      className="w-full rounded-full border border-line bg-surface px-3 py-1.5 text-label-sm font-medium text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
                    >
                      Télécharger
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
