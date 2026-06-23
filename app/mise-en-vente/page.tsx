"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGenerateListing,
  usePrompts,
  useUpdateArticle,
  type GenerateResult,
} from "@/lib/hooks";
import { pickPrompt } from "@/lib/promptSelect";
import { ETATS, MATIERES_SUGGESTIONS, TAILLES } from "@/lib/listingOptions";
import {
  blobToBase64,
  compressForApi,
  encodeRotated,
  loadImageDirect,
  triggerDownload,
} from "@/lib/imageProcessing";
import type { ArticleDTO } from "@/lib/types";
import StatutBadge from "@/components/StatutBadge";

const MAX_PHOTOS = 20;
const MAX_SELECT = 3;
const MIN_SELECT = 2;

type Photo = {
  id: string;
  base: HTMLCanvasElement;
  rotation: number;
  url: string;
  blob: Blob;
};

const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const STEPS = ["Photos", "Détails", "Génération", "Export"] as const;

const MARQUES_LIST = [
  "Nike",
  "Adidas",
  "Puma",
  "Lacoste",
  "Lacoste Sport",
  "Reebok",
  "Under Armour",
  "Fila",
  "Le Coq Sportif",
  "Champion",
  "Columbia",
  "Hurley",
  "Ralph Lauren",
  "Tommy Hilfiger",
  "Levi's",
];

const CATEGORIES_LIST = [
  "Short",
  "Polo",
  "Pull",
  "Chemise",
  "Veste",
  "Sweat",
  "Jogging",
  "Jean",
  "Bermuda",
];

const MEV_STORAGE_KEY = "mev_state";

type PersistedState = {
  sku: string;
  taille: string;
  etat: string;
  matiere: string;
  matiere2: string;
  marqueQcm: string;
  categorieQcm: string;
  titre: string;
  description: string;
  motsCles: string;
  step: number;
};

export default function MiseEnVentePage() {
  const [step, setStep] = useState(1);

  // --- Article ---
  const [sku, setSku] = useState("");
  const [article, setArticle] = useState<ArticleDTO | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // --- Photos ---
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [processing, setProcessing] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- QCM ---
  const [marqueQcm, setMarqueQcm] = useState("");
  const [categorieQcm, setCategorieQcm] = useState("");
  const [taille, setTaille] = useState("");
  const [etat, setEtat] = useState("");
  const [matiere, setMatiere] = useState("");
  const [matiere2, setMatiere2] = useState("");

  // --- Génération ---
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const { data: prompts = [] } = usePrompts();
  const generate = useGenerateListing();
  const updateArticle = useUpdateArticle();

  const detectedPrompt = useMemo(
    () =>
      article
        ? pickPrompt(prompts, marqueQcm || null, categorieQcm || null)
        : null,
    [prompts, article, marqueQcm, categorieQcm],
  );

  // Vide les champs QCM marque/catégorie à chaque nouvel article chargé
  // (saisie manuelle systématique). Le garde `if (article)` évite d'écraser
  // les valeurs restaurées depuis sessionStorage tant qu'aucun lookup n'a été
  // refait au montage.
  useEffect(() => {
    if (article) {
      setMarqueQcm("");
      setCategorieQcm("");
    }
  }, [article]);

  // Pré-sélectionne le prompt détecté automatiquement.
  useEffect(() => {
    setSelectedPromptId(detectedPrompt?.id ?? null);
  }, [detectedPrompt]);

  // Persistance entre refreshs (sessionStorage). Les photos et l'article ne
  // sont pas restaurables (objets non sérialisables / re-fetch requis), donc
  // l'étape 2 est ramenée à 1, et l'étape 3/4 n'est restaurée que si du texte
  // a déjà été généré.
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MEV_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<PersistedState>;
        if (s.sku) setSku(s.sku);
        if (s.taille) setTaille(s.taille);
        if (s.etat) setEtat(s.etat);
        if (s.matiere) setMatiere(s.matiere);
        if (s.matiere2) setMatiere2(s.matiere2);
        if (s.marqueQcm) setMarqueQcm(s.marqueQcm);
        if (s.categorieQcm) setCategorieQcm(s.categorieQcm);
        if (s.titre) setTitre(s.titre);
        if (s.description) setDescription(s.description);
        if (s.motsCles) setMotsCles(s.motsCles);
        if ((s.step === 3 || s.step === 4) && s.titre) {
          // Reconstitue un résultat minimal pour réafficher l'étape 3.
          setResult({
            titre: s.titre,
            description: s.description ?? "",
            motsCles: s.motsCles ?? "",
            promptNom: "",
          });
          setStep(3);
        } else if (s.step === 1) {
          setStep(1);
        }
      }
    } catch {
      /* sessionStorage indisponible ou JSON invalide : on ignore */
    }
    hydrated.current = true;
  }, []);

  // Sauvegarde à chaque changement (après l'hydratation initiale).
  useEffect(() => {
    if (!hydrated.current) return;
    const payload: PersistedState = {
      sku,
      taille,
      etat,
      matiere,
      matiere2,
      marqueQcm,
      categorieQcm,
      titre,
      description,
      motsCles,
      step: step === 2 ? 1 : step, // photos perdues au refresh
    };
    try {
      sessionStorage.setItem(MEV_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota/securité : on ignore */
    }
  }, [
    sku,
    taille,
    etat,
    matiere,
    matiere2,
    marqueQcm,
    categorieQcm,
    titre,
    description,
    motsCles,
    step,
  ]);

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

  // ---------- Étape 1 : lookup + photos ----------
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
      const match = list.find((a) => a.sku.toLowerCase() === q.toLowerCase());
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

  async function processFiles(files: File[]) {
    if (files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const toProcess = files.slice(0, Math.max(0, room));
    setProcessing((n) => n + toProcess.length);
    for (const file of toProcess) {
      try {
        const base = await loadImageDirect(file);
        const blob = await encodeRotated(base, 0);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const photo: Photo = { id, base, rotation: 0, url: URL.createObjectURL(blob), blob };
        setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, photo]));
      } catch {
        /* fichier illisible ignoré */
      } finally {
        setProcessing((n) => Math.max(0, n - 1));
      }
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    await processFiles(files);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    await processFiles(files);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function rotatePhoto(id: string, delta: number) {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    const rotation = (((photo.rotation + delta) % 360) + 360) % 360;
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECT) next.add(id);
      return next;
    });
  }

  const fileName = (index: number) =>
    `${article?.sku ?? "PHOTO"}_${String(index + 1).padStart(2, "0")}.jpg`;

  // ---------- Étape 3 : génération ----------
  async function runGenerate() {
    if (!article) return;
    const chosen = photos.filter((p) => selected.has(p.id));
    const images = await Promise.all(
      chosen.map(async (p) => {
        const compressed = await compressForApi(p.blob);
        return `data:image/jpeg;base64,${await blobToBase64(compressed)}`;
      }),
    );
    const res = await generate.mutateAsync({
      sku: article.sku,
      marque: marqueQcm || null,
      categorie: categorieQcm || null,
      taille: taille || null,
      etat: etat || null,
      matiere: [matiere, matiere2].filter(Boolean).join(" / ") || null,
      images,
      promptId: selectedPromptId ?? undefined,
    });
    setResult(res);
    setTitre(res.titre);
    setDescription(res.description);
    setMotsCles(res.motsCles);
    setStep(3);
  }

  function valider() {
    if (!article) return;
    updateArticle.mutate(
      {
        id: article.id,
        patch: {
          titreAnnonce: titre,
          descriptionAnnonce: description,
          motsClesAnnonce: motsCles,
        },
      },
      { onSuccess: () => setStep(4) },
    );
  }

  async function downloadZip() {
    if (!article || isZipping) return;
    setIsZipping(true);
    try {
      // Import dynamique : jszip n'est chargé qu'au premier export ZIP.
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      photos.forEach((p, i) => zip.file(fileName(i), p.blob));
      const annonceTxt =
        `SKU: ${article.sku}\n` +
        `COMMANDE: ${article.commandeFournisseur || ''}\n` +
        `MARQUE: ${marqueQcm || article.marque || ''}\n` +
        `CATEGORIE: ${categorieQcm || article.categorie || ''}\n\n` +
        `TITRE:\n${titre}\n\n` +
        `DESCRIPTION:\n${description}\n\n` +
        `MOTS-CLÉS:\n${motsCles}\n`;
      zip.file(`${article.sku}_annonce.txt`, annonceTxt);
      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(content, `${article.sku}_annonce.zip`);
    } finally {
      setIsZipping(false);
    }
  }

  const canStep2 = !!article && photos.length > 0;
  const canGenerate = selected.size >= MIN_SELECT && !!taille && !!etat;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8 pb-24 md:pb-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink md:text-4xl">Mise en vente</h1>
        <p className="mt-1 text-sm text-ink-muted md:text-base">
          Génère une annonce à partir des photos et des caractéristiques.
        </p>
      </header>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm font-semibold ${
                  active
                    ? "bg-primary text-on-primary"
                    : done
                      ? "bg-mint/30 text-primary"
                      : "bg-surface-container text-ink-faint"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span
                className={`hidden text-label-sm sm:inline ${active ? "font-medium text-ink" : "text-ink-faint"}`}
              >
                {label}
              </span>
              {n < STEPS.length && <div className="h-px flex-1 bg-line" />}
            </div>
          );
        })}
      </div>

      {/* ÉTAPE 1 — Photos */}
      {step === 1 && (
        <section className="space-y-5">
          <form
            onSubmit={lookup}
            className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-1 block text-label-sm font-medium uppercase tracking-wide text-ink-faint">
                SKU de l&apos;article
              </label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex : LAC50"
                autoCapitalize="characters"
                className={`${inputCls} font-mono`}
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
            <p className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-body-md text-error">
              {lookupError}
            </p>
          )}

          {article && (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
                <span className="font-mono text-headline-md text-ink">{article.sku}</span>
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

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,.jpg,.jpeg"
                multiple
                onChange={onFiles}
                className="hidden"
              />

              {/* Zone drag-and-drop */}
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragEnter={onDragOver}
                onDragLeave={onDragLeave}
                className={`relative rounded-card border-2 border-dashed transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : photos.length === 0
                      ? "border-line"
                      : "border-transparent"
                }`}
              >
                {isDragging && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-card bg-primary/10">
                    <p className="text-headline-md font-semibold text-primary">Déposer ici ↓</p>
                  </div>
                )}

                {photos.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <span className="text-5xl">🖼️</span>
                    <div>
                      <p className="text-body-md font-medium text-ink-muted">
                        Glissez vos photos ici
                      </p>
                      <p className="mt-1 text-label-sm text-ink-faint">ou</p>
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={photos.length >= MAX_PHOTOS}
                      className="rounded-full bg-primary px-5 py-2.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
                    >
                      Parcourir les fichiers
                    </button>
                    {processing > 0 && (
                      <span className="text-label-sm text-ink-faint">
                        Traitement de {processing} photo(s)…
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="p-1">
                    <div className="mb-3 flex items-center gap-3">
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={photos.length >= MAX_PHOTOS}
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
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                              ✕
                            </button>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={fileName(i)}
                              className="aspect-[3/4] w-full bg-surface-soft object-contain"
                            />
                            <button
                              onClick={() => rotatePhoto(p.id, -90)}
                              aria-label="Tourner à gauche"
                              className="absolute bottom-2 left-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-sm transition-colors hover:bg-white hover:text-[#1A5336]"
                            >
                              ↺
                            </button>
                            <button
                              onClick={() => rotatePhoto(p.id, 90)}
                              aria-label="Tourner à droite"
                              className="absolute bottom-2 right-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-sm transition-colors hover:bg-white hover:text-[#1A5336]"
                            >
                              ↻
                            </button>
                          </div>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canStep2}
                  className="rounded-full bg-primary px-6 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  Continuer →
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ÉTAPE 2 — Sélection + QCM */}
      {step === 2 && article && (
        <section className="space-y-5">
          <div>
            <h2 className="text-headline-md text-ink">
              Sélectionne {MIN_SELECT} à {MAX_SELECT} photos
            </h2>
            <p className="text-label-sm text-ink-faint">
              Ces photos seront envoyées à l&apos;IA pour rédiger l&apos;annonce. (
              {selected.size}/{MAX_SELECT})
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
            {photos.map((p, i) => {
              const sel = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`relative overflow-hidden rounded-card border-2 transition-colors ${
                    sel ? "border-primary" : "border-transparent"
                  }`}
                >
                  {sel && (
                    <span className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
                      ✓
                    </span>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={fileName(i)}
                    className="aspect-[3/4] w-full bg-surface-soft object-cover"
                  />
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-5 shadow-card md:grid-cols-2">
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">Marque</label>
              <input
                value={marqueQcm}
                onChange={(e) => setMarqueQcm(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                list="marques-list"
                placeholder="Ex : Lacoste"
                className={inputCls}
              />
              <datalist id="marques-list">
                {MARQUES_LIST.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">Catégorie</label>
              <input
                value={categorieQcm}
                onChange={(e) => setCategorieQcm(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                list="categories-list"
                placeholder="Ex : Short"
                className={inputCls}
              />
              <datalist id="categories-list">
                {CATEGORIES_LIST.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">Taille</label>
              <select value={taille} onChange={(e) => setTaille(e.target.value)} className={inputCls}>
                <option value="">— Choisir —</option>
                {TAILLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">État</label>
              <select value={etat} onChange={(e) => setEtat(e.target.value)} className={inputCls}>
                <option value="">— Choisir —</option>
                {ETATS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">Matière</label>
              <input
                value={matiere}
                onChange={(e) => setMatiere(e.target.value)}
                list="matieres"
                placeholder="Ex : Coton piqué"
                className={inputCls}
              />
              <datalist id="matieres">
                {MATIERES_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">
                Matière 2 (optionnel)
              </label>
              <input
                value={matiere2}
                onChange={(e) => setMatiere2(e.target.value)}
                list="matieres"
                placeholder="Ex : Élasthanne"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-label-sm font-medium text-ink-muted">
              Prompt utilisé
            </label>
            <select
              value={selectedPromptId ?? ""}
              onChange={(e) => setSelectedPromptId(e.target.value || null)}
              className={inputCls}
            >
              <option value="">— Sélectionner un prompt —</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>

          {generate.isError && (
            <p className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-body-md text-error">
              {(generate.error as Error).message}
            </p>
          )}

          {generate.isPending && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-line bg-surface px-4 py-8 shadow-card">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-primary" />
              <p className="text-body-md font-medium text-ink-muted">
                Génération de l&apos;annonce en cours…
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container"
            >
              ← Retour
            </button>
            <button
              onClick={runGenerate}
              disabled={!canGenerate || generate.isPending}
              className="rounded-full bg-primary px-6 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {generate.isPending ? "Génération…" : "Générer l'annonce"}
            </button>
          </div>
        </section>
      )}

      {/* ÉTAPE 3 — Génération + validation */}
      {step === 3 && result && (
        <section className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-label-sm font-medium text-ink-muted">Titre</label>
                <input value={titre} onChange={(e) => setTitre(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-label-sm font-medium text-ink-muted">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={8}
                  className={`${inputCls} resize-y`}
                />
              </div>
              <div>
                <label className="mb-1 block text-label-sm font-medium text-ink-muted">Mots-clés</label>
                <textarea
                  value={motsCles}
                  onChange={(e) => setMotsCles(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-y`}
                />
              </div>
            </div>
          </div>

          {updateArticle.isError && (
            <p className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-body-md text-error">
              {(updateArticle.error as Error).message}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container"
            >
              ← Retour
            </button>
            <div className="flex gap-3">
              <button
                onClick={runGenerate}
                disabled={generate.isPending}
                className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                {generate.isPending ? "…" : "↻ Régénérer"}
              </button>
              <button
                onClick={valider}
                disabled={updateArticle.isPending}
                className="rounded-full bg-primary px-6 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
              >
                {updateArticle.isPending ? "Validation…" : "Valider"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ÉTAPE 4 — Export */}
      {step === 4 && article && (
        <section className="space-y-5">
          <div className="rounded-card border border-mint/40 bg-mint/10 px-4 py-3 text-body-md text-primary">
            ✅ Annonce enregistrée pour {article.sku}.
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-headline-md text-ink">Photos ({photos.length})</h2>
            <button
              onClick={downloadZip}
              disabled={isZipping}
              className="rounded-full bg-primary px-5 py-2.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {isZipping ? "Préparation…" : "Tout télécharger"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => triggerDownload(p.blob, fileName(i))}
                className="overflow-hidden rounded-card border border-line shadow-card"
                title={`Télécharger ${fileName(i)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={fileName(i)}
                  className="aspect-[3/4] w-full bg-surface-soft object-cover"
                />
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <CopyField label="Titre" value={titre} />
            <CopyField
              label="Annonce complète"
              value={`${description}\n\n${motsCles}\n\n${article.sku}`}
              multiline
            />
          </div>

          <button
            onClick={() => {
              // Reset complet pour un nouvel article.
              photos.forEach((p) => URL.revokeObjectURL(p.url));
              setPhotos([]);
              setSelected(new Set());
              setArticle(null);
              setSku("");
              setResult(null);
              setTitre("");
              setDescription("");
              setMotsCles("");
              setMarqueQcm("");
              setCategorieQcm("");
              setTaille("");
              setEtat("");
              setMatiere("");
              setMatiere2("");
              setSelectedPromptId(null);
              try {
                sessionStorage.removeItem(MEV_STORAGE_KEY);
              } catch {
                /* ignore */
              }
              setStep(1);
            }}
            className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container"
          >
            Nouvel article
          </button>
        </section>
      )}
    </main>
  );
}

function CopyField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-label-sm font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-full border border-line px-3 py-1 text-label-sm font-medium text-ink transition-colors hover:bg-surface-container"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p className={`text-body-md text-ink ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
        {value || "—"}
      </p>
    </div>
  );
}
