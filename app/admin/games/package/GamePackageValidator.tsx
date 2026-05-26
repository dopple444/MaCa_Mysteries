"use client";

import { AlertTriangle, CheckCircle2, FileJson, Upload } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import type { GamePackageValidationIssue, GamePackageValidationResult } from "../../../lib/game-package";

type ValidationResponse = {
  ok: boolean;
  result?: GamePackageValidationResult;
  error?: string;
};

type GamePackageValidatorProps = {
  csrfToken: string;
  schemaVersion: string;
};

const samplePackage = {
  schemaVersion: "maca-game-package/v1",
  source: {
    kind: "AI_ASSISTED",
    toolName: "Drafting tool"
  },
  game: {
    slug: "sample-manor-mystery",
    title: "Sample Manor Mystery",
    tagline: "A compact package for dry-run validation.",
    description: "This sample proves the import contract without creating any database content.",
    minPlayers: 4,
    maxPlayers: 8,
    durationMin: 120,
    durationMax: 180,
    themes: ["classic mystery"]
  },
  characters: [
    {
      key: "detective-vale",
      name: "Detective Vale",
      publicBio: "A careful investigator with a steady eye.",
      isRequired: true
    }
  ],
  rounds: [
    {
      key: "round-1",
      title: "Round 1",
      cards: [
        {
          key: "opening-card",
          title: "Opening Card",
          body: "You arrive with a question no one wants answered.",
          visibility: "PLAYER_PRIVATE",
          characterKey: "detective-vale"
        }
      ]
    }
  ],
  finalReveal: {
    title: "Final Reveal",
    victimCharacterKey: "detective-vale",
    killerCharacterKey: "detective-vale",
    solutionText: "The sample solution is intentionally simple."
  }
};

function issueList(title: string, issues: GamePackageValidationIssue[], tone: "error" | "warning") {
  if (!issues.length) return null;
  const toneClasses =
    tone === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-yellow-500/20 bg-yellow-500/10 text-yellow-100";

  return (
    <section className={`rounded-2xl border p-4 ${toneClasses}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 grid gap-3">
        {issues.map((issue, index) => (
          <article key={`${issue.code}-${issue.path}-${index}`} className="rounded-xl bg-slate-950/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">{issue.code}</p>
            <p className="mt-1 break-all text-xs opacity-80">{issue.path || "package"}</p>
            <p className="mt-2 text-sm leading-6">{issue.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GamePackageValidator({ csrfToken, schemaVersion }: GamePackageValidatorProps) {
  const [packageJson, setPackageJson] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [response, setResponse] = useState<ValidationResponse | null>(null);

  const summaryEntries = useMemo(() => {
    const summary = response?.result?.summary;
    if (!summary) return [];
    return [
      ["Characters", summary.characters],
      ["Required", summary.requiredCharacters],
      ["Optional", summary.optionalCharacters],
      ["Rounds", summary.rounds],
      ["Cards", summary.cards],
      ["Evidence", summary.evidence],
      ["Media", summary.mediaAssets],
      ["Artifacts", summary.digitalArtifacts],
      ["Tools", summary.characterTools],
      ["Unlock rules", summary.unlockRules],
      ["Final reveal", summary.hasFinalReveal ? "Yes" : "No"],
      ["Source", summary.sourceKind]
    ];
  }, [response]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsValidating(true);
    setResponse(null);

    const formData = new FormData(event.currentTarget);
    try {
      const validationResponse = await fetch("/admin/games/package/validate", {
        method: "POST",
        body: formData,
        headers: {
          accept: "application/json"
        }
      });
      const payload = (await validationResponse.json()) as ValidationResponse;
      setResponse(validationResponse.ok ? payload : { ok: false, error: payload.error || "Validation failed." });
    } catch {
      setResponse({ ok: false, error: "Validation request failed." });
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
      <input type="hidden" name="csrfToken" value={csrfToken} />

      <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Schema</p>
            <p className="mt-1 text-sm text-slate-400">{schemaVersion}</p>
          </div>
          <button
            type="button"
            onClick={() => setPackageJson(JSON.stringify(samplePackage, null, 2))}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white"
          >
            <FileJson className="h-4 w-4" aria-hidden="true" />
            Load sample
          </button>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-200">
        Package file
        <input
          name="packageFile"
          type="file"
          accept="application/json,.json"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-400 focus:border-indigo-400"
        />
      </label>

      <label className="block text-sm font-medium text-slate-200">
        Package JSON
        <textarea
          name="packageJson"
          value={packageJson}
          onChange={(event) => setPackageJson(event.target.value)}
          rows={18}
          spellCheck={false}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 font-mono text-sm text-white outline-none focus:border-indigo-400"
        />
      </label>

      <button
        disabled={isValidating}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        {isValidating ? "Validating" : "Validate package"}
      </button>

      {response?.error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-100">
          <AlertTriangle className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
          <p className="text-sm leading-6">{response.error}</p>
        </div>
      )}

      {response?.result && (
        <div className="grid gap-5">
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              response.result.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/20 bg-red-500/10 text-red-100"
            }`}
          >
            {response.result.ok ? (
              <CheckCircle2 className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold">{response.result.ok ? "Package is structurally valid" : "Package needs changes"}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                {response.result.errors.length} errors and {response.result.warnings.length} warnings.
              </p>
            </div>
          </div>

          {summaryEntries.length ? (
            <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
              <h3 className="text-sm font-semibold text-white">Summary</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summaryEntries.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-900/80 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {issueList("Errors", response.result.errors, "error")}
          {issueList("Warnings", response.result.warnings, "warning")}
        </div>
      )}
    </form>
  );
}
