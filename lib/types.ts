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
  canal: string | null;
  dateVente: string | null; // ISO
  transporteur: string | null;
  trelloCardId: string | null;
  photosPretes: boolean; // photos retouchées et téléchargées
  commandeId: string | null;
  prixUnitaire: number | null; // dérivé de la commande
  coefObjectif: number | null; // objectif de coef de la commande
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
  coefObjectif: number | null;
};

export type CommandeStatsRow = {
  categorie: string;
  total: number;
  enStock: number;
  enVente: number;
  vendus: number;
  ca: number;
  margeNette: number;
  coefMoyen: number;
  pctVendu: number; // 0..1
};

export type CommandeStatsDTO = {
  rows: CommandeStatsRow[];
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

export type WeekdayPoint = {
  jour: string; // Lundi…Dimanche
  vendus: number;
  ca: number; // chiffre d'affaires cumulé sur ce jour de semaine
  dateRecente: string | null; // ISO : date la plus récente tombant ce jour-là
};

export type StatsBrandRow = {
  marque: string;
  margeNette: number;
  coefMoyen: number;
  vendus: number;
};

export type TopArticle = {
  sku: string;
  marque: string;
  prixVente: number;
  margeNette: number;
};

export type StatutCount = {
  statut: string;
  count: number;
};

export type CanalCA = {
  canal: string;
  ca: number;
};

export type StatsDTO = {
  vitesse: {
    parJour7: number; // moyenne articles vendus / jour sur 7 jours
    parJour30: number; // moyenne sur 30 jours
    total7: number;
    total30: number;
  };
  parJourSemaine: WeekdayPoint[];
  marquesRentables: StatsBrandRow[];
  topArticles: TopArticle[];
  projection: {
    restants: number; // articles non vendus
    cadenceParJour: number; // base de calcul
    joursRestants: number | null; // null si cadence nulle
  };
  repartitionStatuts: StatutCount[];
  caParCanal: CanalCA[];
};
