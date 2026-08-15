"use client";

// Écran de configuration des dépendances externes : clés IA et accès Trello.
//
// Principe de l'écran : un secret ne se relit pas. On affiche son état (« ta
// clé », « clé de l'app », « aucune ») et ses 4 derniers caractères ; un champ
// laissé vide ne modifie rien. C'est ce qui permet d'enregistrer le board sans
// avoir à ressaisir la clé à chaque fois.

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { CardTitle, Module } from "@/components/console";
import {
  estModeleLibre,
  MODELE_PAR_DEFAUT,
  MODELES_PROPOSES,
} from "@/lib/modelesIA";
import { type CodeErreurTrello, messageErreur } from "@/lib/trelloErreurs";
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

/** Valeur du menu qui ouvre la saisie manuelle. Jamais enregistrée telle quelle. */
const AUTRE_MODELE = "__autre__";

/** Pastille d'origine de la valeur utilisée à l'exécution. */
function Origine({ source }: { source: SourceReglage }) {
  const libelle = {
    utilisateur: "Ta clé",
    app: "Tu utilises celle de MyFlip",
    absente: "Aucune clé : la génération échouera",
  }[source];
  const couleur = {
    utilisateur: "text-[var(--pos)]",
    app: "text-[var(--warn)]",
    absente: "text-[var(--faint)]",
  }[source];
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.12em] ${couleur}`}
    >
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
        <button
          type="button"
          onClick={onTest}
          className={`${boutonSecondaireCls} self-start`}
        >
          Tester
        </button>
      ) : null}
    </div>
  );
}

/**
 * Choix d'un identifiant Trello (board ou étiquette).
 *
 * Menu déroulant dès que la liste est disponible, champ de saisie sinon. Le
 * champ existe dans les deux cas : un réglage qu'on ne peut pas relire est un
 * réglage qu'on croit absent.
 */
function ChampChoix({
  id,
  titre,
  aide,
  valeur,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  titre: string;
  aide?: string;
  valeur: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[] | null;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls} htmlFor={id}>
        {titre}
      </label>
      {options ? (
        <select
          id={id}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">— choisir —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          {/* Valeur enregistrée absente de la liste (board d'un autre compte,
              étiquette supprimée) : on la garde plutôt que de l'effacer en
              silence au premier enregistrement. */}
          {valeur && !options.some((o) => o.id === valeur) ? (
            <option value={valeur}>Enregistré ({valeur.slice(-6)})</option>
          ) : null}
        </select>
      ) : (
        <input
          id={id}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} font-mono`}
        />
      )}
      {aide ? (
        <p className="text-[12px] leading-snug text-[var(--faint)]">{aide}</p>
      ) : null}
    </div>
  );
}

export default function Integrations() {
  const [dto, setDto] = useState<UserSettingsDTO | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Saisies en cours. Vides = « ne rien changer », jamais « effacer ».
  const [anthropic, setAnthropic] = useState("");
  const [openrouter, setOpenrouter] = useState("");

  // Modèle de rédaction. Deux états et non un : `choix` porte la valeur du menu
  // (un id, ou la sentinelle AUTRE), `libre` porte la saisie manuelle. Les
  // fondre en un seul champ ferait disparaître la saisie dès que le menu
  // reprend la main, et l'utilisateur perdrait ce qu'il vient de taper.
  const [choixModele, setChoixModele] = useState<string>(MODELE_PAR_DEFAUT);
  const [modeleLibre, setModeleLibre] = useState("");

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
    // Un modèle enregistré hors de la liste courte rouvre le champ libre :
    // sinon le menu affichait le défaut et donnait à croire que le choix
    // manuel avait été perdu.
    if (estModeleLibre(json.modeleIA)) {
      setChoixModele(AUTRE_MODELE);
      setModeleLibre(json.modeleIA ?? "");
    } else {
      setChoixModele(json.modeleIA ?? MODELE_PAR_DEFAUT);
      setModeleLibre("");
    }
    setBoardId(json.trello.boardId ?? "");
    setLabelId(json.trello.labelId ?? "");
    setComptaLabelId(json.trello.comptabiliseLabelId ?? "");
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Résultat de la tentative de connexion, transporté dans l'URL par
  // /api/trello/callback. Lu une fois puis retiré de la barre d'adresse :
  // recharger la page ne doit pas rejouer le message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("trello");
    if (!code) return;
    if (code === "ok") toast.success("Trello est connecté.");
    else toast.error(messageErreur(code as CodeErreurTrello));
    params.delete("trello");
    const reste = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (reste ? `?${reste}` : ""),
    );
  }, []);

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
      // `webhook` porte l'avertissement du branchement automatique : réglages
      // enregistrés, mais Trello pas joignable. Ce n'est pas un échec de
      // l'enregistrement, c'en est une conséquence à signaler.
      if (json.webhook) toast.warning(json.webhook);
      else toast.success("Réglages enregistrés.");
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
    const res = await fetch(
      `/api/user/settings/test?fournisseur=${fournisseur}`,
      {
        method: "POST",
      },
    );
    const json = await res.json();
    if (json.ok) toast.success(json.message);
    else toast.error(json.message ?? json.error ?? "Test échoué.");
  }

  /**
   * `silencieux` : au chargement automatique de la page, l'utilisateur n'a rien
   * demandé — lui annoncer « 4 boards accessibles » serait du bruit. Le toast
   * n'a de sens qu'après un clic explicite sur « Recharger mes boards ».
   */
  const chargerBoards = useCallback(async (silencieux = false) => {
    setEnCours(true);
    try {
      const res = await fetch("/api/user/settings/trello");
      const json = await res.json();
      if (!res.ok) {
        if (!silencieux) toast.error(json.error ?? "Trello n'a pas répondu.");
        return;
      }
      setBoards(json.boards);
      if (silencieux) return;
      if (json.boards.length === 0) toast.error(messageErreur("aucun-board"));
      else toast.success(`${json.boards.length} board(s) accessibles.`);
    } finally {
      setEnCours(false);
    }
  }, []);

  const chargerLabels = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/user/settings/trello?boardId=${id}`);
    const json = await res.json();
    if (res.ok) setLabels(json.labels);
  }, []);

  // Les étiquettes du board déjà enregistré sont chargées au montage. Sans
  // cela, il fallait repasser par « lister mes boards » à chaque visite pour
  // seulement RELIRE son réglage : les deux champs de comptabilité étaient
  // invisibles au rechargement de la page.
  const boardCharge = useRef<string | null>(null);
  useEffect(() => {
    const id = dto?.trello.boardId;
    if (!id || boardCharge.current === id) return;
    boardCharge.current = id;
    chargerLabels(id);
  }, [dto?.trello.boardId, chargerLabels]);

  // Les boards se chargent seuls dès qu'on est connecté. Avant la connexion
  // Trello, il fallait cliquer pour valider les clés saisies ; il n'y a plus de
  // clé à valider, donc plus de raison d'exiger un clic pour voir sa liste.
  const boardsCharges = useRef(false);
  useEffect(() => {
    if (!dto?.trello.connecte || boardsCharges.current) return;
    boardsCharges.current = true;
    chargerBoards(true);
  }, [dto?.trello.connecte, chargerBoards]);

  async function deconnecter() {
    if (
      !window.confirm(
        "Déconnecter Trello ? MyFlip ne recevra plus rien de ton tableau, et l'autorisation sera révoquée chez Trello.",
      )
    )
      return;
    setEnCours(true);
    try {
      const res = await fetch("/api/trello/disconnect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Déconnexion impossible.");
        return;
      }
      toast.success("Trello déconnecté.");
      setBoards(null);
      setLabels(null);
      setBoardId("");
      setLabelId("");
      setComptaLabelId("");
      boardsCharges.current = false;
      boardCharge.current = null;
      await charger();
    } finally {
      setEnCours(false);
    }
  }

  if (!dto) return null;

  // Une étiquette Trello peut n'avoir aucun nom : seule sa couleur la
  // distingue alors, et c'est ce qu'on affiche à la place.
  const optionsEtiquettes =
    labels?.map((l) => ({
      id: l.id,
      name: l.name || `(sans nom · ${l.color ?? "couleur inconnue"})`,
    })) ?? null;

  const secretsIA = [
    {
      cle: "openrouterKey",
      titre: "Clé OpenRouter",
      valeur: openrouter,
      set: setOpenrouter,
      etat: dto.openrouter,
      source: dto.source.openrouter,
      test: "openrouter",
      aide: "Elle rédige tes annonces à partir des photos, quel que soit le modèle choisi ci-dessous. Où la trouver : openrouter.ai/keys.",
    },
    {
      cle: "anthropicKey",
      titre: "Clé Anthropic",
      valeur: anthropic,
      set: setAnthropic,
      etat: dto.anthropic,
      source: dto.source.anthropic,
      test: "anthropic",
      aide: "Elle fait tourner l'assistant, la bulle en bas à droite. Où la trouver : console.anthropic.com, section API keys.",
    },
  ] as const;

  return (
    <section className="mt-[14px] grid grid-cols-1 gap-[14px] min-[900px]:grid-cols-2">
      {/* Clés IA */}
      <Module className="p-[24px]">
        <div className="mb-[14px] flex items-center gap-2.5">
          <KeyRound
            className="h-[18px] w-[18px] text-[var(--acc)]"
            strokeWidth={2}
          />
          <CardTitle>Mes clés IA</CardTitle>
        </div>

        {!dto.chiffrementDisponible && (
          <p role="alert" className="mb-3 text-[12.5px] text-[var(--neg)]">
            Le chiffrement n&apos;est pas configuré sur ce déploiement
            (ENCRYPTION_KEY) : aucun secret ne peut être enregistré.
          </p>
        )}

        <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--faint)]">
          Tant que tu ne mets pas ta clé, tes annonces sont générées avec celle
          de MyFlip, et donc sur son quota. Une fois enregistrée, ta clé est
          chiffrée et ne peut plus être réaffichée — seuls ses quatre derniers
          caractères restent visibles.
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
              if (anthropic.trim()) patch.anthropicKey = anthropic.trim();
              if (openrouter.trim()) patch.openrouterKey = openrouter.trim();
              if (Object.keys(patch).length === 0) {
                toast.error("Aucune clé saisie.");
                return;
              }
              if (await enregistrer(patch)) {
                setAnthropic("");
                setOpenrouter("");
              }
            }}
            className={boutonCls}
          >
            Enregistrer mes clés
          </button>

          <div className="h-px bg-[var(--border)]" />

          {/* ── Modèle de rédaction ─────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls} htmlFor="modele-ia">
              Modèle qui rédige les annonces
            </label>
            <select
              id="modele-ia"
              value={choixModele}
              onChange={(e) => setChoixModele(e.target.value)}
              className={inputCls}
            >
              {MODELES_PROPOSES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.libelle} — {m.prix} $/M
                  {m.id === MODELE_PAR_DEFAUT ? " (par défaut)" : ""}
                </option>
              ))}
              <option value={AUTRE_MODELE}>Autre…</option>
            </select>

            <p className="text-[12px] leading-snug text-[var(--faint)]">
              {choixModele === AUTRE_MODELE
                ? "Identifiant OpenRouter exact, par exemple mistralai/mistral-medium-3.1. Il doit savoir lire des images et rendre du JSON structuré, sinon chaque génération échouera."
                : (MODELES_PROPOSES.find((m) => m.id === choixModele)?.note ??
                  "")}
            </p>

            {choixModele === AUTRE_MODELE && (
              <input
                value={modeleLibre}
                onChange={(e) => setModeleLibre(e.target.value)}
                placeholder="fournisseur/modele"
                autoComplete="off"
                spellCheck={false}
                className={inputCls}
              />
            )}

            <button
              type="button"
              disabled={enCours}
              onClick={() => {
                const id =
                  choixModele === AUTRE_MODELE
                    ? modeleLibre.trim()
                    : choixModele;
                if (!id) {
                  toast.error("Saisis un identifiant de modèle.");
                  return;
                }
                enregistrer({ modeleIA: id });
              }}
              className={`${boutonSecondaireCls} self-start`}
            >
              Enregistrer le modèle
            </button>
          </div>
        </div>
      </Module>

      {/* Trello */}
      <Module className="p-[24px]">
        <div className="mb-[14px] flex items-center gap-2.5">
          <SquareKanban
            className="h-[18px] w-[18px] text-[var(--acc)]"
            strokeWidth={2}
          />
          <CardTitle>Mon Trello</CardTitle>
        </div>

        {!dto.trello.connecte ? (
          <>
            <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--faint)]">
              Trello n&apos;est pas connecté. Une fois branché, poser
              l&apos;étiquette « À comptabiliser » sur une carte fait basculer
              les articles dont le SKU figure dans son titre — c&apos;est ce qui
              alimente ta page À comptabiliser.
            </p>
            <a href="/api/trello/connect" className={boutonCls}>
              Connecter Trello
            </a>
            <p className="mt-3 text-[12px] leading-snug text-[var(--faint)]">
              Tu seras redirigé vers Trello pour autoriser MyFlip à lire tes
              tableaux et à modifier tes cartes. Aucune clé à recopier.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-[var(--surface-2)] px-3.5 py-3">
              <span className="text-[13px] text-[var(--ink2)]">
                Trello connecté
                {dto.trello.membreNom ? ` — ${dto.trello.membreNom}` : ""}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                {dto.trello.source === "heritee"
                  ? "Connexion par clés API"
                  : "Connexion Trello"}
              </span>
            </div>

            {dto.trello.source === "heritee" && (
              <div className="rounded-[16px] border border-[var(--border)] p-3.5">
                <p className="mb-2.5 text-[12.5px] leading-snug text-[var(--faint)]">
                  Cette connexion utilise une clé d&apos;API saisie à la main.
                  Elle continue de fonctionner ; la connexion Trello, elle, se
                  révoque d&apos;un clic et ne dépend d&apos;aucune clé à
                  recopier.
                </p>
                <a href="/api/trello/connect" className={boutonSecondaireCls}>
                  Passer à la connexion Trello
                </a>
              </div>
            )}

            {!dto.trello.webhookActif && dto.trello.boardId && (
              <p
                role="alert"
                className="text-[12.5px] leading-snug text-[var(--warn)]"
              >
                Aucun webhook enregistré : rien ne remonte de Trello pour
                l&apos;instant. Réenregistre ton board pour le rebrancher.
              </p>
            )}

            {/* Ces trois champs sont rendus en permanence, jamais sous
                condition. Ils ne l'étaient qu'une fois la liste des boards
                chargée : au rechargement de la page, les deux étiquettes de
                comptabilité disparaissaient, et on ne pouvait plus relire son
                propre réglage. Sans liste disponible, on retombe sur la saisie
                de l'identifiant — moins agréable, mais jamais invisible. */}
            <ChampChoix
              id="board"
              titre="Board surveillé"
              valeur={boardId}
              onChange={(v) => {
                setBoardId(v);
                setLabels(null);
                chargerLabels(v);
              }}
              options={boards}
              placeholder="Identifiant du board"
              aide={
                boards
                  ? "Le tableau que MyFlip surveille."
                  : "Clique sur « Recharger mes boards » pour choisir dans une liste."
              }
            />

            <ChampChoix
              id="label-compta"
              titre="Étiquette « À comptabiliser »"
              valeur={labelId}
              onChange={setLabelId}
              options={optionsEtiquettes}
              placeholder="Identifiant de l'étiquette"
              aide="Quand tu la poses sur une carte, les articles dont le SKU figure dans le titre passent en « À comptabiliser »."
            />

            <ChampChoix
              id="label-comptabilise"
              titre="Étiquette « Comptabilisé »"
              valeur={comptaLabelId}
              onChange={setComptaLabelId}
              options={optionsEtiquettes}
              placeholder="Identifiant de l'étiquette"
              aide="MyFlip la pose lui-même sur la carte quand tu valides la vente."
            />

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
                Enregistrer
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() => chargerBoards()}
                className={boutonSecondaireCls}
              >
                Recharger mes boards
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={deconnecter}
                className={`${boutonSecondaireCls} text-[var(--neg)]`}
              >
                Déconnecter Trello
              </button>
            </div>
          </div>
        )}
      </Module>
    </section>
  );
}
