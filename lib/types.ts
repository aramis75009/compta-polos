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
  commandeId: string | null;
  prixUnitaire: number | null; // dérivé de la commande
  coefObjectif: number | null; // objectif de coef de la commande
  titreAnnonce: string | null;
  descriptionAnnonce: string | null;
  motsClesAnnonce: string | null;
  commandeFournisseur: string | null;
};

export type PromptTemplateDTO = {
  id: string;
  nom: string;
  marque: string | null;
  categorie: string | null;
  contenu: string;
  estDefaut: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
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

export type CanalRow = {
  canal: string;
  vendus: number;
  ca: number;
  panierMoyen: number;
  pctCa: number; // 0..1
};

/**
 * Synthèse d'une commande : où en est la rentabilité, et où elle atterrit.
 * Tout est calculé côté serveur à partir des articles du lot.
 * Les champs nullables valent null quand la donnée est indisponible
 * (aucune vente, pas d'objectif de coef…) — jamais 0, qui serait un mensonge.
 */
export type CommandeResume = {
  // — Où on en est —
  coutTotal: number;
  totalArticles: number;
  vendus: number;
  restants: number; // ni vendus, ni perdus
  perdus: number;
  montantRecupere: number;
  resteARecuperer: number;
  margeNetteRealisee: number;
  panierMoyen: number | null;
  coefActuel: number | null; // CA encaissé / coût total
  coefObjectif: number | null;
  seuilArticles: number | null; // articles à vendre pour rembourser le lot

  // — Projection —
  caProjete: number | null; // si les restants partent au panier moyen
  margeProjetee: number | null;
  coefProjete: number | null;
  prixMoyenRequis: number | null; // prix moyen à tenir sur les restants pour l'objectif
  rythmeHebdo: number | null; // ventes par semaine
  rythmeRecent: boolean; // true = calculé sur les 28 derniers jours
  joursEcoulement: number | null; // jours estimés pour écouler les restants
  dateEcoulement: string | null; // ISO

  // — Temps —
  ageJours: number;
  datePointMort: string | null; // ISO — date de franchissement du seuil
  joursPointMort: number | null; // depuis la date de commande
  delaiMoyenVente: number | null; // jours entre l'achat du lot et la vente

  // — Canaux & angles morts —
  canaux: CanalRow[];
  dormants: number; // en stock, photos pas prêtes
  caDormant: number | null;
  meilleureCategorie: { categorie: string; coefMoyen: number } | null;
  pireCategorie: { categorie: string; coefMoyen: number } | null;
};

export type CommandeStatsDTO = {
  rows: CommandeStatsRow[];
  resume: CommandeResume;
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

// Évolution mois calendaire courant vs mois précédent (basée sur dateVente).
// pct est null quand le mois précédent est nul (pas de base de comparaison).
export type DashboardDelta = {
  pct: number | null;
  abs: number;
};

export type DashboardDTO = {
  caTotal: number;
  margeNetteTotal: number;
  margeMoyenne: number; // margeNetteTotal / caTotal (0..1)
  enStock: number;
  enVente: number; // articles actuellement au statut « En vente »
  nouveaux: number; // articles créés dans la période (createdAt)
  pctVendu: number;
  totalArticles: number;
  vendus: number;
  parMarque: BrandRow[];
  caParSemaine: WeekPoint[];
  caParJour: { jour: string; ca: number }[]; // CA jour par jour du mois en cours
  caDelta: DashboardDelta; // CA mois courant vs mois précédent
  margeDelta: DashboardDelta; // marge nette mois courant vs mois précédent
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

// Notifications : rappels d'actions à mener, calculés côté serveur.
export type NotificationItem = {
  key: string; // identifiant stable (ex. "a-comptabiliser")
  severity: "action" | "info"; // action = à faire ; info = à surveiller
  title: string;
  message: string;
  count: number;
  href: string; // vue filtrée correspondante
};

export type NotificationsDTO = {
  items: NotificationItem[];
  total: number; // somme des compteurs
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
