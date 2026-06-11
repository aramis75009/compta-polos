"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useCreateCommande } from "@/lib/hooks";
import { euros, prixUnitaire, skuPrefix } from "@/lib/calc";

const MARQUES = ["Polo Ralph Lauren", "Lacoste", "Tommy Hilfiger"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewCommandeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateCommande();
  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(todayISO());
  const [coutTotal, setCoutTotal] = useState("");
  const [nbArticles, setNbArticles] = useState("");
  const [marque, setMarque] = useState(MARQUES[0]);
  const [categorie, setCategorie] = useState("Polo");
  const [grade, setGrade] = useState("");
  const [coefObjectif, setCoefObjectif] = useState("2.5");

  const cout = Number(coutTotal);
  const nb = Number(nbArticles);
  const pu =
    Number.isFinite(cout) && Number.isInteger(nb) && nb > 0
      ? prixUnitaire(cout, nb)
      : null;

  const reset = () => {
    setFournisseur("");
    setDate(todayISO());
    setCoutTotal("");
    setNbArticles("");
    setMarque(MARQUES[0]);
    setCategorie("Polo");
    setGrade("");
    setCoefObjectif("2.5");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const coefObj = Number(coefObjectif);
    await create.mutateAsync({
      fournisseur: fournisseur.trim(),
      date: new Date(date).toISOString(),
      coutTotal: cout,
      nbArticles: nb,
      marque,
      categorie: categorie.trim(),
      grade: grade.trim() || null,
      coefObjectif: Number.isFinite(coefObj) && coefObj > 0 ? coefObj : null,
    });
    reset();
    onClose();
  };

  const field =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle commande">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-label-sm text-ink-muted">Fournisseur</label>
          <input
            required
            value={fournisseur}
            onChange={(e) => setFournisseur(e.target.value)}
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-label-sm text-ink-muted">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-label-sm text-ink-muted">Grade</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="(optionnel)"
              className={field}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-label-sm text-ink-muted">
              Coût total (€)
            </label>
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
            <label className="mb-1.5 block text-label-sm text-ink-muted">
              Nombre d&apos;articles
            </label>
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
            {pu != null ? euros(pu) : "—"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-label-sm text-ink-muted">Marque</label>
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
            <label className="mb-1.5 block text-label-sm text-ink-muted">Catégorie</label>
            <input
              required
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-label-sm text-ink-muted">
            Objectif coef (x)
          </label>
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

        <p className="text-label-sm text-ink-faint">
          SKUs générés : {skuPrefix(marque)}-001, {skuPrefix(marque)}-002…
        </p>

        {create.isError && (
          <p className="text-body-md text-error">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2 text-body-md font-medium text-ink-muted transition-colors hover:bg-surface-container"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-full bg-primary px-5 py-2 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {create.isPending ? "Création…" : "Créer la commande"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
