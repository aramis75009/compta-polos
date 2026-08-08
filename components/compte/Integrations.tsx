"use client";

// Écran de configuration des dépendances externes : clés IA et accès Trello.
//
// Principe de l'écran : un secret ne se relit pas. On affiche son état (« ta
// clé », « clé de l'app », « aucune ») et ses 4 derniers caractères ; un champ
// laissé vide ne modifie rien. C'est ce qui permet d'enregistrer le board sans
// avoir à ressaisir la clé à chaque fois.

import { useCallback, useEffect, useState } from "react";
import { KeyRound, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { CardTitle, Module } from "@/components/console";
import type {
  SecretEtat,
  SourceReglage,
  TrelloBoardDTO,
  TrelloLabelDTO,
  UserSettingsDTO,
} from "@/lib/types";

const labelCls =
  "font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]";
const inputCls =
  "min-h-[46px] w-full rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] px-4 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--faint-2)] focus:border-[var(--acc)]";
const boutonCls =
  "inline-flex min-h-[46px] items-center justify-center rounded-[16px] bg-[var(--acc)] px-5 text-[13.5px] font-semibold text-[var(--acc-ink)] transition-colors hover:bg-[var(--acc-hover)] disabled:opacity-60";
const boutonSecondaireCls =
  "inline-flex min-h-[46px] items-center justify-center rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] px-5 text-[13.5px] text-[var(--ink2)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-60";

/** Pastille d'origine de la valeur utilisée à l'exécution. */
function Origine({ source }: { source: SourceReglage }) {
  const libelle = {
    utilisateur: "Ta clé",
    app: "Clé de l'application",
    absente: "Aucune clé",
  }[source];
  const couleur = {
    utilisateur: "text-[var(--pos)]",
    app: "text-[var(--warn)]",
    absente: "text-[var(--faint)]",
  }[source];
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${couleur}`}>
      {libelle}
    </span>
  );
}

function ChampSecret({
  titre,
  aide,
  etat,
  source,
  valeur,
  onChange,
  onTest,
  testable = true,
}: {
  titre: string;
  aide: string;
  etat: SecretEtat;
  source?: SourceReglage;
  valeur: string;
  onChange: (v: string) => void;
  onTest?: () => void;
  testable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={labelCls}>{titre}</label>
        {source ? <Origine source={source} /> : null}
      </div>
      <input
        type="password"
        autoComplete="off"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          etat.renseigne
            ? `${etat.apercu} — laisser vide pour ne pas changer`
            : "Coller la clé"
        }
        className={inputCls}
      />
      <p className="text-[12px] leading-snug text-[var(--faint)]">{aide}</p>
      {testable && onTest ? (
        <button type="button" onClick={onTest} className={`${boutonSecondaireCls} self-start`}>
          Tester
        </button>
      ) : null}
    </div>
  );
}

export default function Integrations() {
  const [dto, setDto] = useState<UserSettingsDTO | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Saisies en cours. Vides = « ne rien changer », jamais « effacer ».
  const [gemini, setGemini] = useState("");
  const [anthropic, setAnthropic] = useState("");
  const [openrouter, setOpenrouter] = useState("");
  const [trelloKey, setTrelloKey] = useState("");
  const [trelloToken, setTrelloToken] = useState("");
  const [trelloSecret, setTrelloSecret] = useState("");

  const [boards, setBoards] = useState<TrelloBoardDTO[] | null>(null);
  const [labels, setLabels] = useState<TrelloLabelDTO[] | null>(null);
  const [boardId, setBoardId] = useState("");
  const [labelId, setLabelId] = useState("");
  const [comptaLabelId, setComptaLabelId] = useState("");

  const charger = useCallback(async () => {
    const res = await fetch("/api/user/settings");
    if (!res.ok) return;
    const json = (await res.json()) as UserSettingsDTO;
    setDto(json);
    setBoardId(json.trelloBoardId ?? "");
    setLabelId(json.trelloLabelId ?? "");
    setComptaLabelId(json.trelloComptabiliseLabelId ?? "");
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  /** N'envoie que les champs réellement saisis : le reste est laissé tel quel. */
  async function enregistrer(patch: Record<string, string | null>) {
    setEnCours(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Enregistrement impossible.");
        return false;
      }
      toast.success("Réglages enregistrés.");
      await charger();
      return true;
    } catch {
      toast.error("Impossible de contacter le serveur.");
      return false;
    } finally {
      setEnCours(false);
    }
  }

  async function tester(fournisseur: string) {
    const res = await fetch(`/api/user/settings/test?fournisseur=${fournisseur}`, {
      method: "POST",
    });
    const json = await res.json();
    if (json.ok) toast.success(json.message);
    else toast.error(json.message ?? json.error ?? "Test échoué.");
  }

  async function chargerBoards() {
    setEnCours(true);
    try {
      const res = await fetch("/api/user/settings/trello");
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Trello n'a pas répondu.");
        return;
      }
      setBoards(json.boards);
      toast.success(`${json.boards.length} board(s) accessibles.`);
    } finally {
      setEnCours(false);
    }
  }

  const chargerLabels = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/user/settings/trello?boardId=${id}`);
    const json = await res.json();
    if (res.ok) setLabels(json.labels);
  }, []);

  async function connecterWebhook() {
    setEnCours(true);
    try {
      const res = await fetch("/api/user/settings/trello", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Connexion impossible.");
        return;
      }
      toast.success(
        json.deja ? "Ce board était déjà connecté." : "Trello connecté.",
      );
    } finally {
      setEnCours(false);
    }
  }

  if (!dto) return null;

  const secretsIA = [
    { cle: "geminiKey", titre: "Clé Gemini", valeur: gemini, set: setGemini, etat: dto.gemini, source: dto.source.gemini, test: "gemini", aide: "Génération des annonces. À créer sur aistudio.google.com/apikey." },
    { cle: "anthropicKey", titre: "Clé Anthropic", valeur: anthropic, set: setAnthropic, etat: dto.anthropic, source: dto.source.anthropic, test: "anthropic", aide: "Assistant de l'application. À créer sur console.anthropic.com." },
    { cle: "openrouterKey", titre: "Clé OpenRouter", valeur: openrouter, set: setOpenrouter, etat: dto.openrouter, source: dto.source.openrouter, test: "openrouter", aide: "Facultative : ouvre le choix d'autres modèles pour les annonces." },
  ] as const;

  return (
    <section className="mt-[14px] grid grid-cols-1 gap-[14px] min-[900px]:grid-cols-2">
      {/* Clés IA */}
      <Module className="p-[24px]">
        <div className="mb-[14px] flex items-center gap-2.5">
          <KeyRound className="h-[18px] w-[18px] text-[var(--acc)]" strokeWidth={2} />
          <CardTitle>Mes clés IA</CardTitle>
        </div>

        {!dto.chiffrementDisponible && (
          <p role="alert" className="mb-3 text-[12.5px] text-[var(--neg)]">
            Le chiffrement n&apos;est pas configuré sur ce déploiement
            (ENCRYPTION_KEY) : aucun secret ne peut être enregistré.
          </p>
        )}

        <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--faint)]">
          Sans clé de ta part, l&apos;application utilise la sienne. Tes clés sont
          chiffrées et ne sont jamais réaffichées.
        </p>

        <div className="flex flex-col gap-4">
          {secretsIA.map((c) => (
            <ChampSecret
              key={c.cle}
              titre={c.titre}
              aide={c.aide}
              etat={c.etat}
              source={c.source}
              valeur={c.valeur}
              onChange={c.set}
              onTest={() => tester(c.test)}
            />
          ))}

          <button
            type="button"
            disabled={enCours || !dto.chiffrementDisponible}
            onClick={async () => {
              const patch: Record<string, string> = {};
              if (gemini.trim()) patch.geminiKey = gemini.trim();
              if (anthropic.trim()) patch.anthropicKey = anthropic.trim();
              if (openrouter.trim()) patch.openrouterKey = openrouter.trim();
              if (Object.keys(patch).length === 0) {
                toast.error("Aucune clé saisie.");
                return;
              }
              if (await enregistrer(patch)) {
                setGemini("");
                setAnthropic("");
                setOpenrouter("");
              }
            }}
            className={boutonCls}
          >
            Enregistrer mes clés
          </button>
        </div>
      </Module>

      {/* Trello */}
      <Module className="p-[24px]">
        <div className="mb-[14px] flex items-center gap-2.5">
          <SquareKanban className="h-[18px] w-[18px] text-[var(--acc)]" strokeWidth={2} />
          <CardTitle>Mon Trello</CardTitle>
        </div>

        <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--faint)]">
          Clé, token et secret se récupèrent sur trello.com/app-key. L&apos;étiquette
          « À comptabiliser » posée sur une carte fait basculer les articles dont
          le SKU figure dans son titre.
        </p>

        <div className="flex flex-col gap-4">
          <ChampSecret
            titre="Clé d'API"
            aide="Le champ « Key » de trello.com/app-key."
            etat={dto.trelloKey}
            source={dto.source.trello}
            valeur={trelloKey}
            onChange={setTrelloKey}
            testable={false}
          />
          <ChampSecret
            titre="Token"
            aide="Généré depuis le lien « Token » de la même page."
            etat={dto.trelloToken}
            valeur={trelloToken}
            onChange={setTrelloToken}
            testable={false}
          />
          <ChampSecret
            titre="Secret d'API"
            aide="Sert à vérifier que les appels reçus viennent bien de Trello. Sans lui, l'application accepte les événements sans les authentifier."
            etat={dto.trelloSecret}
            valeur={trelloSecret}
            onChange={setTrelloSecret}
            testable={false}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enCours || !dto.chiffrementDisponible}
              onClick={async () => {
                const patch: Record<string, string> = {};
                if (trelloKey.trim()) patch.trelloKey = trelloKey.trim();
                if (trelloToken.trim()) patch.trelloToken = trelloToken.trim();
                if (trelloSecret.trim()) patch.trelloSecret = trelloSecret.trim();
                if (Object.keys(patch).length === 0) {
                  toast.error("Aucun identifiant saisi.");
                  return;
                }
                if (await enregistrer(patch)) {
                  setTrelloKey("");
                  setTrelloToken("");
                  setTrelloSecret("");
                }
              }}
              className={boutonCls}
            >
              Enregistrer l&apos;accès
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={chargerBoards}
              className={boutonSecondaireCls}
            >
              Tester et lister mes boards
            </button>
          </div>

          {/* Le board et les étiquettes se choisissent dans des menus : aucun
              identifiant n'est recopié à la main. */}
          {(boards ?? (dto.trelloBoardId ? [] : null)) && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} htmlFor="board">
                Board
              </label>
              <select
                id="board"
                value={boardId}
                onChange={(e) => {
                  setBoardId(e.target.value);
                  setLabels(null);
                  chargerLabels(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">— choisir —</option>
                {(boards ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                {/* Board déjà enregistré mais liste non chargée : on garde
                    l'option courante pour ne pas l'effacer par inadvertance. */}
                {dto.trelloBoardId &&
                  !(boards ?? []).some((b) => b.id === dto.trelloBoardId) && (
                    <option value={dto.trelloBoardId}>
                      Board enregistré ({dto.trelloBoardId.slice(-6)})
                    </option>
                  )}
              </select>
            </div>
          )}

          {labels && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls} htmlFor="label-compta">
                  Étiquette « À comptabiliser »
                </label>
                <select
                  id="label-compta"
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— choisir —</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || `(sans nom, ${l.color ?? "?"})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls} htmlFor="label-comptabilise">
                  Étiquette « Comptabilisé »
                </label>
                <select
                  id="label-comptabilise"
                  value={comptaLabelId}
                  onChange={(e) => setComptaLabelId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— choisir —</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || `(sans nom, ${l.color ?? "?"})`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                enregistrer({
                  trelloBoardId: boardId || null,
                  trelloLabelId: labelId || null,
                  trelloComptabiliseLabelId: comptaLabelId || null,
                })
              }
              className={boutonCls}
            >
              Enregistrer le board
            </button>
            <button
              type="button"
              disabled={enCours || !dto.trelloBoardId}
              onClick={connecterWebhook}
              className={boutonSecondaireCls}
            >
              Connecter mon Trello
            </button>
          </div>
        </div>
      </Module>
    </section>
  );
}
