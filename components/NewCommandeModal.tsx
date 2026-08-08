"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { useCreateCommande, type LigneCommande } from "@/lib/hooks";
import {
  euros,
  normaliserPrefixe,
  prixUnitaire,
  repartirFrais,
  skuPrefix,
} from "@/lib/calc";

const MARQUES = ["Polo Ralph Lauren", "Lacoste", "Tommy Hilfiger"];

type Mode = "LISSE" | "DETAILLE";

/**
 * Une ligne en cours de saisie : les prix restent des chaînes tant qu'on tape.
 * `prefixe` vide = « suivre la suggestion », même convention que le serveur.
 */
type LigneForm = {
  id: number;
  marque: string;
  categorie: string;
  prix: string;
  prefixe: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

let compteurId = 0;
const nouvelleLigne = (
  marque: string,
  categorie: string,
  prefixe = "",
): LigneForm => ({
  id: ++compteurId,
  marque,
  categorie,
  prix: "",
  prefixe,
});

export default function NewCommandeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateCommande();

  const [mode, setMode] = useState<Mode>("LISSE");
  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(todayISO());
  const [marque, setMarque] = useState(MARQUES[0]);
  const [categorie, setCategorie] = useState("Polo");
  const [grade, setGrade] = useState("");
  const [coefObjectif, setCoefObjectif] = useState("2.5");
  // Vide = on suit la suggestion. Les abréviations d'Aramis (SDN, HZT, ETH…)
  // ne se déduisent d'aucune règle : la suggestion n'est qu'un point de départ.
  const [prefixe, setPrefixe] = useState("");

  // Mode lissé
  const [coutTotal, setCoutTotal] = useState("");
  const [nbArticles, setNbArticles] = useState("");

  // Mode détaillé
  const [fraisLivraison, setFraisLivraison] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([
    nouvelleLigne(MARQUES[0], "Polo"),
  ]);

  const cout = Number(coutTotal);
  const nb = Number(nbArticles);
  const puLisse =
    Number.isFinite(cout) && Number.isInteger(nb) && nb > 0
      ? prixUnitaire(cout, nb)
      : null;

  // Aperçu du mode détaillé. Utilise `repartirFrais`, la même fonction que le
  // serveur : ce que l'utilisateur voit est ce qui sera enregistré.
  const apercu = useMemo(() => {
    const prix = lignes.map((l) => Number(l.prix));
    const valides = prix.every((p) => Number.isFinite(p) && p >= 0);
    if (!valides || prix.length === 0) return null;

    const frais = Number(fraisLivraison || 0);
    if (!Number.isFinite(frais) || frais < 0) return null;

    const avecFrais = repartirFrais(prix, frais);
    const total = avecFrais.reduce((s, p) => s + p, 0);
    return {
      sommeArticles: prix.reduce((s, p) => s + p, 0),
      frais,
      total,
      moyen: total / prix.length,
      nb: prix.length,
    };
  }, [lignes, fraisLivraison]);

  // Préfixe SKU. Un champ vide suit la suggestion — même convention que le
  // serveur quand `prefixeSku` est absent, donc aucune valeur imposée dans
  // l'input : l'utilisateur voit une proposition, pas une saisie à effacer.
  const prefixeSuggere = skuPrefix(marque, categorie.trim());
  const prefixeLot = normaliserPrefixe(prefixe) || prefixeSuggere;

  /** Préfixe retenu pour une pièce : le sien, sinon celui déduit de sa marque. */
  const prefixeDeLigne = (l: LigneForm) =>
    normaliserPrefixe(l.prefixe) ||
    skuPrefix(
      l.marque.trim() || marque,
      l.categorie.trim() || categorie.trim(),
    );

  // Un lot détaillé peut mêler plusieurs séries : on les annonce toutes.
  const series = [...new Set(lignes.map(prefixeDeLigne))];

  const reset = () => {
    setMode("LISSE");
    setFournisseur("");
    setDate(todayISO());
    setCoutTotal("");
    setNbArticles("");
    setFraisLivraison("");
    setMarque(MARQUES[0]);
    setCategorie("Polo");
    setGrade("");
    setCoefObjectif("2.5");
    setPrefixe("");
    setLignes([nouvelleLigne(MARQUES[0], "Polo")]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const coefObj = Number(coefObjectif);
    const commun = {
      fournisseur: fournisseur.trim(),
      date: new Date(date).toISOString(),
      marque,
      categorie: categorie.trim(),
      grade: grade.trim() || null,
      coefObjectif: Number.isFinite(coefObj) && coefObj > 0 ? coefObj : null,
      // Envoyé résolu, jamais brut : le serveur retomberait sinon sur sa propre
      // suggestion, et les SKU annoncés sous le formulaire ne seraient pas ceux
      // enregistrés.
      prefixeSku: prefixeLot,
    };

    if (mode === "DETAILLE") {
      const payload: LigneCommande[] = lignes.map((l) => ({
        marque: l.marque.trim() || marque,
        categorie: l.categorie.trim() || categorie.trim(),
        prixAchat: Number(l.prix),
        prefixeSku: prefixeDeLigne(l),
      }));
      // `coutTotal` et `nbArticles` ne sont pas envoyés : le serveur les calcule
      // depuis les lignes, seule façon de garantir Σ prixAchat = coutTotal.
      await create.mutateAsync({
        ...commun,
        modeSaisie: "DETAILLE",
        fraisLivraison: Number(fraisLivraison || 0),
        lignes: payload,
      });
    } else {
      await create.mutateAsync({
        ...commun,
        modeSaisie: "LISSE",
        coutTotal: cout,
        nbArticles: nb,
      });
    }

    reset();
    onClose();
  };

  const field =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
  const label = "mb-1.5 block text-label-sm text-ink-muted";

  const prêt =
    mode === "LISSE"
      ? puLisse != null
      : apercu != null && apercu.total > 0 && apercu.nb > 0;

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle commande">
      <form onSubmit={submit} className="space-y-3">
        {/* Bascule de mode. Placée en tête : elle change ce qu'on saisit
            ensuite, pas seulement la façon de l'afficher. */}
        <div
          role="radiogroup"
          aria-label="Mode de saisie"
          className="grid grid-cols-2 gap-1 rounded-lg bg-surface-soft p-1"
        >
          {(
            [
              ["LISSE", "Lissé", "Un prix moyen pour tout le lot"],
              ["DETAILLE", "Détaillé", "Un prix par pièce"],
            ] as const
          ).map(([v, titre, aide]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={mode === v}
              onClick={() => setMode(v)}
              className={`min-h-[44px] rounded-md px-3 py-1.5 text-left transition-colors ${
                mode === v
                  ? "bg-surface shadow-card"
                  : "text-ink-muted hover:bg-surface/60"
              }`}
            >
              <span className="block text-body-md font-semibold">{titre}</span>
              <span className="block text-label-sm text-ink-faint">{aide}</span>
            </button>
          ))}
        </div>

        <div>
          <label className={label}>Fournisseur</label>
          <input
            required
            value={fournisseur}
            onChange={(e) => setFournisseur(e.target.value)}
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Grade</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="(optionnel)"
              className={field}
            />
          </div>
        </div>

        {mode === "LISSE" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Coût total (€)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={coutTotal}
                  onChange={(e) => setCoutTotal(e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Nombre d&apos;articles</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={nbArticles}
                  onChange={(e) => setNbArticles(e.target.value)}
                  className={field}
                />
              </div>
            </div>

            <div className="rounded-md border border-line bg-surface-soft px-3 py-2.5 text-body-md">
              <span className="text-ink-muted">Prix unitaire calculé : </span>
              <span className="font-semibold text-primary">
                {puLisse != null ? euros(puLisse) : "—"}
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={label}>Frais de livraison (€)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={fraisLivraison}
                onChange={(e) => setFraisLivraison(e.target.value)}
                placeholder="0"
                aria-describedby="aide-frais"
                className={field}
              />
              <p id="aide-frais" className="mt-1 text-label-sm text-ink-faint">
                Répartis au prorata du prix de chaque pièce, pas à parts égales.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className={label}>Pièces du lot</legend>

              {lignes.map((l, i) => (
                <div
                  key={l.id}
                  className="grid grid-cols-2 gap-2 rounded-md border border-line p-2 md:grid-cols-[1fr_1fr_76px_104px_44px] md:items-center md:border-0 md:p-0"
                >
                  <input
                    aria-label={`Marque, pièce ${i + 1}`}
                    value={l.marque}
                    onChange={(e) =>
                      setLignes((ls) =>
                        ls.map((x) =>
                          x.id === l.id ? { ...x, marque: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Marque"
                    className={field}
                  />
                  <input
                    aria-label={`Catégorie, pièce ${i + 1}`}
                    value={l.categorie}
                    onChange={(e) =>
                      setLignes((ls) =>
                        ls.map((x) =>
                          x.id === l.id
                            ? { ...x, categorie: e.target.value }
                            : x,
                        ),
                      )
                    }
                    placeholder="Catégorie"
                    className={field}
                  />
                  <input
                    aria-label={`Préfixe SKU, pièce ${i + 1}`}
                    value={l.prefixe}
                    onChange={(e) =>
                      setLignes((ls) =>
                        ls.map((x) =>
                          x.id === l.id
                            ? {
                                ...x,
                                prefixe: normaliserPrefixe(e.target.value),
                              }
                            : x,
                        ),
                      )
                    }
                    // Le placeholder porte la suggestion propre à CETTE pièce :
                    // un lot mixte n'a pas de préfixe unique.
                    placeholder={prefixeDeLigne({ ...l, prefixe: "" })}
                    className={`${field} text-center font-mono`}
                  />
                  {/* Sur mobile, prix et corbeille partagent une cellule pour
                      tenir la ligne en deux rangées. `md:contents` dissout le
                      conteneur en desktop : la grille à 5 colonnes reprend. */}
                  <div className="flex items-center gap-2 md:contents">
                    <input
                      aria-label={`Prix d'achat, pièce ${i + 1}`}
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={l.prix}
                      onChange={(e) =>
                        setLignes((ls) =>
                          ls.map((x) =>
                            x.id === l.id ? { ...x, prix: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="Prix €"
                      className={`${field} min-w-0 flex-1 text-right font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLignes((ls) =>
                          ls.length > 1 ? ls.filter((x) => x.id !== l.id) : ls,
                        )
                      }
                      disabled={lignes.length === 1}
                      aria-label={`Supprimer la pièce ${i + 1}`}
                      className="flex h-11 w-11 flex-none items-center justify-center justify-self-end rounded-md text-ink-faint transition-colors hover:bg-surface-container hover:text-error disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setLignes((ls) => [
                    ...ls,
                    nouvelleLigne(
                      ls[ls.length - 1]?.marque ?? marque,
                      ls[ls.length - 1]?.categorie ?? categorie,
                      // Un préfixe saisi à la main vaut pour les pièces
                      // suivantes du même type : on ne le retape pas.
                      ls[ls.length - 1]?.prefixe ?? "",
                    ),
                  ])
                }
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line text-body-md font-medium text-ink-muted transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Ajouter une pièce
              </button>
            </fieldset>

            {/* Récapitulatif : le garde-fou de saisie. Le coût total n'est pas
                un champ, il découle des lignes — impossible de le contredire. */}
            <div className="rounded-md border border-line bg-surface-soft px-3 py-2.5 text-body-md">
              {apercu ? (
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">
                      {apercu.nb} pièce{apercu.nb > 1 ? "s" : ""}
                    </dt>
                    <dd className="font-mono">{euros(apercu.sommeArticles)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Frais de livraison</dt>
                    <dd className="font-mono">{euros(apercu.frais)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1 font-semibold">
                    <dt>Coût total du lot</dt>
                    <dd className="font-mono text-primary">
                      {euros(apercu.total)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">P.U. moyen</dt>
                    <dd className="font-mono text-ink-faint">
                      {euros(apercu.moyen)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <span className="text-ink-faint">
                  Renseigne les prix pour voir le total.
                </span>
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>
              Marque{mode === "DETAILLE" ? " du lot" : ""}
            </label>
            <select
              value={marque}
              onChange={(e) => setMarque(e.target.value)}
              className={field}
            >
              {MARQUES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>
              Catégorie{mode === "DETAILLE" ? " du lot" : ""}
            </label>
            <input
              required
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Objectif coef (x)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={coefObjectif}
              onChange={(e) => setCoefObjectif(e.target.value)}
              placeholder="2.5"
              className={field}
            />
          </div>
          {/* En détaillé, le préfixe se saisit par pièce : pas de champ de lot,
              qui n'aurait aucun effet. */}
          {mode === "LISSE" && (
            <div>
              <label className={label} htmlFor="prefixe-sku">
                Préfixe SKU
              </label>
              <input
                id="prefixe-sku"
                value={prefixe}
                onChange={(e) => setPrefixe(normaliserPrefixe(e.target.value))}
                placeholder={prefixeSuggere}
                aria-describedby="aide-prefixe"
                className={`${field} font-mono`}
              />
            </div>
          )}
        </div>

        <p id="aide-prefixe" className="text-label-sm text-ink-faint">
          {/* Pas d'exemple numéroté : les SKU ne repartent pas de 1, ils
              continuent la série. Annoncer « PRL1 » quand la base est à PRL256
              serait faux. */}
          {mode === "LISSE"
            ? `Préfixe ${prefixeLot} — les SKU continuent la série existante (${prefixeLot}1 si elle est vide).`
            : `Série${series.length > 1 ? "s" : ""} : ${series.join(", ")}. Un compteur par préfixe, modifiable pièce par pièce.`}
        </p>

        {create.isError && (
          <p role="alert" className="text-body-md text-error">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-full border border-line px-5 text-body-md font-medium text-ink-muted transition-colors hover:bg-surface-container"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={create.isPending || !prêt}
            className="min-h-[44px] rounded-full bg-primary px-5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {create.isPending ? "Création…" : "Créer la commande"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
