"use client";
import { useEffect, useMemo, useState } from "react";
import { Camera, Download, Gauge, Loader2, Save, Trash2, TriangleAlert, CircleCheck, CircleX } from "lucide-react";
import { checkReading, consumption, DialReading, LoggedReading, MeterKind, toCsv } from "@/lib/meter";

const STORE = "dial-reader.history.v1";

export default function Home() {
  const [kind, setKind] = useState<MeterKind>("electricity");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<DialReading | null>(null);
  const [value, setValue] = useState<string>("");
  const [mock, setMock] = useState(false);
  const [history, setHistory] = useState<LoggedReading[]>([]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load browser-only storage after mount
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem(STORE) || "[]")); } catch {} }, []);
  const save = (rows: LoggedReading[]) => { setHistory(rows); localStorage.setItem(STORE, JSON.stringify(rows)); };

  const mine = useMemo(() => history.filter((r) => r.kind === kind).sort((a, b) => a.takenAt.localeCompare(b.takenAt)), [history, kind]);
  const flags = reading && value !== "" ? checkReading(Number(value), reading.confidence, mine) : [];
  const usage = consumption(mine);

  function pick(f: File | null) {
    setFile(f); setReading(null); setError(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function read() {
    if (!file) return;
    setBusy(true); setError(null);
    const fd = new FormData(); fd.append("photo", file); fd.append("kind", kind);
    try {
      const res = await fetch("/api/read", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setReading(data.reading); setValue(data.value == null ? "" : String(data.value)); setMock(!!data.mock);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  function commit() {
    if (!reading || value === "") return;
    save([...history, { id: crypto.randomUUID(), takenAt: new Date().toISOString(), kind, value: Number(value), confidence: reading.confidence }]);
    pick(null);
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(mine)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${kind}-readings.csv`; a.click();
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-800">
      <header className="mb-8 flex items-center gap-3">
        <Gauge className="h-9 w-9 text-amber-600" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Dial Reader</h1>
          <p className="text-sm text-slate-500">Photograph an old clock-dial utility meter. Get the reading, a sanity check against your history, and a CSV log.</p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-2" role="radiogroup" aria-label="Meter type">
          {(["electricity", "water", "gas"] as MeterKind[]).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${kind === k ? "bg-amber-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>{k}</button>
          ))}
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-amber-500">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          {preview ? <img src={preview} alt="Selected meter" className="max-h-72 rounded-lg" /> : (<><Camera className="mb-2 h-8 w-8 text-slate-400" aria-hidden /><span className="text-sm text-slate-500">Tap to take or choose a photo of the dials</span></>)}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        <button onClick={read} disabled={!file || busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Gauge className="h-4 w-4" aria-hidden />} Read meter
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {reading && (
          <div className="mt-6 border-t pt-5">
            {mock && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">Demo mode: sample reading, not from your photo.</p>}
            <div className="mb-3 flex flex-wrap gap-2">
              {reading.dials.map((d, i) => (
                <div key={i} title={reading.ambiguousDials.includes(i) ? "Pointer between two numbers" : undefined}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-semibold ${reading.ambiguousDials.includes(i) ? "border-amber-500 bg-amber-50" : "border-slate-300"}`}>{d}</div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Confidence {(reading.confidence * 100).toFixed(0)}%. {reading.notes}</p>
            <label className="mt-3 block text-sm">Reading (edit if a dial is wrong)
              <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 block w-48 rounded border px-3 py-2 font-mono" />
            </label>
            <ul className="mt-3 space-y-1">
              {flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {f.level === "ok" ? <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden /> : f.level === "warn" ? <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden /> : <CircleX className="h-4 w-4 text-red-600" aria-hidden />}{f.message}
                </li>
              ))}
            </ul>
            <button onClick={commit} disabled={value === ""} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-40"><Save className="h-4 w-4" aria-hidden /> Save reading</button>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold capitalize">{kind} history</h2>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={!mine.length} className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm disabled:opacity-40"><Download className="h-4 w-4" aria-hidden /> CSV</button>
            <button onClick={() => save(history.filter((r) => r.kind !== kind))} disabled={!mine.length} className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden /> Clear</button>
          </div>
        </div>
        {mine.length === 0 ? <p className="text-sm text-slate-500">No readings yet. They stay in this browser only.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Date</th><th>Reading</th><th>Used since previous</th></tr></thead>
            <tbody>{mine.map((r, i) => (
              <tr key={r.id} className="border-t"><td className="py-1">{new Date(r.takenAt).toLocaleDateString()}</td><td className="font-mono">{r.value}</td><td>{i ? usage[i - 1].used : "-"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <footer className="mt-12 text-xs text-slate-400">Photos are sent to the Gemini API for reading and are not stored. Readings are saved only in your browser.</footer>
    </main>
  );
}
