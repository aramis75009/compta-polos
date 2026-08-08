// Ce que MyFlip attend d'un board Trello.
//
// Module volontairement sans dépendance : il est lu par le serveur (qui crée
// ces colonnes et ces étiquettes) ET par la page de démarrage (qui les annonce
// avant de les créer). Les garder ici évite d'embarquer les helpers d'API
// Trello dans le bundle du navigateur, et surtout évite deux listes qui
// divergeraient — l'écran promettrait alors autre chose que ce qui est créé.

/** Les trois colonnes du flux, dans l'ordre. */
export const COLONNES = ["Commandé ✅", "Emballé 📦", "Envoyé 🚚"] as const;

/**
 * Les deux étiquettes dont dépend la comptabilité.
 *
 * « À comptabiliser » déclenche l'entrée en compta depuis Trello ;
 * « Comptabilisé » est reposée par MyFlip après validation de la vente.
 */
export const ETIQUETTES_COMPTA = [
  { role: "compta" as const, name: "À comptabiliser", color: "purple" },
  { role: "comptabilise" as const, name: "Comptabilisé", color: "green" },
];

/**
 * Transporteurs proposés par défaut.
 *
 * Le transporteur d'un article est déduit du nom de l'AUTRE étiquette de sa
 * carte (cf. le webhook) : ces étiquettes ne sont pas décoratives, elles
 * alimentent une donnée.
 */
export const TRANSPORTEURS = [
  { name: "Mondial Relay", color: "yellow" },
  { name: "Colissimo", color: "blue" },
  { name: "Chronopost", color: "orange" },
  { name: "UPS", color: "red" },
  { name: "Vinted Go", color: "sky" },
];
