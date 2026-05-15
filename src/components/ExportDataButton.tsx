"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "ok" | "err";

/**
 * Standalone client island so the surrounding /about page can stay a
 * server component. Fires GET /api/data-export, downloads the response
 * blob as a JSON file, and surfaces auth + failure states inline.
 */
export function ExportDataButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/data-export", { credentials: "include" });
      if (res.status === 401) {
        setStatus("err");
        setError("Sign in to export your library.");
        return;
      }
      if (!res.ok) {
        setStatus("err");
        setError(`Export failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const fromHeader = res.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1];
      const filename = fromHeader ?? `reader-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2400);
    } catch (err) {
      setStatus("err");
      setError((err as Error).message);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={status === "loading"}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-100 disabled:opacity-50"
      >
        {status === "loading" ? "Preparing…" : "Export my library (JSON)"}
      </button>
      {status === "ok" && (
        <span className="text-xs text-emerald-600">Downloaded.</span>
      )}
      {status === "err" && error && (
        <span className="text-xs text-rose-600">{error}</span>
      )}
    </div>
  );
}
