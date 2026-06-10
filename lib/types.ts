// Types DTO échangés entre les API routes et le client.

export type ArticleDTO = {
  id: string;
  sku: string;
  marque: string;
  categorie: string;
  grade: string | null;
  statut: string;
  prixAchat: number;
  prixVente: number | null;
  margeBrute: number | null;
  margeNette: number | null;
  coefficient: number | null;
  dateVente: string | null; // ISO
  commandeId: string | null;
  prixUnitaire: number | null; // dérivé de la commande
};

export type CommandeDTO = {
  id: string;
  date: string;
  fournisseur: string;
  nbArticles: number;
  coutTotal: number;
  prixUnitaire: number;
  marque: string | null;
  categorie: string | null;
  grade: string | null;
};

export type BrandRow = {
  marque: string;
  total: number;
  enStock: number;
  vendus: number;
  ca: number;
  margeNette: number;
  coefMoyen: number;
  panierMoyen: number;
  pctVendu: number;
};

export type WeekPoint = {
  semaine: string; // ex. "12 mai"
  ca: number;
};

export type DashboardDTO = {
  caTotal: number;
  margeNetteTotal: number;
  enStock: number;
  pctVendu: number;
  totalArticles: number;
  vendus: number;
  parMarque: BrandRow[];
  caParSemaine: WeekPoint[];
};

export type CalendarArticle = {
  id: string;
  sku: string;
  marque: string;
  prixVente: number;
  margeNette: number;
  coefficient: number;
};

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  ca: number;
  nbArticles: number;
  net: number;
  articles: CalendarArticle[];
};

export type CalendarWeek = {
  ca: number;
  nbArticles: number;
  net: number;
  coefMoyen: number;
  panierMoyen: number;
};

export type CalendarDTO = {
  month: string; // YYYY-MM
  days: CalendarDay[];
  total: { ca: number; nbArticles: number; net: number };
};
