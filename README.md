# Compta Polos

Mini-SaaS de comptabilité et de gestion de stock pour un revendeur de vêtements
de marque (Polo Ralph Lauren, Lacoste, Tommy Hilfiger). L'application permet de
suivre les commandes, le stock d'articles et le calendrier d'activité depuis une
interface unique, protégée par authentification.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (design system « Forest Precision », police Plus Jakarta Sans via `next/font/google`)
- **Prisma 6** + **PostgreSQL** (Neon)
- **NextAuth v5** (CredentialsProvider, compte unique)
- **Recharts** (graphiques — à venir)

## Démarrage

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Configurer l'environnement. Copier le fichier d'exemple puis renseigner les
   valeurs :

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable          | Description                                           |
   | ----------------- | ----------------------------------------------------- |
   | `DATABASE_URL`    | Chaîne de connexion PostgreSQL (Neon)                 |
   | `NEXTAUTH_SECRET` | Secret de session — générer avec `npx auth secret`    |
   | `NEXTAUTH_URL`    | URL de l'app (`http://localhost:3000` en dev)         |
   | `AUTH_EMAIL`      | Email du compte propriétaire                          |
   | `AUTH_PASSWORD`   | Hash bcrypt du mot de passe (voir ci-dessous)         |

3. Créer les tables dans la base :

   ```bash
   npx prisma db push
   ```

4. Lancer le serveur de développement :

   ```bash
   npm run dev
   ```

   L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Générer le hash bcrypt du mot de passe

Le mot de passe n'est jamais stocké en clair : `AUTH_PASSWORD` contient son hash
bcrypt. Pour le générer, exécuter (avec `bcryptjs` déjà installé) :

```bash
node -e "console.log(require('bcryptjs').hashSync('mon-mot-de-passe', 10))"
```

Copier la valeur affichée dans `AUTH_PASSWORD` de `.env.local`.

## Déploiement

L'application est conçue pour être déployée sur **Vercel** avec la base de données
hébergée sur **Neon**. Penser à renseigner les mêmes variables d'environnement
dans le projet Vercel.
