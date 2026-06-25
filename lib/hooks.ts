"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  ArticleDTO,
  CalendarDTO,
  CommandeDTO,
  CommandeStatsDTO,
  DashboardDTO,
  PromptTemplateDTO,
  StatsDTO,
} from "./types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = "Une erreur est survenue.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* corps non-JSON */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// Invalide les trois vues dépendantes des données (stock/dashboard/calendrier).
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["articles"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["commandes"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };
}

// ---------- Articles ----------

export type ArticleFilters = {
  marque?: string;
  statut?: string;
  q?: string;
  commande?: string;
};

export function useArticles(filters: ArticleFilters = {}) {
  const params = new URLSearchParams();
  if (filters.marque) params.set("marque", filters.marque);
  if (filters.statut) params.set("statut", filters.statut);
  if (filters.q) params.set("q", filters.q);
  if (filters.commande) params.set("commande", filters.commande);
  const qs = params.toString();

  return useQuery({
    queryKey: ["articles", filters],
    queryFn: () => jsonFetch<ArticleDTO[]>(`/api/articles${qs ? `?${qs}` : ""}`),
  });
}

export type ArticlePatch = Partial<{
  sku: string;
  marque: string;
  categorie: string;
  grade: string | null;
  statut: string;
  prixAchat: number;
  prixVente: number | null;
  dateVente: string | null;
  canal: string | null;
  photosPretes: boolean;
  titreAnnonce: string | null;
  descriptionAnnonce: string | null;
  motsClesAnnonce: string | null;
}>;

// Champs dont la modification impacte les vues agrégées
// (CA/marge du dashboard, stats, calendrier des ventes).
const AGGREGATE_KEYS: (keyof ArticlePatch)[] = [
  "statut",
  "prixVente",
  "prixAchat",
  "dateVente",
  "canal",
];

export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ArticlePatch }) =>
      jsonFetch<ArticleDTO>(`/api/articles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    // --- Optimistic update : la cellule change visuellement avant la réponse.
    onMutate: async ({ id, patch }) => {
      // Stoppe les refetch en cours pour qu'ils n'écrasent pas l'update optimiste.
      await qc.cancelQueries({ queryKey: ["articles"] });
      // Snapshot de toutes les variantes ["articles", filters] en cache.
      const previous = qc.getQueriesData<ArticleDTO[]>({
        queryKey: ["articles"],
      });
      // Applique le patch à l'article concerné dans chaque entrée de cache.
      qc.setQueriesData<ArticleDTO[]>({ queryKey: ["articles"] }, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      return { previous };
    },
    // Rollback : on restaure chaque entrée de cache touchée.
    onError: (_err, _vars, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    // Invalidation ciblée (cf. lot 1) — exécutée en succès comme en erreur, pour
    // resynchroniser les valeurs serveur (marges/coef recalculés notamment).
    onSettled: (_data, _err, { patch }) => {
      // Un patch touche toujours la liste des articles.
      qc.invalidateQueries({ queryKey: ["articles"] });
      // On ne recharge dashboard/stats/calendrier que si un champ financier ou
      // temporel a changé. Un patch « simple » (sku, marque, catégorie, grade)
      // ne touche aucun agrégat → pas de refetch inutile.
      if (AGGREGATE_KEYS.some((k) => k in patch)) {
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        qc.invalidateQueries({ queryKey: ["calendar"] });
      }
      // Jamais ["commandes"] : un patch d'article ne modifie pas une commande.
    },
  });
}

export function useDeleteArticle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: true }>(`/api/articles/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ---------- Commandes ----------

export type CommandeInput = {
  fournisseur: string;
  date: string;
  coutTotal: number;
  nbArticles: number;
  marque: string;
  categorie: string;
  grade?: string | null;
  coefObjectif?: number | null;
};

export function useCreateCommande() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CommandeInput) =>
      jsonFetch<CommandeDTO>("/api/commandes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useCommandes() {
  return useQuery({
    queryKey: ["commandes"],
    queryFn: () => jsonFetch<CommandeDTO[]>("/api/commandes"),
  });
}

export function useCommandeStats(id: string | null) {
  return useQuery({
    queryKey: ["commande-stats", id],
    enabled: !!id,
    queryFn: () =>
      jsonFetch<CommandeStatsDTO>(`/api/commandes/${id}/stats`),
  });
}

export type ImportResult = {
  commandeId: string;
  nbImportes: number;
  nbDoublons: number;
  nbErreurs: number;
  categories: string[];
};

export function useImportCommande() {
  const invalidate = useInvalidateAll();
  return useMutation({
    // FormData → pas de header Content-Type (le navigateur gère le boundary).
    mutationFn: async (form: FormData) => {
      const res = await fetch("/api/commandes/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'import.");
      return data as ImportResult;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCommande() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: true }>(`/api/commandes/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ---------- Actions groupées / comptabilisation ----------

export function useBulkUpdateStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ ids, statut }: { ids: string[]; statut: string }) =>
      jsonFetch<{ count: number; statut: string }>("/api/articles/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids, statut }),
      }),
    onSuccess: invalidate,
  });
}

export function useComptabiliser() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      prixVente,
      dateVente,
      canal,
    }: {
      id: string;
      prixVente: number;
      dateVente: string;
      canal?: string;
    }) =>
      jsonFetch<{ article: ArticleDTO; trello: string | null }>(
        `/api/articles/${id}/comptabiliser`,
        {
          method: "POST",
          body: JSON.stringify({ prixVente, dateVente, canal }),
        },
      ),
    onSuccess: invalidate,
  });
}

// ---------- Statistiques ----------

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => jsonFetch<StatsDTO>("/api/stats"),
  });
}

// ---------- Dashboard ----------

export type DashboardPeriode = "all" | "month" | "30j" | "3m";

export function useDashboard(periode: DashboardPeriode = "all") {
  return useQuery({
    queryKey: ["dashboard", periode],
    queryFn: () => jsonFetch<DashboardDTO>(`/api/dashboard?periode=${periode}`),
  });
}

// ---------- Calendrier ----------

export function useCalendar(month: string) {
  return useQuery({
    queryKey: ["calendar", month],
    queryFn: () => jsonFetch<CalendarDTO>(`/api/calendar?month=${month}`),
  });
}

// ---------- Prompts (Mise en vente) ----------

export type PromptInput = {
  nom: string;
  marque: string | null;
  categorie: string | null;
  contenu: string;
  estDefaut: boolean;
};

export function usePrompts() {
  return useQuery({
    queryKey: ["prompts"],
    queryFn: () => jsonFetch<PromptTemplateDTO[]>("/api/prompts"),
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PromptInput) =>
      jsonFetch<PromptTemplateDTO>("/api/prompts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PromptInput> }) =>
      jsonFetch<PromptTemplateDTO>(`/api/prompts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: true }>(`/api/prompts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

// ---------- Génération d'annonce ----------

export type GenerateInput = {
  sku: string;
  marque: string | null;
  categorie: string | null;
  taille: string | null;
  etat: string | null;
  matiere: string | null;
  images: string[]; // dataURL base64
  promptId?: string; // prompt choisi manuellement (sinon sélection auto)
};

export type GenerateResult = {
  titre: string;
  description: string;
  motsCles: string;
  promptNom: string;
};

export function useGenerateListing() {
  return useMutation({
    mutationFn: (input: GenerateInput) =>
      jsonFetch<GenerateResult>("/api/listings/generate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
