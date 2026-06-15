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
}>;

export function useUpdateArticle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ArticlePatch }) =>
      jsonFetch<ArticleDTO>(`/api/articles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
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

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => jsonFetch<DashboardDTO>("/api/dashboard"),
  });
}

// ---------- Calendrier ----------

export function useCalendar(month: string) {
  return useQuery({
    queryKey: ["calendar", month],
    queryFn: () => jsonFetch<CalendarDTO>(`/api/calendar?month=${month}`),
  });
}
