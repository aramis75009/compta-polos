"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import { useImportCommande, type ImportResult } from "@/lib/hooks";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ImportExcelModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const importer = useImportCommande();
  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(todayISO());
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFournisseur("");
    setDate(todayISO());
    setFile(null);
    setResult(null);
    importer.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) return;
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("fournisseur", fournisseur.trim());
    form.append("date", new Date(date).toISOString());
    form.append("fichier", file);
    const res = await importer.mutateAsync(form);
    setResult(res);
  };

  const field =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <Modal open={open} onClose={close} title="Importer un Excel">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-body-md text-ink">
            ✓ {result.nbImportes} articles importés
            {result.categories.length > 0 && (
              <>
                {" "}
                ({result.categories.length} catégorie
                {result.categories.length > 1 ? "s" : ""} :{" "}
                {result.categories.join(", ")})
              </>
            )}
            {result.nbDoublons > 0 && (
              <div className="mt-1 text-label-sm text-ink-muted">
                {result.nbDoublons} doublon(s) rattaché(s).
              </div>
            )}
            {result.nbErreurs > 0 && (
              <div className="mt-1 text-label-sm text-error">
                {result.nbErreurs} ligne(s) en erreur.
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={close}
              className="rounded-full bg-primary px-5 py-2 text-body-md font-medium text-on-primary hover:bg-primary-dark"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-label-sm text-ink-muted">
              Fournisseur
            </label>
            <input
              required
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Grossiste KZ"
              className={field}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-label-sm text-ink-muted">
              Date de la commande
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </div>

          {/* Zone d'upload (drag & drop + clic) */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-line hover:border-line-strong"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-body-md font-medium text-ink">📄 {file.name}</p>
            ) : (
              <p className="text-body-md text-ink-faint">
                Glisse un fichier .xlsx ici, ou clique pour choisir
              </p>
            )}
          </div>

          {importer.isError && (
            <p className="text-body-md text-error">
              {(importer.error as Error).message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-line px-5 py-2 text-body-md font-medium text-ink-muted hover:bg-surface-container"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!file || importer.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-body-md font-medium text-on-primary hover:bg-primary-dark disabled:opacity-60"
            >
              {importer.isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
              )}
              {importer.isPending ? "Import en cours…" : "Importer"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
