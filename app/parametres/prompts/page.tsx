"use client";

import { useState } from "react";
import {
  PromptInput,
  useCreatePrompt,
  useDeletePrompt,
  usePrompts,
  useUpdatePrompt,
} from "@/lib/hooks";
import type { PromptTemplateDTO } from "@/lib/types";
import Modal from "@/components/Modal";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const TOUTES = "Toutes";

type FormState = {
  nom: string;
  marque: string;
  categorie: string;
  contenu: string;
  estDefaut: boolean;
};

const emptyForm = (): FormState => ({
  nom: "",
  marque: TOUTES,
  categorie: TOUTES,
  contenu: "",
  estDefaut: false,
});

export default function PromptsPage() {
  const { data: prompts = [], isLoading } = usePrompts();
  const create = useCreatePrompt();
  const update = useUpdatePrompt();
  const del = useDeletePrompt();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);


  function openNew() {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(p: PromptTemplateDTO) {
    setEditId(p.id);
    setForm({
      nom: p.nom,
      marque: p.marque ?? TOUTES,
      categorie: p.categorie ?? TOUTES,
      contenu: p.contenu,
      estDefaut: p.estDefaut,
    });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    if (!form.nom.trim()) return setError("Le nom est requis.");
    if (!form.contenu.trim()) return setError("Le contenu est requis.");
    const input: PromptInput = {
      nom: form.nom.trim(),
      marque: form.marque === TOUTES ? null : form.marque,
      categorie: form.categorie === TOUTES ? null : form.categorie,
      contenu: form.contenu.trim(),
      estDefaut: form.estDefaut,
    };
    try {
      if (editId) await update.mutateAsync({ id: editId, input });
      else await create.mutateAsync(input);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-4xl">
            Prompts d&apos;annonce
          </h1>
          <p className="mt-1 text-sm text-ink-muted md:text-base">
            Personnalise les prompts utilisés pour générer les annonces.
          </p>
        </div>
        <button
          onClick={openNew}
          className="w-full rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark md:w-auto"
        >
          + Nouveau prompt
        </button>
      </header>

      {isLoading ? (
        <p className="text-body-md text-ink-faint">Chargement…</p>
      ) : prompts.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-ink-faint shadow-card">
          Aucun prompt.
        </p>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{p.nom}</span>
                  {p.estDefaut && (
                    <span className="inline-flex items-center rounded-full bg-mint/20 px-2.5 py-0.5 text-label-sm font-medium text-primary">
                      Par défaut
                    </span>
                  )}
                </div>
                <p className="mt-1 text-label-sm text-ink-faint">
                  Marque : {p.marque ?? "Toutes"} · Catégorie :{" "}
                  {p.categorie ?? "Toutes"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(p)}
                  className="rounded-full border border-line px-4 py-1.5 text-label-sm font-medium text-ink transition-colors hover:bg-surface-container"
                >
                  Modifier
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer le prompt « ${p.nom} » ?`))
                      del.mutate(p.id);
                  }}
                  className="rounded-full border border-error/30 bg-error/10 px-4 py-1.5 text-label-sm font-medium text-error transition-colors hover:bg-error/20"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={editId ? "Modifier le prompt" : "Nouveau prompt"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div>
            <label className="mb-1 block text-label-sm font-medium text-ink-muted">
              Nom
            </label>
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Ex : Polo Lacoste"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">
                Marque
              </label>
              <input
                value={form.marque}
                onChange={(e) => setForm({ ...form, marque: e.target.value })}
                placeholder="Ex : Lacoste"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-medium text-ink-muted">
                Catégorie
              </label>
              <input
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                placeholder="Ex : Short"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-label-sm font-medium text-ink-muted">
              Contenu du prompt
            </label>
            <p className="mb-2 rounded-md bg-surface-soft px-3 py-2 text-label-sm text-ink-faint">
              Placeholders disponibles : <code>{"{marque}"}</code>,{" "}
              <code>{"{categorie}"}</code>, <code>{"{taille}"}</code>,{" "}
              <code>{"{etat}"}</code>, <code>{"{matiere}"}</code>,{" "}
              <code>{"{sku}"}</code>. La réponse doit être un JSON avec les clés{" "}
              <code>titre</code>, <code>description</code>, <code>motsCles</code>.
            </p>
            <textarea
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              rows={10}
              placeholder="Rédige une annonce pour ce {marque} {categorie}…"
              className={`${inputCls} resize-y font-mono text-body-sm`}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-body-md text-ink">
            <input
              type="checkbox"
              checked={form.estDefaut}
              onChange={(e) => setForm({ ...form, estDefaut: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Définir comme prompt par défaut
          </label>

          {error && <p className="text-body-sm text-error">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-full bg-surface-soft px-4 py-2 text-label-sm font-medium text-ink-muted transition-colors hover:bg-line disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-full bg-primary px-5 py-2 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
