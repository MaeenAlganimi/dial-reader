export type MeterKind = "electricity" | "water" | "gas";

export interface DialReading {
  /** Value of each dial from left (highest place) to right, 0-9. */
  dials: number[];
  /** Dials whose pointer sat between two digits, by index. */
  ambiguousDials: number[];
  /** Digits from a digital/odometer window, if the meter has one. */
  odometer: string | null;
  confidence: number;
  notes: string;
}

export interface LoggedReading {
  id: string;
  takenAt: string;
  kind: MeterKind;
  value: number;
  confidence: number;
}

export const readingSchema = {
  type: "OBJECT",
  properties: {
    dials: { type: "ARRAY", items: { type: "INTEGER" } },
    ambiguousDials: { type: "ARRAY", items: { type: "INTEGER" } },
    odometer: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    notes: { type: "STRING" },
  },
  required: ["dials", "ambiguousDials", "confidence", "notes"],
};

export function readingPrompt(kind: MeterKind): string {
  return [
    `You read analog ${kind} meters from photos.`,
    "Return each clock-style dial from LEFT to RIGHT as one digit 0-9.",
    "Adjacent dials rotate in opposite directions; check the arrow/numbers printed on each dial.",
    "When a pointer is between two numbers, take the LOWER number (the one it has passed).",
    "If a pointer sits almost exactly on a number, look at the dial to its right: if that dial reads 8 or 9, the pointer has NOT reached the number yet, so use the number below.",
    "List the index of every dial you were unsure about in ambiguousDials.",
    "If the meter has a digital or rolling-number window instead of (or as well as) dials, put those digits in odometer.",
    "If the image is not a meter, return an empty dials array, confidence 0, and explain in notes.",
  ].join("\n");
}

/** Apply the standard dial-reading carry rule: a dial cannot have advanced if the next dial is still at 8-9 after a near-integer pointer. */
export function dialsToValue(dials: number[]): number {
  if (dials.length === 0 || dials.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("Each dial must be a digit from 0 to 9");
  }
  return Number(dials.join(""));
}

export function readingValue(r: DialReading): number {
  if (r.dials.length > 0) return dialsToValue(r.dials);
  const digits = (r.odometer ?? "").replace(/\D/g, "");
  if (!digits) throw new Error("No dials or digits were found in the photo");
  return Number(digits);
}

export type Flag = { level: "ok" | "warn" | "error"; message: string };

/** Check a new reading against the history for the same meter. */
export function checkReading(value: number, confidence: number, history: LoggedReading[]): Flag[] {
  const flags: Flag[] = [];
  const sorted = [...history].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const last = sorted.at(-1);
  if (confidence < 0.6) flags.push({ level: "warn", message: "Low confidence. Check the dials before saving." });
  if (last && value < last.value) {
    flags.push({ level: "error", message: `Lower than the last reading (${last.value}). A meter should never go backwards: re-check a dial or the meter was replaced.` });
  }
  const deltas = consumption(sorted).map((c) => c.used);
  if (last && deltas.length >= 2 && value >= last.value) {
    const med = median(deltas);
    const used = value - last.value;
    if (med > 0 && used > med * 3) flags.push({ level: "warn", message: `Usage of ${used} is over 3x your typical ${med}. Possible leak or misread.` });
  }
  if (flags.length === 0) flags.push({ level: "ok", message: "Looks consistent with your history." });
  return flags;
}

export function consumption(sorted: LoggedReading[]): { from: string; to: string; used: number }[] {
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    out.push({ from: sorted[i - 1].takenAt, to: sorted[i].takenAt, used: sorted[i].value - sorted[i - 1].value });
  }
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function toCsv(rows: LoggedReading[]): string {
  const head = "taken_at,meter,reading,confidence";
  return [head, ...rows.map((r) => `${r.takenAt},${r.kind},${r.value},${r.confidence.toFixed(2)}`)].join("\n");
}

export function normalize(raw: DialReading): DialReading {
  const dials = (raw.dials ?? []).map((d) => Math.max(0, Math.min(9, Math.round(Number(d)))));
  return {
    dials,
    ambiguousDials: (raw.ambiguousDials ?? []).filter((i) => i >= 0 && i < dials.length),
    odometer: raw.odometer ?? null,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    notes: String(raw.notes ?? ""),
  };
}
