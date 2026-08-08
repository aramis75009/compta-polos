"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { objectifLegacy, oublierObjectifLegacy } from "./objectif";
import type {
  ArticleDTO,
  CalendarDTO,
  CommandeDTO,
  CommandeStatsDTO,
  CompteVente,
  DashboardDTO,
  NotificationsDTO,
  PromptTemplateDTO,
  StatsDTO,
  UserSettingsDTO,
} from "./types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    toast.error("Session expirée, reconnecte-toi.");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
    throw new Error("Session expirée.");
  }
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
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
}

// ---------- Notifications ----------

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => jsonFetch<NotificationsDTO>("/api/notifications"),
    // Rappels : une donnée un peu fraîche suffit, on rafraîchit à l'ouverture.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

// ---------- Articles ----------

export type ArticleFilters = {
  marque?: string;
  lot?: string; // libellé du lot d'achat (« Short Adidas »)
  statut?: string;
  q?: string;
  commande?: string;
};

export function useArticles(filters: ArticleFilters = {}) {
  // Les clés d'`ArticleFilters` sont exactement les noms de paramètres attendus
  // par /api/articles : les valeurs vides sont simplement omises.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();

  return useQuery({
    queryKey: ["articles", filters],
    queryFn: () =>
      jsonFetch<ArticleDTO[]>(`/api/articles${qs ? `?${qs}` : ""}`),
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
  titreAnnonce: string | null;
  descriptionAnnonce: string | null;
  motsClesAnnonce: string | null;
  compteVente: CompteVente | null;
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

// ---------- Réglages du compte ----------

export function useReglages() {
  return useQuery({
    queryKey: ["reglages"],
    queryFn: () => jsonFetch<UserSettingsDTO>("/api/user/settings"),
    staleTime: 60_000,
  });
}

/**
 * Objectif de CA mensuel, porté par le compte.
 *
 * Reprend une seule fois l'ancienne valeur du localStorage : uniquement si le
 * compte n'en a pas encore, sinon un vieux navigateur écraserait un objectif
 * fixé depuis un autre appareil.
 */
export function useObjectifMensuel() {
  const { data, isLoading } = useReglages();
  const enregistrer = useSetObjectif();
  const reprise = useRef(false);

  useEffect(() => {
    if (isLoading || !data || reprise.current) return;
    reprise.current = true;
    if (data.objectifMensuel != null) {
      oublierObjectifLegacy();
      return;
    }
    const ancien = objectifLegacy();
    if (ancien != null) {
      enregistrer.mutate(ancien, { onSuccess: oublierObjectifLegacy });
    }
  }, [data, isLoading, enregistrer]);

  return { objectif: data?.objectifMensuel ?? null, isLoading };
}

export function useSetObjectif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (objectifMensuel: number | null) =>
      jsonFetch<{ ok: true }>("/api/user/settings", {
        method: "PUT",
        body: JSON.stringify({ objectifMensuel }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reglages"] }),
  });
}

// ---------- Commandes ----------

/** Une pièce saisie individuellement, en mode DETAILLE. */
export type LigneCommande = {
  marque: string;
  categorie: string;
  /** Prix payé pour CETTE pièce, hors frais de livraison. */
  prixAchat: number;
  /**
   * Préfixe SKU de cette pièce. Un lot mixte porte plusieurs séries — des sacs
   * Nike et des coques Rhodes n'ont pas la même numérotation.
   */
  prefixeSku?: string;
};

/**
 * Deux formes d'entrée pour une même route, distinguées par `modeSaisie` :
 *
 * - LISSE    : on saisit un coût total et un nombre d'articles, le prix est
 *              réparti uniformément. Mode historique.
 * - DETAILLE : on saisit une ligne par pièce avec son prix réel, plus les
 *              frais de livraison. `coutTotal` et `nbArticles` sont alors
 *              CALCULÉS par le serveur depuis les lignes — jamais envoyés,
 *              sinon les deux pourraient diverger.
 */
export type CommandeInput = {
  fournisseur: string;
  date: string;
  marque: string;
  categorie: string;
  grade?: string | null;
  coefObjectif?: number | null;
  /** Préfixe SKU du lot. À défaut, le serveur reprend la suggestion. */
  prefixeSku?: string;
} & (
  | {
      modeSaisie?: "LISSE";
      coutTotal: number;
      nbArticles: number;
    }
  | {
      modeSaisie: "DETAILLE";
      fraisLivraison: number;
      lignes: LigneCommande[];
    }
);

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
    queryFn: () => jsonFetch<CommandeStatsDTO>(`/api/commandes/${id}/stats`),
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
      compteVente,
    }: {
      id: string;
      prixVente: number;
      dateVente: string;
      canal?: string;
      compteVente?: CompteVente;
    }) =>
      jsonFetch<{ article: ArticleDTO; trello: string | null }>(
        `/api/articles/${id}/comptabiliser`,
        {
          method: "POST",
          body: JSON.stringify({ prixVente, dateVente, canal, compteVente }),
        },
      ),
    onSuccess: invalidate,
  });
}

// ---------- Statistiques ----------

// `commandeId` restreint les statistiques à un lot. La clé de cache l'inclut :
// chaque commande garde ses résultats, le retour sur « Tout l'historique » est
// instantané.
export function useStats(commandeId?: string | null) {
  return useQuery({
    queryKey: ["stats", commandeId ?? "all"],
    queryFn: () =>
      jsonFetch<StatsDTO>(
        commandeId
          ? `/api/stats?commande=${encodeURIComponent(commandeId)}`
          : "/api/stats",
      ),
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
  details: string | null; // infos supplémentaires libres
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
