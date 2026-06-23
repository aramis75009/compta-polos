"use client";

import { useEffect, useRef, useState } from "react";
import { useUpdateArticle } from "@/lib/hooks";
import type { ArticleDTO } from "@/lib/types";
import {
  correctImage,
  encodeRotated,
  triggerDownload,
} from "@/lib/imageProcessing";
import StatutBadge from "@/components/StatutBadge";

const MAX_PHOTOS = 20;

type Photo = {
  id: string;
  base: HTMLCanvasElement; // source corrigée EXIF (rotation 0), lossless en mémoire
  rotation: number; // rotation manuelle cumulée : 0 | 90 | 180 | 270 (horaire)
  url: string; // object URL de l'aperçu (image corrigée + rotation)
  blob: Blob; // JPEG final prêt à télécharger (base + rotation, encodé une seule fois)
};

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
  // Rotation manuelle courante par photo (mise à jour synchrone pour éviter
  // les états périmés lors de clics rapides sur les boutons de rotation).
  const rotationsRef = useRef<Record<string, number>>({});
  const updateArticle = useUpdateArticle();

  // Révoque les object URLs des photos au démontage (navigation SPA) : sans ça,
  // les blob: URLs survivent au document et s'accumulent à chaque visite.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  // Jeton de requête : ignore les réponses de lookups périmés si l'utilisateur
  // enchaîne deux recherches rapprochées (réponses hors ordre).
  const lookupSeq = useRef(0);

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
    const seq = ++lookupSeq.current;
    setLookupLoading(true);
    setLookupError(null);
    setArticle(null);
    try {
      const res = await fetch(`/api/articles?q=${encodeURIComponent(q)}`);
      if (seq !== lookupSeq.current) return; // réponse périmée
      if (!res.ok) throw new Error("Erreur lors de la recherche.");
      const list = (await res.json()) as ArticleDTO[];
      if (seq !== lookupSeq.current) return;
      const match = list.find(
        (a) => a.sku.toLowerCase() === q.toLowerCase(),
      );
      if (!match) {
        setLookupError(`Aucun article trouvé pour le SKU « ${q} ».`);
        return;
      }
      setArticle(match);
    } catch (err) {
      if (seq !== lookupSeq.current) return;
      setLookupError((err as Error).message);
    } finally {
      if (seq === lookupSeq.current) setLookupLoading(false);
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
        const base = await correctImage(file);
        const blob = await encodeRotated(base, 0);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        rotationsRef.current[id] = 0;
        const photo: Photo = {
          id,
          base,
          rotation: 0,
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
    delete rotationsRef.current[id];
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  // Rotation manuelle cumulative de 90° (delta = +90 horaire, -90 anti-horaire).
  // On repart toujours du canvas source → une seule génération de compression.
  async function rotatePhoto(id: string, delta: number) {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    const current = rotationsRef.current[id] ?? photo.rotation;
    const rotation = (((current + delta) % 360) + 360) % 360;
    rotationsRef.current[id] = rotation; // réserve le nouvel état tout de suite
    const blob = await encodeRotated(photo.base, rotation);
    const url = URL.createObjectURL(blob);
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        URL.revokeObjectURL(p.url);
        return { ...p, rotation, blob, url };
      }),
    );
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
      // Import dynamique : jszip n'est chargé qu'au premier export ZIP.
      const JSZip = (await import("jszip")).default;
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
        <h1 className="text-2xl font-bold text-ink md:text-4xl">Photos</h1>
        <p className="mt-1 text-sm text-ink-muted md:text-base">
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
                  className="group overflow-hidden rounded-card border border-line bg-surface shadow-card"
                >
                  <div className="relative">
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
                    {/* Rotation manuelle anti-horaire (↺) — bas gauche. */}
                    <button
                      onClick={() => rotatePhoto(p.id, -90)}
                      aria-label={`Tourner la photo ${i + 1} de 90° vers la gauche`}
                      className="absolute bottom-2 left-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-sm transition-colors hover:bg-white hover:text-[#1A5336]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-4 w-4"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </button>
                    {/* Rotation manuelle horaire (↻) — bas droite. */}
                    <button
                      onClick={() => rotatePhoto(p.id, 90)}
                      aria-label={`Tourner la photo ${i + 1} de 90° vers la droite`}
                      className="absolute bottom-2 right-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-sm transition-colors hover:bg-white hover:text-[#1A5336]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-4 w-4"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                    </button>
                  </div>
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
