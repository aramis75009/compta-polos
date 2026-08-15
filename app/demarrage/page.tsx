"use client";

// Parcours de démarrage.
//
// Il remplace le message d'accueil, qui se contentait de dire « crée ta
// première commande » et disparaissait au premier clic. La vraie difficulté à
// l'arrivée n'est pas de créer une commande : c'est de brancher Trello, dont
// dépend toute l'entrée en comptabilité.
//
// L'avancement vit sur le compte, pas dans le navigateur : l'autorisation et la
// préparation du board passent par Trello, dans un autre onglet, souvent sur un
// autre appareil.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CardTitle, Frame, Module } from "@/components/console";
import Integrations from "@/components/compte/Integrations";
import type { UserSettingsDTO } from "@/lib/types";
import {
  COLONNES,
  ETIQUETTES_COMPTA,
  TRANSPORTEURS,
} from "@/lib/trelloConstantes";

// Trois étapes depuis le 15/08/2026. L'ancienne étape « Recevoir les
// événements » a disparu : le webhook s'enregistre tout seul à l'enregistrement
// du board. C'était une étape que l'utilisateur pouvait passer, et il se
// retrouvait alors entièrement configuré sans que rien ne remonte.
const ETAPES = [
  { n: 1, titre: "Connecter ton Trello", resume: "Autorisation et board" },
  { n: 2, titre: "Préparer le board", resume: "Colonnes et étiquettes" },
  { n: 3, titre: "Ta première commande", resume: "Et c'est parti" },
];

const boutonCls =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] bg-[var(--acc)] px-5 text-[13.5px] font-semibold text-[var(--acc-ink)] transition-colors hover:bg-[var(--acc-hover)] disabled:opacity-60";
const boutonSecondaireCls =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] px-5 text-[13.5px] text-[var(--ink2)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-60";

export default function DemarragePage() {
  const router = useRouter();
  const [dto, setDto] = useState<UserSettingsDTO | null>(null);
  const [etape, setEtape] = useState(1);
  const [enCours, setEnCours] = useState(false);
  const [rapport, setRapport] = useState<string[] | null>(null);

  const charger = useCallback(async () => {
    const res = await fetch("/api/user/settings");
    if (!res.ok) return;
    const json = (await res.json()) as UserSettingsDTO;
    setDto(json);
    // Écrêté : un compte resté à l'étape 4 de l'ancien parcours atterrirait
    // sur un écran qui n'existe plus.
    setEtape(Math.min(json.onboardingEtape, ETAPES.length));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const enregistrerEtape = async (n: number, termine = false) => {
    setEtape(n);
    await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingEtape: n, onboardingTermine: termine }),
    });
    await charger();
  };

  async function preparerBoard(transporteurs: boolean) {
    setEnCours(true);
    setRapport(null);
    try {
      const res = await fetch("/api/user/settings/trello/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transporteurs }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Préparation impossible.");
        return;
      }
      const lignes: string[] = [];
      if (json.colonnes.creees.length)
        lignes.push(`Colonnes créées : ${json.colonnes.creees.join(", ")}`);
      if (json.colonnes.existantes.length)
        lignes.push(
          `Colonnes déjà là : ${json.colonnes.existantes.join(", ")}`,
        );
      if (json.etiquettes.creees.length)
        lignes.push(`Étiquettes créées : ${json.etiquettes.creees.join(", ")}`);
      if (json.etiquettes.existantes.length)
        lignes.push(
          `Étiquettes déjà là : ${json.etiquettes.existantes.join(", ")}`,
        );
      setRapport(lignes);
      toast.success("Board préparé.");
      await charger();
    } finally {
      setEnCours(false);
    }
  }

  if (!dto) return null;

  const trelloPret = Boolean(dto.trello.connecte && dto.trello.boardId);
  const etiquettesPretes = Boolean(
    dto.trello.labelId && dto.trello.comptabiliseLabelId,
  );

  return (
    <Frame>
      <section className="flex flex-col gap-[14px]">
        {/* Fil des étapes. Cliquable : on revient sur une étape terminée pour
            vérifier, sans repasser par tout le parcours. */}
        <Module className="p-[18px]">
          <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
            {ETAPES.map((e, i) => {
              const faite = e.n < etape || dto.onboardingTermine;
              const active = e.n === etape && !dto.onboardingTermine;
              return (
                <li key={e.n} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEtape(e.n)}
                    className={`flex min-h-[44px] flex-1 items-center gap-2.5 rounded-[14px] px-3 text-left transition-colors ${
                      active
                        ? "bg-[var(--acc)] text-[var(--acc-ink)]"
                        : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full font-mono text-[11px] ${
                        active
                          ? "bg-[var(--acc-ink)]/15"
                          : faite
                            ? "bg-[var(--pos-soft)] text-[var(--pos)]"
                            : "bg-[var(--surface-2)] text-[var(--faint)]"
                      }`}
                    >
                      {faite ? <Check className="h-3.5 w-3.5" /> : e.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">
                        {e.titre}
                      </span>
                      <span
                        className={`block truncate text-[11px] ${active ? "opacity-70" : "text-[var(--faint)]"}`}
                      >
                        {e.resume}
                      </span>
                    </span>
                  </button>
                  {i < ETAPES.length - 1 && (
                    <ArrowRight className="hidden h-3.5 w-3.5 flex-none text-[var(--faint-2)] sm:block" />
                  )}
                </li>
              );
            })}
          </ol>
        </Module>

        {etape === 1 && (
          <>
            <Module className="p-[24px]">
              <CardTitle className="mb-2">Connecter ton Trello</CardTitle>
              <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
                MyFlip lit ton tableau Trello pour savoir quand un article part
                en comptabilité. Un clic, tu autorises MyFlip chez Trello, et tu
                choisis ton tableau. Rien à recopier.
              </p>
            </Module>

            {/* Le même écran que /compte, plutôt qu'un formulaire jumeau qui
                divergerait à la première évolution. */}
            <Integrations />

            <Module className="p-[18px]">
              <button
                type="button"
                disabled={!trelloPret}
                onClick={() => enregistrerEtape(2)}
                className={boutonCls}
              >
                {trelloPret
                  ? "Mon board est choisi, continuer"
                  : "Connecte Trello et choisis ton board"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </Module>
          </>
        )}

        {etape === 2 && (
          <Module className="p-[24px]">
            <CardTitle className="mb-2">Préparer le board</CardTitle>
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--muted)]">
              MyFlip attend trois colonnes et deux étiquettes précises. Plutôt
              que de te faire les créer à la main, il peut les poser lui-même
              sur ton tableau. Rien n&apos;est écrasé : ce qui porte déjà le bon
              nom est laissé tel quel.
            </p>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[16px] bg-[var(--surface-2)] p-3.5">
                <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  Colonnes
                </div>
                <ul className="flex flex-col gap-1 text-[13px] text-[var(--ink2)]">
                  {COLONNES.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[16px] bg-[var(--surface-2)] p-3.5">
                <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  Étiquettes
                </div>
                <ul className="flex flex-col gap-1 text-[13px] text-[var(--ink2)]">
                  {ETIQUETTES_COMPTA.map((e) => (
                    <li key={e.name}>
                      <b>{e.name}</b>
                    </li>
                  ))}
                  <li className="text-[var(--faint)]">
                    + transporteurs :{" "}
                    {TRANSPORTEURS.map((t) => t.name).join(", ")}
                  </li>
                </ul>
              </div>
            </div>

            <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--faint)]">
              Les deux étiquettes en gras commandent la comptabilité : « À
              comptabiliser » posée sur une carte fait basculer les articles
              dont le SKU est dans son titre ; « Comptabilisé » est reposée par
              MyFlip quand tu valides la vente. Les transporteurs servent à
              déduire par qui l&apos;article a été expédié.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enCours || !trelloPret}
                onClick={() => preparerBoard(true)}
                className={boutonCls}
              >
                {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer tout sur mon board
              </button>
              <button
                type="button"
                disabled={enCours || !trelloPret}
                onClick={() => preparerBoard(false)}
                className={boutonSecondaireCls}
              >
                Sans les transporteurs
              </button>
            </div>

            {rapport && (
              <ul className="mt-4 flex flex-col gap-1 rounded-[16px] bg-[var(--surface-2)] p-3.5 text-[12.5px] text-[var(--ink2)]">
                {rapport.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!etiquettesPretes}
                onClick={() => enregistrerEtape(3)}
                className={boutonCls}
              >
                {etiquettesPretes
                  ? "Continuer"
                  : "Les deux étiquettes doivent être désignées"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/compte" className={boutonSecondaireCls}>
                Les choisir à la main
              </Link>
            </div>
          </Module>
        )}

        {etape === 3 && (
          <Module className="p-[24px]">
            <CardTitle className="mb-2">Ta première commande</CardTitle>
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--muted)]">
              Tout est branché. Une commande contient un ou plusieurs lots : un
              lot de polos et un lot de t-shirts n&apos;ont ni le même prix
              d&apos;achat, ni la même série de SKU. Les frais de port se
              répartissent au prorata sur l&apos;ensemble.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await enregistrerEtape(3, true);
                  router.push("/commandes");
                }}
                className={boutonCls}
              >
                Créer ma première commande
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await enregistrerEtape(3, true);
                  router.push("/dashboard");
                }}
                className={boutonSecondaireCls}
              >
                Plus tard
              </button>
            </div>
          </Module>
        )}
      </section>
    </Frame>
  );
}
