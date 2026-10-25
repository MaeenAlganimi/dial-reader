# Dial Reader

Read old clock-dial utility meters (electricity, water, gas) from a phone photo.

Many homes and small buildings still have analog meters with four or five little clock dials. They are easy to misread: neighbouring dials turn in opposite directions, and a pointer sitting "on" a number may not have reached it yet. Dial Reader sends the photo to the Gemini vision API with the reading rules spelled out, then checks the result against your own history before you save it.

**Live demo:** https://dial-reader.onrender.com (free instance, first load can take ~50 s to wake)

## What it does

- Reads each dial left to right and highlights dials where the pointer sat between two numbers
- Applies the standard rules: take the lower number, and use the dial to the right to settle borderline pointers
- Falls back to digital or rolling-number windows when there are no dials
- Lets you correct the number before saving
- Flags readings that go backwards, low-confidence reads, and usage spikes over 3x your median (possible leak or misread)
- Keeps history per meter type in the browser and exports it to CSV
- Works without a key in demo mode (returns a labelled sample reading)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Gemini API (REST, structured JSON output) · Vitest · lucide icons

## Run locally

```bash
npm install
cp env.example .env.local   # add a free key from https://aistudio.google.com/apikey
npm run dev
npm test
```

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini key. Without it the app runs in demo mode. |
| `GEMINI_MODEL` | Optional, default `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Optional, used on 429/503, default `gemini-flash-latest` |

## Privacy

Photos go to the Gemini API for reading and are not stored by the app. Readings live only in your browser's local storage.

## Layout

- `src/lib/meter.ts`: prompt, schema, dial maths, history checks, CSV (unit tested)
- `src/lib/gemini.ts`: small REST client with model fallback
- `src/app/api/read/route.ts`: upload validation and the vision call
- `src/app/page.tsx`: capture, review, and history UI
