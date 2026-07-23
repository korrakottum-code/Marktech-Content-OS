import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { industry?: string; title?: string; body?: string; client?: string; theme?: string } | null;
  if (!body?.title) return NextResponse.json({ error: "Missing slide title" }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image AI is not configured", nextStep: "เพิ่ม OPENAI_API_KEY เป็น server secret ก่อนสร้างภาพ" }, { status: 503 });

  const prompt = `
Create one square 1:1 Facebook feed campaign visual that a graphic designer can use as the real starting point for a post, not a generic presentation cover.
Industry: ${body.industry || "business"}. Client: ${body.client || "brand"}.
Content concept: ${body.title}. Context: ${body.body?.slice(0, 500) || body.theme || ""}.
Use a refined, commercially useful editorial visual in warm ivory, terracotta and natural neutral tones. Make it appropriate for the stated industry, not automatically a beauty clinic. Reserve the lower third as clean high-contrast space for the editable Thai headline, offer and CTA that will be overlaid by the app. Do not include written words, letters, logos, watermarks, a collage, or before-and-after claims.
`;
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(75_000),
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2", prompt, size: "1024x1024", quality: "low", output_format: "png" }),
  });
  const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  if (!response.ok || !payload.data?.[0]) return NextResponse.json({ error: "Image generation failed", nextStep: payload.error?.message ?? "OpenAI rejected image generation" }, { status: 502 });
  const image = payload.data[0].b64_json ? `data:image/png;base64,${payload.data[0].b64_json}` : payload.data[0].url;
  if (!image) return NextResponse.json({ error: "Image AI returned no image" }, { status: 502 });
  return NextResponse.json({ image });
}
