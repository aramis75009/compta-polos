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
  DashboardDTO,
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
  };
}

// ---------- Articles ----------

export type ArticleFilters = {
  marque?: string;
  statut?: string;
  q?: string;
};

export function useArticles(filters: ArticleFilters = {}) {
  const params = new URLSearchParams();
  if (filters.marque) params.set("marque", filters.marque);
  if (filters.statut) params.set("statut", filters.statut);
  if (filters.q) params.set("q", filters.q);
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
