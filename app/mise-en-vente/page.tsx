"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
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
  "w-full rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 text-[14px] text-[#16261D] outline-none transition-colors focus:border-[#1B4332]";

const STEPS = ["Photos", "Détails", "Génération", "Export"] as const;

const GEN_MSGS = [
  "Analyse des photos…",
  "Identification de la marque et du modèle…",
  "Rédaction de l’annonce…",
  "Optimisation des mots-clés…",
  "Finalisation…",
];

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

// ── Stepper (4 cercles + connecteurs) ──
function Stepper({ step }: { step: number }) {
  return (
    <div className="mx-auto mb-7 flex max-w-[700px] items-start">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-grotesk text-[16px] font-bold transition-all ${
                  done
                    ? "bg-[#1B4332] text-white"
                    : active
                      ? "bg-[#1B4332] text-white shadow-[0_0_0_5px_#E1ECE4]"
                      : "border-2 border-[#E4E9E2] bg-white text-[#A6B2A9]"
                }`}
              >
                {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : n}
              </div>
              <span
                className={`text-[13px] ${
                  done || active ? "font-bold text-[#1B4332]" : "font-semibold text-[#A6B2A9]"
                }`}
              >
                {label}
              </span>
            </div>
            {n < STEPS.length && (
              <div
                className={`mx-1.5 mt-[18px] h-[3px] flex-1 rounded-full transition-colors ${
                  n < step ? "bg-[#1B4332]" : "bg-[#E4E9E2]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [genIndex, setGenIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  const { data: prompts = [] } = usePrompts();
  const generate = useGenerateListing();
  const updateArticle = useUpdateArticle();

  const detectedPrompt = useMemo(
    () =>
      article ? pickPrompt(prompts, marqueQcm || null, categorieQcm || null) : null,
    [prompts, article, marqueQcm, categorieQcm],
  );

  useEffect(() => {
    if (article) {
      setMarqueQcm("");
      setCategorieQcm("");
    }
  }, [article]);

  useEffect(() => {
    setSelectedPromptId(detectedPrompt?.id ?? null);
  }, [detectedPrompt]);

  // Checklist animée pendant la génération (étape 3) — placeholder UX :
  // la vraie fin d'appel Gemini déclenche le passage à l'étape 4.
  useEffect(() => {
    if (step !== 3) return;
    setGenIndex(0);
    const t = setInterval(() => {
      setGenIndex((g) => Math.min(g + 1, GEN_MSGS.length - 1));
    }, 1250);
    return () => clearInterval(t);
  }, [step]);

  // Persistance entre refreshs (sessionStorage). Photos + article non restaurables
  // → seules l'étape 1 et l'étape 4 (export, si du texte a été généré) survivent.
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
        if ((s.step === 4 || s.step === 3) && s.titre) {
          setResult({
            titre: s.titre,
            description: s.description ?? "",
            motsCles: s.motsCles ?? "",
            promptNom: "",
          });
          // article non sérialisable → on repart toujours de l'étape 1
          setStep(1);
        }
      }
    } catch {
      /* sessionStorage indisponible ou JSON invalide : on ignore */
    }
    hydrated.current = true;
  }, []);

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
      // étapes intermédiaires (2/3) non restaurables → repli sur 1.
      step: step >= 4 ? 4 : 1,
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

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

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
      if (seq !== lookupSeq.current) return;
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
    setStep(3);
    try {
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
      setSaved(false);
      setStep(4);
    } catch {
      /* erreur affichée via generate.isError sur l'étape 3 */
    }
  }

  function enregistrer() {
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
      { onSuccess: () => setSaved(true) },
    );
  }

  async function downloadZip() {
    if (!article || isZipping) return;
    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      photos.forEach((p, i) => zip.file(fileName(i), p.blob));
      const annonceTxt =
        `SKU: ${article.sku}\n` +
        `COMMANDE: ${article.commandeFournisseur || ""}\n` +
        `MARQUE: ${marqueQcm || article.marque || ""}\n` +
        `CATEGORIE: ${categorieQcm || article.categorie || ""}\n\n` +
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

  function resetAll() {
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
    setSaved(false);
    setGenIndex(0);
    try {
      sessionStorage.removeItem(MEV_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStep(1);
  }

  const canStep2 = !!article && photos.length > 0;
  const canGenerate = selected.size >= MIN_SELECT && !!taille && !!etat;
  const tags = motsCles
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 8);

  const labelCls = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]";
  const btnPrimary =
    "inline-flex items-center gap-2 rounded-[13px] bg-[#1B4332] px-6 py-3 text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528] disabled:opacity-50";
  const btnGhost =
    "inline-flex items-center gap-2 rounded-[13px] border border-[#E4E9E2] bg-white px-5 py-3 text-[14px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]";

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 pb-24 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
            Mise en vente
          </h1>
          <p className="mt-1.5 text-[14.5px] font-medium text-[#71807A]">
            Génère une annonce à partir des photos et des caractéristiques.
          </p>
        </div>
        <button
          onClick={resetAll}
          title="Vider le cache de session"
          className="mt-1 flex items-center gap-1.5 rounded-xl border border-[#E4E9E2] bg-white px-3 py-2 text-[12px] font-semibold text-[#8A998F] transition-colors hover:border-[#CBD8CE] hover:text-[#3C4D44]"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Réinitialiser
        </button>
      </header>

      <Stepper step={step} />

      <div className="mx-auto max-w-[900px]">
        {/* ÉTAPE 1 — Photos */}
        {step === 1 && (
          <div className="space-y-[18px]">
            {/* SKU */}
            <form
              onSubmit={lookup}
              className="rounded-[20px] border border-[#E4E9E2] bg-white p-6"
            >
              <label className={labelCls}>SKU de l’article</label>
              <div className="mt-2.5 flex gap-3">
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ex : LAC50"
                  autoCapitalize="characters"
                  className="flex-1 rounded-[13px] border-2 border-[#1B4332] px-4 py-3 font-grotesk text-[16px] font-bold text-[#16261D] outline-none"
                />
                <button
                  type="submit"
                  disabled={lookupLoading || !sku.trim()}
                  className="rounded-[13px] bg-[#1B4332] px-6 text-[14.5px] font-bold text-white transition-colors hover:bg-[#143528] disabled:opacity-50"
                >
                  {lookupLoading ? "Recherche…" : "Vérifier"}
                </button>
              </div>
              {lookupError && (
                <p className="mt-3 rounded-[10px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-2.5 text-[13.5px] text-[#C2603F]">
                  {lookupError}
                </p>
              )}
              {article && (
                <div className="mt-4 flex flex-wrap items-center gap-3.5 border-t border-[#EEF1EC] pt-4">
                  <span className="font-grotesk text-[17px] font-bold">{article.sku}</span>
                  <StatutBadge statut={article.statut} />
                  <span className="text-[13.5px] font-medium text-[#71807A]">
                    Marque : <b className="text-[#3C4D44]">{article.marque}</b>
                  </span>
                  <span className="text-[13.5px] font-medium text-[#71807A]">
                    Catégorie : <b className="text-[#3C4D44]">{article.categorie}</b>
                  </span>
                </div>
              )}
            </form>

            {article && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,.jpg,.jpeg"
                  multiple
                  onChange={onFiles}
                  className="hidden"
                />

                <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-grotesk text-[17px] font-bold">
                      Photos de l’article
                    </h2>
                    <span className="rounded-full bg-[#F2F5F0] px-2.5 py-1 text-[12.5px] font-semibold text-[#71807A]">
                      {photos.length} / {MAX_PHOTOS}
                      {processing > 0 ? ` · ${processing} en cours…` : ""}
                    </span>
                  </div>

                  {photos.length > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
                      {photos.map((p, i) => (
                        <div
                          key={p.id}
                          className="group relative aspect-square overflow-hidden rounded-[14px] border border-[#E4E9E2] bg-[#F7F9F6]"
                        >
                          <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[12px] font-bold text-white">
                            {i + 1}
                          </span>
                          <button
                            onClick={() => removePhoto(p.id)}
                            aria-label={`Supprimer la photo ${i + 1}`}
                            className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#16261D]/55 text-white transition-colors hover:bg-[#16261D]/80"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                          </button>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt={fileName(i)}
                            className="h-full w-full object-cover"
                          />
                          <button
                            onClick={() => rotatePhoto(p.id, -90)}
                            aria-label="Tourner à gauche"
                            className="absolute bottom-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#3C4D44] shadow-sm transition-colors hover:bg-white hover:text-[#1B4332]"
                          >
                            <RotateCcw className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => rotatePhoto(p.id, 90)}
                            aria-label="Tourner à droite"
                            className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#3C4D44] shadow-sm transition-colors hover:bg-white hover:text-[#1B4332]"
                          >
                            <RotateCw className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dropzone */}
                  <div
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragEnter={onDragOver}
                    onDragLeave={onDragLeave}
                    className={`rounded-[16px] border-2 border-dashed px-5 py-9 text-center transition-colors ${
                      isDragging
                        ? "border-[#1B4332] bg-[#F0F5EE]"
                        : "border-[#C4D2C9] bg-[#F7F9F6]"
                    }`}
                  >
                    <div className="mx-auto mb-3.5 flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-[#EAF3ED] text-[#1B4332]">
                      <Upload className="h-[26px] w-[26px]" strokeWidth={1.8} />
                    </div>
                    <div className="text-[15px] font-bold text-[#16261D]">
                      Glisse tes photos ici
                    </div>
                    <div className="mb-4 mt-1 text-[13px] font-medium text-[#94A29A]">
                      JPG ou PNG · jusqu’à {MAX_PHOTOS} photos
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={photos.length >= MAX_PHOTOS}
                      className="rounded-xl bg-[#1B4332] px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#143528] disabled:opacity-50"
                    >
                      Parcourir les fichiers
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={resetAll} className={btnGhost}>
                    Annuler
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!canStep2}
                    className={btnPrimary}
                  >
                    Continuer
                    <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.3} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ÉTAPE 2 — Détails */}
        {step === 2 && article && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-[300px_1fr]">
              {/* Photos + sélection */}
              <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-5">
                <h2 className="mb-1 font-grotesk text-[16px] font-bold">Photos</h2>
                <p className="mb-3.5 text-[12px] font-medium text-[#94A29A]">
                  Sélectionne {MIN_SELECT} à {MAX_SELECT} photos pour l’IA ({selected.size}/
                  {MAX_SELECT})
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {photos.map((p, i) => {
                    const sel = selected.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        className={`relative aspect-square overflow-hidden rounded-[12px] border-2 transition-colors ${
                          sel ? "border-[#1B4332]" : "border-transparent"
                        }`}
                      >
                        <span className="absolute left-1.5 top-1.5 z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        {sel && (
                          <span className="absolute right-1.5 top-1.5 z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-[#1B4332] text-white">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={fileName(i)}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex aspect-square items-center justify-center rounded-[12px] border-2 border-dashed border-[#CBD8CE] text-[#A6B2A9] transition-colors hover:border-[#1B4332] hover:text-[#1B4332]"
                    aria-label="Ajouter une photo"
                  >
                    <Plus className="h-[22px] w-[22px]" strokeWidth={2} />
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,.jpg,.jpeg"
                  multiple
                  onChange={onFiles}
                  className="hidden"
                />
              </div>

              {/* Caractéristiques */}
              <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-6">
                <h2 className="mb-[18px] font-grotesk text-[16px] font-bold">
                  Caractéristiques
                </h2>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Marque</label>
                    <input
                      value={marqueQcm}
                      onChange={(e) => setMarqueQcm(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      list="marques-list"
                      placeholder="Ex : Lacoste"
                      className={`${inputCls} mt-1.5`}
                    />
                    <datalist id="marques-list">
                      {MARQUES_LIST.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Catégorie</label>
                    <input
                      value={categorieQcm}
                      onChange={(e) => setCategorieQcm(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      list="categories-list"
                      placeholder="Ex : Short"
                      className={`${inputCls} mt-1.5`}
                    />
                    <datalist id="categories-list">
                      {CATEGORIES_LIST.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Taille</label>
                    <select
                      value={taille}
                      onChange={(e) => setTaille(e.target.value)}
                      className={`${inputCls} mt-1.5`}
                    >
                      <option value="">— Choisir —</option>
                      {TAILLES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>État</label>
                    <select
                      value={etat}
                      onChange={(e) => setEtat(e.target.value)}
                      className={`${inputCls} mt-1.5`}
                    >
                      <option value="">— Choisir —</option>
                      {ETATS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Matière</label>
                    <input
                      value={matiere}
                      onChange={(e) => setMatiere(e.target.value)}
                      list="matieres"
                      placeholder="Ex : Coton piqué"
                      className={`${inputCls} mt-1.5`}
                    />
                    <datalist id="matieres">
                      {MATIERES_SUGGESTIONS.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Matière 2 (optionnel)</label>
                    <input
                      value={matiere2}
                      onChange={(e) => setMatiere2(e.target.value)}
                      list="matieres"
                      placeholder="Ex : Élasthanne"
                      className={`${inputCls} mt-1.5`}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Prompt utilisé</label>
                  <select
                    value={selectedPromptId ?? ""}
                    onChange={(e) => setSelectedPromptId(e.target.value || null)}
                    className={`${inputCls} mt-1.5`}
                  >
                    <option value="">— Sélectionner un prompt —</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button onClick={() => setStep(1)} className={btnGhost}>
                <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={2.3} />
                Retour
              </button>
              <button
                onClick={runGenerate}
                disabled={!canGenerate}
                className={btnPrimary}
                title={
                  !canGenerate
                    ? `Sélectionne ${MIN_SELECT}+ photos et renseigne taille & état`
                    : undefined
                }
              >
                Générer l’annonce
                <Sparkles className="h-[17px] w-[17px]" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Génération (chargement) */}
        {step === 3 && (
          <div>
            {generate.isError ? (
              <div className="rounded-[22px] border border-[#E4E9E2] bg-white px-8 py-12 text-center">
                <p className="mx-auto max-w-md rounded-[12px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[14px] text-[#C2603F]">
                  {(generate.error as Error).message}
                </p>
                <button onClick={() => setStep(2)} className={`${btnGhost} mx-auto mt-5`}>
                  <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={2.3} />
                  Retour
                </button>
              </div>
            ) : (
              <div className="rounded-[22px] border border-[#E4E9E2] bg-white px-8 py-14 text-center">
                <div className="relative mx-auto mb-[26px] h-[84px] w-[84px]">
                  <div className="absolute inset-0 rounded-full border-[5px] border-[#EAF0EB]" />
                  <div
                    className="absolute inset-0 rounded-full border-[5px] border-transparent"
                    style={{
                      borderTopColor: "#1B4332",
                      borderRightColor: "#2D6A4F",
                      animation: "spin .9s linear infinite",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-[#1B4332] text-[#9FD4B5]">
                      <Sparkles className="h-[22px] w-[22px]" strokeWidth={2} />
                    </span>
                  </div>
                </div>
                <h2 className="font-grotesk text-[22px] font-bold tracking-[-0.02em]">
                  Génération en cours…
                </h2>
                <p className="mt-2.5 text-[13.5px] font-medium text-[#94A29A]">
                  MyFlip rédige ton annonce avec Gemini Flash
                </p>
                <div className="mx-auto mt-7 flex max-w-[420px] flex-col gap-3">
                  {GEN_MSGS.map((msg, i) => {
                    const done = i < genIndex;
                    const active = i === genIndex;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-[14px] px-4 py-3 transition-colors ${
                          active ? "bg-[#F1F6F2]" : "bg-transparent"
                        }`}
                      >
                        <span
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
                          style={{
                            background: done ? "#1B4332" : active ? "#2D6A4F" : "#EAF0EB",
                          }}
                        >
                          {done ? (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          ) : active ? (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          ) : null}
                        </span>
                        <span
                          className={`text-[14px] ${
                            done
                              ? "font-semibold text-[#3C4D44]"
                              : active
                                ? "font-bold text-[#16261D]"
                                : "font-semibold text-[#A6B2A9]"
                          }`}
                        >
                          {msg}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 4 — Fallback si article perdu après refresh */}
        {step === 4 && !article && (
          <div className="rounded-[22px] border border-[#E4E9E2] bg-white px-8 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF3E2]">
              <RefreshCw className="h-6 w-6 text-[#B5872E]" strokeWidth={2} />
            </div>
            <h2 className="font-grotesk text-[20px] font-bold text-[#16261D]">
              Session expirée
            </h2>
            <p className="mt-2 mx-auto max-w-sm text-[14px] font-medium text-[#71807A]">
              {"Les photos et les données de l'article n'ont pas pu être restaurées."}
              {" Recommence depuis le début pour re-scanner le SKU."}
            </p>
            {result && (titre || description) && (
              <div className="mt-6 space-y-3 text-left">
                {titre && <CopyField label="Titre généré" value={titre} />}
                {description && <CopyField label="Description générée" value={description} multiline />}
              </div>
            )}
            <button onClick={resetAll} className={`${btnPrimary} mx-auto mt-6`}>
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              Recommencer
            </button>
          </div>
        )}

        {/* ÉTAPE 4 — Export */}
        {step === 4 && article && result && (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5 rounded-[14px] border border-[#CDE7D6] bg-[#E4F3EA] px-4 py-3.5">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#1B4332] text-white">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="text-[14px] font-bold text-[#1B4332]">
                Annonce générée avec succès !
              </span>
            </div>

            <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-6">
              <div className="mb-4">
                <label className={labelCls}>Titre</label>
                <input
                  value={titre}
                  onChange={(e) => {
                    setTitre(e.target.value);
                    setSaved(false);
                  }}
                  className={`${inputCls} mt-1.5 font-grotesk text-[16px] font-bold`}
                />
              </div>
              <div className="mb-4">
                <label className={labelCls}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setSaved(false);
                  }}
                  rows={8}
                  className={`${inputCls} mt-1.5 resize-y bg-[#F9FBF8] leading-[1.6]`}
                />
              </div>
              <div>
                <label className={labelCls}>Mots-clés</label>
                <textarea
                  value={motsCles}
                  onChange={(e) => {
                    setMotsCles(e.target.value);
                    setSaved(false);
                  }}
                  rows={2}
                  className={`${inputCls} mt-1.5 resize-y`}
                />
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[#F2F5F0] px-3 py-1.5 text-[12px] font-semibold text-[#71807A]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {updateArticle.isError && (
              <p className="rounded-[10px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-2.5 text-[13.5px] text-[#C2603F]">
                {(updateArticle.error as Error).message}
              </p>
            )}

            {/* Photos + export ZIP */}
            {photos.length > 0 && (
              <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-6">
                <div className="mb-3.5 flex items-center justify-between">
                  <h2 className="font-grotesk text-[16px] font-bold">
                    Photos ({photos.length})
                  </h2>
                  <button
                    onClick={downloadZip}
                    disabled={isZipping}
                    className="rounded-full border border-[#E4E9E2] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE] disabled:opacity-50"
                  >
                    {isZipping ? "Préparation…" : "Tout télécharger (ZIP)"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => triggerDownload(p.blob, fileName(i))}
                      className="aspect-square overflow-hidden rounded-[12px] border border-[#E4E9E2]"
                      title={`Télécharger ${fileName(i)}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={fileName(i)}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Copier */}
            <div className="space-y-3">
              <CopyField label="Titre" value={titre} />
              <CopyField
                label="Annonce complète"
                value={`${description}\n\n${motsCles}\n\n${article.sku}`}
                multiline
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={resetAll} className={btnGhost}>
                <RefreshCw className="h-4 w-4" strokeWidth={2} />
                Nouvelle annonce
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={enregistrer}
                  disabled={updateArticle.isPending || saved}
                  className={btnPrimary}
                >
                  {updateArticle.isPending ? (
                    "Enregistrement…"
                  ) : saved ? (
                    <>
                      <Check className="h-[17px] w-[17px]" strokeWidth={2.4} />
                      Enregistré
                    </>
                  ) : (
                    "Enregistrer l’annonce"
                  )}
                </button>
                <a
                  href="https://www.vinted.fr/items/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[13px] bg-[#0BBBC4] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#089AA2]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/25 text-[11px] font-extrabold">
                    V
                  </span>
                  Vinted
                </a>
                <a
                  href="https://www.vestiairecollective.com/sell/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[13px] bg-[#16261D] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#0E1A13]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 text-[10px] font-extrabold">
                    VC
                  </span>
                  Vestiaire
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
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
    <div className="rounded-[16px] border border-[#E4E9E2] bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
          {label}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-full border border-[#E4E9E2] bg-white px-3 py-1 text-[12px] font-semibold text-[#3C4D44] transition-colors hover:bg-[#F1F4EF]"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p
        className={`text-[14px] text-[#16261D] ${
          multiline ? "whitespace-pre-wrap" : "truncate"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
