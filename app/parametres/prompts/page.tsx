"use client";

import { useState } from "react";
import { Plus, Check, SquarePen, Trash2 } from "lucide-react";
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
  "w-full rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 text-[14px] text-[#16261D] outline-none transition-colors focus:border-[#CBD8CE]";

const TOUTES = "Toutes";

const MARQUES_LIST = [
  "Nike",
  "Adidas",
  "Puma",
  "Lacoste",
  "Lacoste Sport",
  "Reebok",
  "Under Armour",
  "Fila",
  "Le Coq Sportif",
  "Champion",
  "Columbia",
  "Hurley",
  "Ralph Lauren",
  "Tommy Hilfiger",
  "Levi's",
];

const CATEGORIES_LIST = [
  "Short",
  "Polo",
  "Pull",
  "Chemise",
  "Veste",
  "Sweat",
  "Jogging",
  "Jean",
  "Bermuda",
];

// Couleur du badge marque (alignée sur le redesign).
function brandBadge(marque: string | null): { bg: string; text: string } {
  const m = (marque ?? "").toLowerCase();
  if (m.includes("tommy")) return { bg: "#E2F7F8", text: "#0892A0" };
  if (m.includes("lacoste")) return { bg: "#ECEEF0", text: "#2B3942" };
  if (m.includes("adidas")) return { bg: "#FBEEE7", text: "#B5613B" };
  // Polo Ralph Lauren + défaut → vert marque
  return { bg: "#EAF3ED", text: "#1B4332" };
}

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
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
            Paramètres
          </h1>
          <p className="mt-1.5 text-[14.5px] font-medium text-[#71807A]">
            Tes modèles de prompts pour la génération d’annonces.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#1B4332] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.3} />
          Nouveau prompt
        </button>
      </header>

      {/* Compte */}
      <div className="mb-[26px] grid grid-cols-1 gap-[18px] md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex items-center gap-3.5 rounded-[18px] border border-[#E4E9E2] bg-white px-[22px] py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[18px] font-bold text-[#CFE6D8]">
            A
          </div>
          <div>
            <div className="text-[15.5px] font-bold text-[#16261D]">Aramis</div>
            <div className="text-[13px] font-medium text-[#8A998F]">
              aramis.begnene@gmail.com
            </div>
          </div>
        </div>
        <div className="rounded-[18px] border border-[#E4E9E2] bg-white px-[22px] py-5">
          <div className="text-[12px] font-semibold text-[#8A998F]">Modèle IA</div>
          <div className="mt-1 font-grotesk text-[24px] font-bold tracking-[-0.02em]">
            Gemini Flash
          </div>
        </div>
        <div className="rounded-[18px] border border-[#E4E9E2] bg-white px-[22px] py-5">
          <div className="text-[12px] font-semibold text-[#8A998F]">Modèles</div>
          <div className="mt-1 font-grotesk text-[24px] font-bold tracking-[-0.02em]">
            {prompts.length} prompt{prompts.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <h2 className="mx-0.5 mb-4 font-grotesk text-[19px] font-bold text-[#16261D]">
        Modèles de prompts
      </h2>

      {isLoading ? (
        <p className="text-[14px] text-[#8A998F]">Chargement…</p>
      ) : prompts.length === 0 ? (
        <p className="rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-12 text-center text-[#8A998F]">
          Aucun prompt.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          {prompts.map((p) => {
            const badge = brandBadge(p.marque);
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3.5 rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-5 transition-all hover:border-[#CBD8CE] hover:shadow-[0_14px_30px_-22px_rgba(20,53,40,.5)]"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="rounded-full px-2.5 py-1 text-[12px] font-bold"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {p.marque ?? "Toutes marques"}
                    </span>
                    <span className="text-[12px] font-semibold text-[#94A29A]">
                      {p.categorie ?? "Toutes catégories"}
                    </span>
                  </div>
                  {p.estDefaut && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F3EA] px-2.5 py-1 text-[11.5px] font-bold text-[#2D6A4F]">
                      <Check className="h-3 w-3" strokeWidth={2.6} />
                      Par défaut
                    </span>
                  )}
                </div>

                <div className="text-[15.5px] font-bold tracking-[-0.01em] text-[#16261D]">
                  {p.nom}
                </div>
                <p className="line-clamp-3 text-[13.5px] font-medium leading-[1.55] text-[#71807A]">
                  {p.contenu}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-[#EEF1EC] pt-3.5">
                  <span className="text-[12px] font-semibold text-[#94A29A]">
                    Modifié le {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F2F5F0] px-3 py-2 text-[12.5px] font-semibold text-[#3C4D44] transition-colors hover:bg-[#E7EDE5]"
                    >
                      <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le prompt « ${p.nom} » ?`))
                          del.mutate(p.id);
                      }}
                      aria-label="Supprimer"
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#F2F5F0] text-[#94A29A] transition-colors hover:bg-[#FBEEE7] hover:text-[#B5613B]"
                    >
                      <Trash2 className="h-[15px] w-[15px]" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={editId ? "Modifier le prompt" : "Nouveau prompt"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#71807A]">
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
              <label className="mb-1 block text-[12px] font-semibold text-[#71807A]">
                Marque
              </label>
              <input
                value={form.marque}
                onChange={(e) => setForm({ ...form, marque: e.target.value })}
                list="marques-list"
                placeholder="Ex : Lacoste"
                className={inputCls}
              />
              <datalist id="marques-list">
                {MARQUES_LIST.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#71807A]">
                Catégorie
              </label>
              <input
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                list="categories-list"
                placeholder="Ex : Short"
                className={inputCls}
              />
              <datalist id="categories-list">
                {CATEGORIES_LIST.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#71807A]">
              Contenu du prompt
            </label>
            <p className="mb-2 rounded-lg bg-[#F7F9F6] px-3 py-2 text-[12px] text-[#71807A]">
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
              className={`${inputCls} resize-y font-mono text-[13px]`}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#16261D]">
            <input
              type="checkbox"
              checked={form.estDefaut}
              onChange={(e) => setForm({ ...form, estDefaut: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-[#1B4332]"
            />
            Définir comme prompt par défaut
          </label>

          {error && <p className="text-[13px] text-[#C2603F]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-full border border-[#E4E9E2] bg-white px-4 py-2 text-[13px] font-semibold text-[#71807A] transition-colors hover:bg-[#F1F4EF] disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-full bg-[#1B4332] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#143528] disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
