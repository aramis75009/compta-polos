"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type PendingAction = { tool: string; input: Record<string, unknown> };

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: PendingAction | null;
  resolved?: boolean; // plan confirmé ou annulé → on masque les boutons
};

let counter = 0;
const uid = () => `m${++counter}`;

export default function ChatBot() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Bonjour 👋 Je suis ton assistant. Demande-moi un chiffre (CA, stock…) ou une action (changer un statut, marquer des ventes).",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const push = (m: Omit<Msg, "id">) =>
    setMessages((prev) => [...prev, { ...m, id: uid() }]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["articles"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["commandes"] });
  };

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    push({ role: "user", text: message });
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, confirmed: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur.");
      if (data.pendingAction) {
        push({
          role: "assistant",
          text: data.plan ?? "Je vais exécuter cette action.",
          pending: data.pendingAction,
        });
      } else {
        push({ role: "assistant", text: data.result ?? "…" });
      }
    } catch (e) {
      push({ role: "assistant", text: `❌ ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  async function confirm(msg: Msg) {
    if (!msg.pending || loading) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, resolved: true } : m)),
    );
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, pendingAction: msg.pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur.");
      push({ role: "assistant", text: data.result ?? "Action exécutée." });
      invalidate();
    } catch (e) {
      push({ role: "assistant", text: `❌ ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  function cancel(msg: Msg) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, resolved: true } : m)),
    );
    push({ role: "assistant", text: "Action annulée." });
  }

  return (
    <>
      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant IA"
          className="fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-card-hover transition-transform hover:scale-105 md:bottom-6"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Panneau latéral */}
      {open && (
        <div className="fixed right-0 top-0 z-50 flex h-screen w-full flex-col border-l border-line bg-surface shadow-card-hover sm:w-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h2 className="text-title-sm font-semibold text-ink">Assistant IA</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-container hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-card px-3.5 py-2.5 text-body-md ${
                    m.role === "user"
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.pending && !m.resolved && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => confirm(m)}
                        disabled={loading}
                        className="rounded-full bg-primary px-3.5 py-1.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
                      >
                        ✓ Confirmer
                      </button>
                      <button
                        onClick={() => cancel(m)}
                        disabled={loading}
                        className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-label-sm font-medium text-ink-muted transition-colors hover:bg-surface-container disabled:opacity-60"
                      >
                        ✗ Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-card bg-surface-container px-3.5 py-2.5 text-body-md text-ink-faint">
                  …
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-line p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Écris un message…"
                className="max-h-32 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="rounded-full bg-primary px-4 py-2 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
