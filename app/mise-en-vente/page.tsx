"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Upload,
  X,
  ZoomIn,
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

const AUTRE = "Autre…";

// Marques proposées en chips : celles qui sortent réellement des lots (cf.
// MARQUE_LISTING_MAP). Les autres restent accessibles via « Autre… » + datalist.
const MARQUES_CHIPS = [
  "Ralph Lauren",
  "Tommy Hilfiger",
  "Lacoste",
  "Adidas",
  "Dickies",
  "Helly Hansen",
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
  "Polo",
  "Pull",
  "Chemise",
  "Sweat",
  "Veste",
  "Short",
  "Jogging",
  "Jean",
  "Bermuda",
];

// En base, `marque` et `categorie` portent le même libellé de lot ("Polo Ralph
// Lauren"), qui mélange la marque et le type d'article. Pour l'annonce, on le
// redécoupe. Clés = les 17 libellés réellement présents en base.
// Marque vide = lot multimarque : on laisse l'utilisateur (ou l'IA) trancher.
const MARQUE_LISTING_MAP: Record<string, { marque: string; categorie: string }> = {
  "Polo Ralph Lauren": { marque: "Ralph Lauren", categorie: "Polo" },
  "Polo Tommy Hilfiger": { marque: "Tommy Hilfiger", categorie: "Polo" },
  "Pull Lacoste": { marque: "Lacoste", categorie: "Pull" },
  "Half Zip Ralph Lauren": { marque: "Ralph Lauren", categorie: "Pull" },
  "Half Zip Tommy Hilfinger": { marque: "Tommy Hilfiger", categorie: "Pull" }, // typo en base
  "Torsadé Ralph Lauren": { marque: "Ralph Lauren", categorie: "Pull" },
  "Short de bain Ralph Lauren": { marque: "Ralph Lauren", categorie: "Short de bain" },
  "Short Adidas": { marque: "Adidas", categorie: "Short" },
  "Chemise Dickies": { marque: "Dickies", categorie: "Chemise" },
  "Mix Helly Hansen": { marque: "Helly Hansen", categorie: "" },
  "Mix TNF/PAT/COL": { marque: "", categorie: "" },
  "Mix short de sport de marque": { marque: "", categorie: "Short" },
  "Crazy Coupe-vent": { marque: "", categorie: "Coupe-vent" },
  "Crazy Polaires": { marque: "", categorie: "Polaire" },
  "Pull COOGI style": { marque: "", categorie: "Pull" },
  "Pull Ethnic": { marque: "", categorie: "Pull" },
  "Pulls islandais": { marque: "", categorie: "Pull" },
};

/**
 * Valeurs « annonce » d'un article, dérivées du libellé de lot.
 * Purement dérivé pour l'affichage et le pré-remplissage : la base, le DTO et
 * les filtres du Stock continuent d'utiliser le libellé de lot d'origine.
 */
function listingLabels(a: ArticleDTO): { marque: string; categorie: string } {
  const mapped = MARQUE_LISTING_MAP[a.marque];
  return {
    marque: mapped?.marque ?? a.marque,
    categorie: mapped?.categorie ?? a.categorie,
  };
}

const MEV_STORAGE_KEY = "mev_state";

type PersistedState = {
  sku: string;
  taille: string;
  etat: string;
  matiere: string;
  matiere2: string;
  details: string;
  marqueQcm: string;
  categorieQcm: string;
  titre: string;
  description: string;
  motsCles: string;
  step: number;
};

const labelCls = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]";
const cardCls =
  "rounded-[20px] border border-[#E4E9E2] bg-white shadow-[0_18px_40px_-30px_rgba(20,53,40,.28)]";

/** Chip de sélection (marque, catégorie, taille, état, matière). 44px = touch target. */
function Chip({
  value,
  active,
  onClick,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border-[1.5px] px-4 text-[13.5px] font-semibold transition-all ${
        active
          ? "border-[#1B4332] bg-[#1B4332] text-white shadow-[0_8px_18px_-11px_rgba(20,53,40,.85)]"
          : "border-[#E4E9E2] bg-white text-[#3C4D44] hover:border-[#CBD8CE]"
      }`}
    >
      {value}
    </button>
  );
}

// ── Stepper (4 cercles + connecteurs) — cliquable pour revenir en arrière ──
function Stepper({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <div className="mx-auto mb-6 flex max-w-[700px] items-start">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <button
              type="button"
              onClick={() => done && onGo(n)}
              disabled={!done}
              className="flex flex-col items-center gap-2 disabled:cursor-default"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full font-grotesk text-[16px] font-bold transition-all ${
                  done
                    ? "bg-[#1B4332] text-white"
                    : active
                      ? "bg-[#1B4332] text-white shadow-[0_0_0_5px_#E1ECE4]"
                      : "border-2 border-[#E4E9E2] bg-white text-[#A6B2A9]"
                }`}
              >
                {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : n}
              </span>
              <span
                className={`text-[12px] md:text-[13px] ${
                  done || active
                    ? "font-bold text-[#1B4332]"
                    : "font-semibold text-[#A6B2A9]"
                }`}
              >
                {label}
              </span>
            </button>
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
  // Tableau (et non Set) : l'ordre de sélection = ordre envoyé à l'IA.
  const [selected, setSelected] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- QCM ---
  const [marqueQcm, setMarqueQcm] = useState("");
  const [categorieQcm, setCategorieQcm] = useState("");
  const [marqueCustom, setMarqueCustom] = useState(false);
  const [categorieCustom, setCategorieCustom] = useState(false);
  const [taille, setTaille] = useState("");
  const [etat, setEtat] = useState("");
  const [matiere, setMatiere] = useState("");
  const [matiere2, setMatiere2] = useState("");
  const [details, setDetails] = useState("");
  const [showPromptPicker, setShowPromptPicker] = useState(false);

  // --- Génération ---
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [genIndex, setGenIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<"titre" | "annonce" | null>(null);

  const { data: prompts = [] } = usePrompts();
  const generate = useGenerateListing();
  const updateArticle = useUpdateArticle();

  const detectedPrompt = useMemo(
    () =>
      article ? pickPrompt(prompts, marqueQcm || null, categorieQcm || null) : null,
    [prompts, article, marqueQcm, categorieQcm],
  );

  // Pré-remplissage depuis la fiche article ; l'utilisateur reste libre de corriger.
  useEffect(() => {
    if (article) {
      const { marque, categorie } = listingLabels(article);
      setMarqueQcm(marque);
      setCategorieQcm(categorie);
      setMarqueCustom(false);
      setCategorieCustom(false);
    }
  }, [article]);

  // Zoom photo : fermeture au clavier.
  useEffect(() => {
    if (!zoomedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedId]);

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
        if (s.details) setDetails(s.details);
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
      details,
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
    details,
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
    setSelected((prev) => prev.filter((x) => x !== id));
    setZoomedId((z) => (z === id ? null : z));
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
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, id];
    });
  }

  function toggleMatiere(m: string) {
    const list = [matiere, matiere2].filter(Boolean);
    const next = list.includes(m)
      ? list.filter((x) => x !== m)
      : list.length >= 2
        ? list
        : [...list, m];
    setMatiere(next[0] ?? "");
    setMatiere2(next[1] ?? "");
  }

  const fileName = (index: number) =>
    `${article?.sku ?? "PHOTO"}_${String(index + 1).padStart(2, "0")}.jpg`;

  // ---------- Étape 3 : génération ----------
  async function runGenerate() {
    if (!article) return;
    // Ordre de sélection conservé : la 1re photo choisie est la plus importante.
    const chosen = selected
      .map((id) => photos.find((p) => p.id === id))
      .filter((p): p is Photo => !!p);
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
        details: details.trim() || null,
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

  async function copier(kind: "titre" | "annonce") {
    const value =
      kind === "titre"
        ? titre
        : `${description}\n\n${motsCles}\n\n${article?.sku ?? ""}`;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
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
    setSelected([]);
    setArticle(null);
    setSku("");
    setResult(null);
    setTitre("");
    setDescription("");
    setMotsCles("");
    setMarqueQcm("");
    setCategorieQcm("");
    setMarqueCustom(false);
    setCategorieCustom(false);
    setTaille("");
    setEtat("");
    setMatiere("");
    setMatiere2("");
    setDetails("");
    setSelectedPromptId(null);
    setShowPromptPicker(false);
    setSaved(false);
    setGenIndex(0);
    setZoomedId(null);
    try {
      sessionStorage.removeItem(MEV_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStep(1);
  }

  const zoomedIdx = zoomedId ? photos.findIndex((p) => p.id === zoomedId) : -1;
  const zoomedPhoto = zoomedIdx >= 0 ? photos[zoomedIdx] : null;

  const canStep2 = !!article && photos.length > 0;
  const canGenerate = selected.length >= MIN_SELECT && !!taille && !!etat;

  const tags = motsCles
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 8);

  // Chips : la valeur pré-remplie doit toujours être proposée, même hors liste.
  const marqueChips = useMemo(() => {
    const base = [...MARQUES_CHIPS];
    if (marqueQcm && !marqueCustom && !base.includes(marqueQcm)) base.unshift(marqueQcm);
    return base;
  }, [marqueQcm, marqueCustom]);

  const categorieChips = useMemo(() => {
    const base = [...CATEGORIES_LIST];
    if (categorieQcm && !categorieCustom && !base.includes(categorieQcm))
      base.unshift(categorieQcm);
    return base;
  }, [categorieQcm, categorieCustom]);

  const matieres = [matiere, matiere2].filter(Boolean);

  // ---------- Barre d'action collante ----------
  const missing: string[] = [];
  if (selected.length < MIN_SELECT) missing.push(`${MIN_SELECT} photos`);
  if (!taille) missing.push("taille");
  if (!etat) missing.push("état");

  let primaryLabel = "Continuer";
  let primaryIcon = <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.3} />;
  let primaryEnabled = canStep2;
  let primaryAction: () => void = () => setStep(2);
  let hint = "Saisis un SKU puis vérifie l’article";
  let hintOk = false;

  if (step === 1) {
    if (article && photos.length > 0) {
      hint = `${photos.length} photo${photos.length > 1 ? "s" : ""} prête${photos.length > 1 ? "s" : ""}`;
      hintOk = true;
    } else if (article) {
      hint = "Ajoute au moins une photo";
    }
  } else if (step === 2) {
    primaryLabel = "Générer l’annonce";
    primaryIcon = <Sparkles className="h-[17px] w-[17px]" strokeWidth={2.2} />;
    primaryEnabled = canGenerate;
    primaryAction = runGenerate;
    hintOk = canGenerate;
    hint = canGenerate
      ? "Prêt · appuie sur Entrée pour générer"
      : `Il manque : ${missing.join(" · ")}`;
  } else if (step === 3) {
    primaryLabel = "Génération…";
    primaryIcon = <Sparkles className="h-[17px] w-[17px]" strokeWidth={2.2} />;
    primaryEnabled = false;
    primaryAction = () => {};
    hint = "Rédaction en cours";
    hintOk = true;
  } else {
    primaryLabel = saved ? "Enregistré" : "Enregistrer l’annonce";
    primaryIcon = saved ? (
      <Check className="h-[17px] w-[17px]" strokeWidth={2.6} />
    ) : (
      <Check className="h-[17px] w-[17px]" strokeWidth={2.3} />
    );
    primaryEnabled = !!article && !saved && !updateArticle.isPending;
    primaryAction = enregistrer;
    hint = saved ? "Annonce enregistrée" : "Relis, ajuste, puis enregistre";
    hintOk = true;
  }

  // Entrée = générer (étape 2), hors saisie de texte.
  useEffect(() => {
    if (step !== 2 || !canGenerate) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toUpperCase();
      if (e.key !== "Enter" || tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      runGenerate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canGenerate, selected, taille, etat, matiere, matiere2, details, article]);

  const btnGhost =
    "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E4E9E2] bg-white px-4 text-[13.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]";

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-4 py-6 pb-40 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-32">
      {/* ── Barre de contexte : l'article reste visible à toutes les étapes ── */}
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
            Mise en vente
          </h1>
          <p className="mt-1.5 text-[14px] font-medium text-[#71807A]">
            Photos → détails → génération → export.
          </p>
        </div>
        {article && (
          <div className="flex items-center gap-2.5 self-start rounded-[13px] border border-[#E4E9E2] bg-white px-3.5 py-2">
            <span className="font-grotesk text-[15px] font-bold">{article.sku}</span>
            <span className="h-4 w-px bg-[#E4E9E2]" />
            <span className="text-[13px] font-medium text-[#71807A]">
              {[marqueQcm, categorieQcm].filter(Boolean).join(" · ") || "à préciser"}
            </span>
          </div>
        )}
      </header>

      <Stepper step={step} onGo={setStep} />

      <div className="mx-auto max-w-[1000px]">
        {/* ÉTAPE 1 — Photos */}
        {step === 1 && (
          <div className="flex flex-col gap-[18px] [animation:stepIn_.3s_both]">
            {/* SKU */}
            <form onSubmit={lookup} className={`${cardCls} p-5 md:p-6`}>
              <label className={labelCls}>SKU de l’article</label>
              <div className="mt-2.5 flex flex-col gap-3 sm:flex-row">
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ex : PRL1"
                  autoCapitalize="characters"
                  className="min-w-0 flex-1 rounded-[13px] border-2 border-[#1B4332] px-4 py-3 font-grotesk text-[16px] font-bold uppercase text-[#16261D] outline-none"
                />
                <button
                  type="submit"
                  disabled={lookupLoading || !sku.trim()}
                  className="min-h-[48px] rounded-[13px] bg-[#1B4332] px-7 text-[14.5px] font-bold text-white transition-colors hover:bg-[#143528] disabled:opacity-50"
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
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#EEF1EC] pt-4 [animation:stepIn_.25s_both]">
                  <span className="font-grotesk text-[17px] font-bold">{article.sku}</span>
                  <StatutBadge statut={article.statut} />
                  <span className="text-[13.5px] font-medium text-[#71807A]">
                    Marque :{" "}
                    <b className="text-[#3C4D44]">
                      {listingLabels(article).marque || "à préciser"}
                    </b>
                  </span>
                  <span className="text-[13.5px] font-medium text-[#71807A]">
                    Catégorie :{" "}
                    <b className="text-[#3C4D44]">
                      {listingLabels(article).categorie || "à préciser"}
                    </b>
                  </span>
                  <span
                    title="Libellé du lot en base (utilisé par le Stock)"
                    className="rounded-full bg-[#F2F5F0] px-2.5 py-1 text-[12px] font-semibold text-[#8A998F]"
                  >
                    Lot : {article.marque}
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

                {/* Photos : la carte entière est la zone de dépôt */}
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragEnter={onDragOver}
                  onDragLeave={onDragLeave}
                  className={`${cardCls} p-5 transition-colors md:p-6 ${
                    isDragging ? "border-[#1B4332] bg-[#F0F5EE]" : ""
                  } [animation:stepIn_.28s_both]`}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
                      <h2 className="font-grotesk text-[17px] font-bold">
                        Photos de l’article
                      </h2>
                      <span className="text-[12.5px] font-medium text-[#94A29A]">
                        Ajoute-les, puis choisis les meilleures à l’étape suivante.
                      </span>
                    </div>
                    <span className="rounded-full bg-[#F2F5F0] px-3 py-1.5 text-[12.5px] font-semibold text-[#71807A]">
                      {photos.length} / {MAX_PHOTOS}
                      {processing > 0 ? ` · ${processing} en cours…` : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {photos.map((p, i) => (
                      <div
                        key={p.id}
                        className="group relative aspect-square overflow-hidden rounded-[15px] border border-[#E4E9E2] bg-[#F7F9F6] [animation:popIn_.2s_ease]"
                      >
                        <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[12px] font-bold text-white">
                          {i + 1}
                        </span>
                        <button
                          onClick={() => removePhoto(p.id)}
                          aria-label={`Supprimer la photo ${i + 1}`}
                          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#16261D]/55 text-white transition-colors hover:bg-[#16261D]/80"
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
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={photos.length >= MAX_PHOTOS}
                      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[15px] border-2 border-dashed border-[#C4D2C9] bg-[#F7F9F6] text-[#1B4332] transition-colors hover:border-[#1B4332] hover:bg-[#F0F5EE] disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#EAF3ED]">
                        <Upload className="h-[22px] w-[22px]" strokeWidth={1.9} />
                      </span>
                      <span className="text-[12.5px] font-bold">Ajouter</span>
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-2.5 rounded-[13px] border border-dashed border-[#C4D2C9] bg-[#F7F9F6] px-4 py-3">
                    <Upload
                      className="h-[18px] w-[18px] flex-shrink-0 text-[#1B4332]"
                      strokeWidth={1.9}
                    />
                    <span className="text-[13px] font-medium text-[#5A6B61]">
                      Glisse aussi tes fichiers directement ici — JPG, jusqu’à {MAX_PHOTOS} photos.
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ÉTAPE 2 — Détails */}
        {step === 2 && article && (
          <div className="grid grid-cols-1 items-start gap-[18px] [animation:stepIn_.3s_both] md:grid-cols-[340px_1fr]">
            {/* Photos + sélection */}
            <div className={`${cardCls} p-5 md:sticky md:top-5`}>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-grotesk text-[16px] font-bold">Photos pour l’IA</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${
                    selected.length >= MIN_SELECT
                      ? "bg-[#E4F3EA] text-[#2D6A4F]"
                      : "bg-[#F2F5F0] text-[#8A998F]"
                  }`}
                >
                  {selected.length} / {MAX_SELECT}
                </span>
              </div>
              <p className="mb-3.5 text-[12.5px] font-medium text-[#94A29A]">
                Choisis {MIN_SELECT} à {MAX_SELECT} photos. L’ordre = priorité.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {photos.map((p, i) => {
                  const order = selected.indexOf(p.id);
                  const sel = order >= 0;
                  return (
                    <div
                      key={p.id}
                      className={`relative aspect-square overflow-hidden rounded-[13px] border-[2.5px] transition-all ${
                        sel
                          ? "border-[#1B4332] shadow-[0_10px_22px_-12px_rgba(20,53,40,.7)]"
                          : "border-transparent outline outline-1 outline-[#E4E9E2]"
                      }`}
                    >
                      <button
                        onClick={() => toggleSelect(p.id)}
                        aria-pressed={sel}
                        aria-label={`Sélectionner la photo ${i + 1}`}
                        className="block h-full w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={fileName(i)}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      {sel && (
                        <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[12px] font-bold text-white [animation:popIn_.18s_ease]">
                          {order + 1}
                        </span>
                      )}
                      <button
                        onClick={() => setZoomedId(p.id)}
                        aria-label={`Agrandir la photo ${i + 1}`}
                        className="absolute bottom-1.5 right-1.5 z-10 flex h-[33px] w-[33px] items-center justify-center rounded-full bg-white/92 text-[#1B4332] shadow-[0_3px_9px_rgba(20,53,40,.22)] transition-colors hover:bg-white"
                      >
                        <ZoomIn className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-[13px] border-2 border-dashed border-[#CBD8CE] text-[#A6B2A9] transition-colors hover:border-[#1B4332] hover:text-[#1B4332]"
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
            <div className="flex flex-col gap-4">
              {/* Détecté depuis le lot */}
              <div className={`${cardCls} p-5 md:px-6`}>
                <div className="mb-3.5 flex items-center gap-2">
                  <Sparkles className="h-[15px] w-[15px] text-[#1B4332]" strokeWidth={2.2} />
                  <span className={labelCls}>Détecté depuis le lot — modifiable</span>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Marque</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {marqueChips.map((m) => (
                        <Chip
                          key={m}
                          value={m}
                          active={!marqueCustom && marqueQcm === m}
                          onClick={() => {
                            setMarqueCustom(false);
                            setMarqueQcm(m);
                          }}
                        />
                      ))}
                      <Chip
                        value={AUTRE}
                        active={marqueCustom}
                        onClick={() => {
                          setMarqueCustom(true);
                          setMarqueQcm("");
                        }}
                      />
                    </div>
                    {marqueCustom && (
                      <>
                        <input
                          value={marqueQcm}
                          onChange={(e) => setMarqueQcm(e.target.value)}
                          list="marques-list"
                          placeholder="Saisis la marque"
                          autoFocus
                          className={`${inputCls} mt-2.5 border-[1.5px] border-[#1B4332]`}
                        />
                        <datalist id="marques-list">
                          {MARQUES_LIST.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Catégorie</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {categorieChips.map((c) => (
                        <Chip
                          key={c}
                          value={c}
                          active={!categorieCustom && categorieQcm === c}
                          onClick={() => {
                            setCategorieCustom(false);
                            setCategorieQcm(c);
                          }}
                        />
                      ))}
                      <Chip
                        value={AUTRE}
                        active={categorieCustom}
                        onClick={() => {
                          setCategorieCustom(true);
                          setCategorieQcm("");
                        }}
                      />
                    </div>
                    {categorieCustom && (
                      <input
                        value={categorieQcm}
                        onChange={(e) => setCategorieQcm(e.target.value)}
                        placeholder="Saisis la catégorie"
                        autoFocus
                        className={`${inputCls} mt-2.5 border-[1.5px] border-[#1B4332]`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Champs requis */}
              <div className={`${cardCls} p-5 md:px-6`}>
                <div className="mb-4">
                  <div className="flex items-center gap-2.5">
                    <label className="text-[12.5px] font-bold tracking-[0.03em] text-[#16261D]">
                      Taille
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        taille
                          ? "bg-[#E4F3EA] text-[#2D6A4F]"
                          : "bg-[#FBEEE7] text-[#C2603F]"
                      }`}
                    >
                      {taille ? "ok" : "requis"}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {TAILLES.map((t) => (
                      <Chip
                        key={t}
                        value={t}
                        active={taille === t}
                        onClick={() => setTaille(taille === t ? "" : t)}
                      />
                    ))}
                  </div>
                </div>

                <div className="my-4 h-px bg-[#EEF1EC]" />

                <div className="mb-4">
                  <div className="flex items-center gap-2.5">
                    <label className="text-[12.5px] font-bold tracking-[0.03em] text-[#16261D]">
                      État
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        etat ? "bg-[#E4F3EA] text-[#2D6A4F]" : "bg-[#FBEEE7] text-[#C2603F]"
                      }`}
                    >
                      {etat ? "ok" : "requis"}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {ETATS.map((s) => (
                      <Chip
                        key={s}
                        value={s}
                        active={etat === s}
                        onClick={() => setEtat(etat === s ? "" : s)}
                      />
                    ))}
                  </div>
                </div>

                <div className="my-4 h-px bg-[#EEF1EC]" />

                <div>
                  <div className="flex items-center gap-2.5">
                    <label className="text-[12.5px] font-bold tracking-[0.03em] text-[#16261D]">
                      Matière
                    </label>
                    <span className="text-[11px] font-semibold text-[#A6B2A9]">
                      jusqu’à 2 · optionnel
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {MATIERES_SUGGESTIONS.map((m) => (
                      <Chip
                        key={m}
                        value={m}
                        active={matieres.includes(m)}
                        onClick={() => toggleMatiere(m)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Infos supplémentaires + prompt */}
              <div className={`${cardCls} p-5 md:px-6`}>
                <label className={labelCls}>Infos supplémentaires</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={2}
                  placeholder="Ex : dernière collection, coupe slim, voir photo 4…"
                  className={`${inputCls} mt-2 resize-y leading-[1.55]`}
                />
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-xl bg-[#F1F6F2] px-4 py-3">
                  <FileText className="h-4 w-4 flex-shrink-0 text-[#1B4332]" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-[#3C4D44]">
                    Prompt :{" "}
                    <b className="text-[#1B4332]">
                      {prompts.find((p) => p.id === selectedPromptId)?.nom ?? "aucun"}
                    </b>
                  </span>
                  <button
                    onClick={() => setShowPromptPicker((v) => !v)}
                    className="ml-auto text-[12px] font-semibold text-[#8A998F] transition-colors hover:text-[#1B4332]"
                  >
                    {showPromptPicker ? "Fermer" : "Changer"}
                  </button>
                </div>
                {showPromptPicker && (
                  <select
                    value={selectedPromptId ?? ""}
                    onChange={(e) => setSelectedPromptId(e.target.value || null)}
                    className={`${inputCls} mt-2.5`}
                  >
                    <option value="">— Sélectionner un prompt —</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Génération (chargement) */}
        {step === 3 && (
          <div className="[animation:stepIn_.3s_both]">
            {generate.isError ? (
              <div className={`${cardCls} px-6 py-12 text-center`}>
                <p className="mx-auto max-w-md rounded-[12px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[14px] text-[#C2603F]">
                  {(generate.error as Error).message}
                </p>
                <button onClick={() => setStep(2)} className={`${btnGhost} mx-auto mt-5`}>
                  <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={2.3} />
                  Retour
                </button>
              </div>
            ) : (
              <div className={`${cardCls} px-6 py-14 text-center`}>
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
                    <span
                      className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-[#1B4332] text-[#9FD4B5]"
                      style={{ animation: "pulseRing 2s infinite" }}
                    >
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
                        className={`flex items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-colors ${
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
          <div className={`${cardCls} px-6 py-12 text-center`}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF3E2]">
              <RefreshCw className="h-6 w-6 text-[#B5872E]" strokeWidth={2} />
            </div>
            <h2 className="font-grotesk text-[20px] font-bold text-[#16261D]">
              Session expirée
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] font-medium text-[#71807A]">
              {"Les photos et les données de l'article n'ont pas pu être restaurées."}
              {" Recommence depuis le début pour re-scanner le SKU."}
            </p>
            {result && (titre || description) && (
              <div className="mt-6 space-y-3 text-left">
                {titre && <CopyField label="Titre généré" value={titre} />}
                {description && (
                  <CopyField label="Description générée" value={description} multiline />
                )}
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 4 — Export */}
        {step === 4 && article && result && (
          <div className="flex flex-col gap-4 [animation:stepIn_.3s_both]">
            <div className="flex items-center gap-2.5 rounded-[14px] border border-[#CDE7D6] bg-[#E4F3EA] px-4 py-3.5">
              <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-white">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="text-[14px] font-bold text-[#1B4332]">
                Annonce générée — relis, ajuste, publie.
              </span>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_340px]">
              {/* Annonce éditable */}
              <div className={`${cardCls} p-5 md:p-6`}>
                <div className="flex items-center justify-between gap-2.5">
                  <label className={labelCls}>Titre</label>
                  <button
                    onClick={() => copier("titre")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E9E2] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#3C4D44] transition-colors hover:bg-[#F1F4EF]"
                  >
                    {copied === "titre" ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                    ) : (
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {copied === "titre" ? "Copié" : "Copier"}
                  </button>
                </div>
                <input
                  value={titre}
                  onChange={(e) => {
                    setTitre(e.target.value);
                    setSaved(false);
                  }}
                  className={`${inputCls} mt-2 font-grotesk text-[16px] font-bold`}
                />

                <label className={`${labelCls} mt-[18px] block`}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setSaved(false);
                  }}
                  rows={9}
                  className={`${inputCls} mt-2 resize-y bg-[#F9FBF8] leading-[1.65]`}
                />

                <label className={`${labelCls} mt-[18px] block`}>Mots-clés</label>
                <textarea
                  value={motsCles}
                  onChange={(e) => {
                    setMotsCles(e.target.value);
                    setSaved(false);
                  }}
                  rows={2}
                  className={`${inputCls} mt-2 resize-y`}
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

                <button
                  onClick={() => copier("annonce")}
                  className={`${btnGhost} mt-4`}
                >
                  {copied === "annonce" ? (
                    <Check className="h-4 w-4" strokeWidth={2.6} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={2} />
                  )}
                  {copied === "annonce" ? "Annonce copiée" : "Copier l’annonce complète"}
                </button>

                {updateArticle.isError && (
                  <p className="mt-3 rounded-[10px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-2.5 text-[13.5px] text-[#C2603F]">
                    {(updateArticle.error as Error).message}
                  </p>
                )}
              </div>

              {/* Photos + publication */}
              <div className="flex flex-col gap-4">
                {photos.length > 0 && (
                  <div className={`${cardCls} p-5`}>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-grotesk text-[15px] font-bold">
                        Photos ({photos.length})
                      </h2>
                      <button
                        onClick={downloadZip}
                        disabled={isZipping}
                        className="rounded-full border border-[#E4E9E2] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE] disabled:opacity-50"
                      >
                        {isZipping ? "Préparation…" : "ZIP"}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => triggerDownload(p.blob, fileName(i))}
                          className="aspect-square overflow-hidden rounded-[11px] border border-[#E4E9E2]"
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

                <div className={`${cardCls} p-5`}>
                  <div className={`${labelCls} mb-3.5`}>Publier</div>
                  <a
                    href="https://www.vinted.fr/items/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2.5 flex items-center gap-3 rounded-[15px] bg-[#09B1BA] px-4 py-3.5 shadow-[0_12px_24px_-12px_rgba(9,177,186,.75)] transition-transform hover:-translate-y-0.5"
                  >
                    <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-white/20 font-grotesk text-[19px] font-extrabold text-white">
                      V
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[15px] font-extrabold text-white">
                        Vinted
                      </span>
                      <span className="block text-[11.5px] font-medium text-white/85">
                        Ouvrir le formulaire de vente
                      </span>
                    </span>
                    <ArrowRight
                      className="ml-auto h-5 w-5 flex-shrink-0 text-white"
                      strokeWidth={2.4}
                    />
                  </a>
                  <a
                    href="https://www.vestiairecollective.com/sell/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[15px] bg-[#16261D] px-4 py-3.5 shadow-[0_12px_24px_-14px_rgba(22,38,29,.85)] transition-transform hover:-translate-y-0.5"
                  >
                    <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-white/15 font-grotesk text-[14px] font-extrabold text-white">
                      VC
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[15px] font-extrabold text-white">
                        Vestiaire Collective
                      </span>
                      <span className="block text-[11.5px] font-medium text-white/70">
                        Ouvrir le dépôt d’article
                      </span>
                    </span>
                    <ArrowRight
                      className="ml-auto h-5 w-5 flex-shrink-0 text-white"
                      strokeWidth={2.4}
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Barre d'action collante — au-dessus de la bottom nav sur mobile ── */}
      <div
        className="sticky z-30 mx-auto mt-5 max-w-[1000px] md:bottom-5"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4E9E2] bg-white p-2.5 pl-3.5 shadow-[0_16px_34px_-20px_rgba(20,53,40,.4)] md:pl-5">
          <div className="flex min-w-0 items-center gap-3">
            {(step === 2 || step === 4) && (
              <button onClick={() => setStep(step - 1)} className={btnGhost}>
                <ArrowLeft className="h-4 w-4" strokeWidth={2.3} />
                <span className="hidden sm:inline">Retour</span>
              </button>
            )}
            <span
              className={`truncate text-[12.5px] font-semibold md:text-[13px] ${
                hintOk ? "text-[#1B4332]" : "text-[#C2603F]"
              }`}
            >
              {hint}
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={resetAll}
              title="Tout réinitialiser"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-[#8A998F] transition-colors hover:text-[#1B4332]"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              <span className="hidden md:inline">Recommencer</span>
            </button>
            <button
              onClick={primaryAction}
              disabled={!primaryEnabled}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-[13px] px-5 text-[14px] font-extrabold text-white transition-all md:text-[15px] ${
                primaryEnabled
                  ? "bg-[#1B4332] shadow-[0_12px_26px_-12px_rgba(20,53,40,.9)] hover:bg-[#143528]"
                  : "cursor-not-allowed bg-[#C3D0C8]"
              }`}
            >
              {updateArticle.isPending && step === 4 ? "Enregistrement…" : primaryLabel}
              {primaryIcon}
            </button>
          </div>
        </div>
      </div>

      {/* Zoom photo : image réaffichée depuis sa source pleine résolution. */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${zoomedIdx + 1}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#16261D]/55 p-6 [animation:overlayIn_.2s_ease_both]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[min(540px,92vw)] rounded-[22px] bg-white p-4 shadow-[0_30px_80px_-18px_rgba(0,0,0,.5)] [animation:zoomCardIn_.28s_cubic-bezier(.16,.84,.44,1)_both]"
          >
            <button
              onClick={() => setZoomedId(null)}
              aria-label="Fermer"
              className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#1B4332] text-white shadow-[0_8px_20px_-6px_rgba(20,53,40,.7)] transition-colors hover:bg-[#143528]"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomedPhoto.url}
              alt={fileName(zoomedIdx)}
              className="max-h-[70vh] w-full rounded-[14px] object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <span className="font-grotesk text-[14px] font-semibold text-[#5A6B61]">
                {fileName(zoomedIdx)}
              </span>
              <button onClick={() => setZoomedId(null)} className={btnGhost}>
                Fermer
              </button>
            </div>
          </div>
        </div>
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
