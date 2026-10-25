import { NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";
import { DialReading, MeterKind, normalize, readingPrompt, readingSchema, readingValue } from "@/lib/meter";

const KINDS: MeterKind[] = ["electricity", "water", "gas"];
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  const kind = String(form?.get("kind") ?? "electricity") as MeterKind;
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a meter photo." }, { status: 400 });
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown meter type." }, { status: 400 });
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, WebP or HEIC photo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is over 4 MB. Try a smaller one." }, { status: 413 });

  if (!process.env.GEMINI_API_KEY || process.env.DIAL_MOCK === "1") {
    const mock: DialReading = { dials: [0, 4, 7, 2, 9], ambiguousDials: [3], odometer: null, confidence: 0.55, notes: "Demo mode: no Gemini key configured, so this is a sample reading." };
    return NextResponse.json({ reading: mock, value: readingValue(mock), mock: true });
  }
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const raw = await generateJson<DialReading>(
      [{ text: readingPrompt(kind) }, { inlineData: { mimeType: file.type, data } }],
      readingSchema,
    );
    const reading = normalize(raw);
    return NextResponse.json({ reading, value: reading.dials.length || reading.odometer ? readingValue(reading) : null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("read failed:", msg);
    const busy = /429|503/.test(msg);
    return NextResponse.json({ error: busy ? "The vision model is busy or the free daily limit was reached. Try again later." : "Could not read that photo." }, { status: busy ? 503 : 502 });
  }
}
