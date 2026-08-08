// Augmentation des types Auth.js v5.
//
// Par défaut, `Session["user"]` ne porte que name / email / image, et le JWT
// n'expose que `sub`. Les callbacks `jwt` et `session` d'auth.config.ts y
// ajoutent `id` et `prenom` ; ce fichier fait connaître ces champs à
// TypeScript, sinon chaque lecture de `session.user.id` demanderait un cast.
//
// Effet de bord voulu : toute route API qui oublie de scoper par utilisateur
// devient repérable à la compilation plutôt qu'en production.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      prenom: string | null;
    } & DefaultSession["user"];
  }

  // Ce que `authorize()` renvoie dans auth.ts.
  interface User {
    prenom?: string | null;
  }
}

// Le JWT s'augmente sur "@auth/core/jwt" et NON sur "next-auth/jwt" :
// ce dernier n'est qu'un `export * from "@auth/core/jwt"`, et augmenter un
// module qui ne déclare pas l'interface en crée une seconde, parallèle, au lieu
// de fusionner avec l'originale. Symptôme : `token.id` reste `unknown`.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    prenom: string | null;
  }
}
