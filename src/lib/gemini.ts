export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiModels(): string[] {
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-latest";
  return primary === fallback ? [primary] : [primary, fallback];
}

/** Calls Gemini and returns the parsed JSON response. Tries the fallback model on 429/503. */
export async function generateJson<T>(parts: Part[], responseSchema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  let lastError = "";
  for (const model of geminiModels()) {
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      return JSON.parse(text) as T;
    }
    lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status !== 503 && res.status !== 404) break;
  }
  throw new Error(lastError);
}
