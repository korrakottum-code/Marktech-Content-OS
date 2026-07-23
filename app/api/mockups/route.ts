import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { industry?: string; title?: string; body?: string; client?: string; theme?: string; brandMood?: string; brandReferenceImage?: string; category?: string; product?: string; visualDirection?: string; headline?: string; offer?: string; cta?: string; referenceImage?: string; assetKind?: "cover" | "summary" | "strategy" | "content" | "custom" } | null;
  if (!body?.title) return NextResponse.json({ error: "Missing slide title" }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image AI is not configured", nextStep: "เพิ่ม OPENAI_API_KEY เป็น server secret ก่อนสร้างภาพ" }, { status: 503 });

  const isPresentationSlide = Boolean(body.assetKind && body.assetKind !== "content");
  const category = body.category || "แบรนด์ / ไลฟ์สไตล์";
  const creativeRole = category === "โปรโมชั่น / Offer"
    ? "Performance offer ad: make the actual product, service result, device, package, or relevant location the visual hero. Design a bold, high-contrast campaign key visual with clear empty areas for a price and offer lockup. Do not use a random attractive woman or lifestyle portrait unless the brief explicitly asks for that person."
    : category === "รีวิว / Proof"
      ? "Proof ad frame: this must never invent a patient, testimonial, before-and-after transformation, medical result, or review. Create a refined product/service supporting background only, with a clearly usable area for the team to insert a real approved client image or real evidence later."
      : category === "ความรู้ / FAQ"
        ? "Educational ad: make the exact subject being explained the hero - ingredient, food, product, device, treatment area diagram, workflow, or real-world moment. Show a concrete visual answer to the question; never substitute an unrelated beauty portrait."
        : "Brand/lifestyle ad: create a recognizable real business context, atmosphere, product, place, or team ritual that supports the brand story. Avoid stock-like beauty portraits unless they are central to the brief.";
  const prompt = `
Use case: ${isPresentationSlide ? "presentation-design" : "ads-marketing"}
Asset type: ${isPresentationSlide ? "one complete widescreen presentation slide, designed as a 16:9 slide" : "square 1:1 Facebook feed ad key visual, for a performance marketing campaign"}.
Industry: ${body.industry || "business"}. Client: ${body.client || "brand"}.
Category: ${category}. Product or subject: ${body.product || "not specified"}.
Campaign concept: ${body.title}. Creative direction: ${body.visualDirection || body.body?.slice(0, 500) || body.theme || ""}.
Ad copy that will be typeset by the app later: headline "${body.headline || ""}", offer "${body.offer || ""}", CTA "${body.cta || ""}".
${creativeRole}
${isPresentationSlide ? `Create the actual slide itself from this exact slide content only. Slide title: "${body.title}". Slide body: "${body.body || ""}". Do not invent a different campaign, product, price, person, offer, or storyline. Make the title and the most important supporting point readable in the composition; use the provided body only to determine visual hierarchy and supporting details. This is a full-bleed slide, not a Facebook post, not an advertorial cover, and not a generic stock image.` : "Composition: produce the visual system of a real Thai social ad, not an editorial article cover or a presentation cover. Use decisive hierarchy, a clear hero subject, deliberate contrast, and protected negative space matched to the category for app-applied copy. The visual must directly depict the stated subject; if the topic is food, show that food; if it is a device, show the device; if it is a clinic offer, show the relevant treatment, approved product, device, or location."}
Style: adapt color, lighting, props and energy to this specific client and idea; do not force warm ivory, terracotta, or a beauty aesthetic.
Brand mood/tone direction: ${body.brandMood?.slice(0, 400) || "not specified"}. If a logo or mood reference image is attached, use it only as a style/reference signal; do not distort, invent, or reproduce a logo inaccurately.
${body.referenceImage ? "The first attached image is the REQUIRED POST REFERENCE, not a loose mood board. Preserve its recognizable person, product, treatment area, scene, pose, or original photo as the dominant visual hero in the finished ad. Build typography and supporting visual elements around that exact reference; do not replace it with a generic AI person or an unrelated stock-style scene. If a second image is attached, it is only the brand/logo mood reference and must not displace the first image." : ""}
Text to render as the ad copy, exactly where possible: headline "${body.headline || body.title}", supporting line "${body.offer || ""}", CTA "${body.cta || ""}". Do not invent extra claims, prices, names or logos.
Constraints: square 1:1, one coherent ad composition, including the ad typography and visual hierarchy. No generic woman portrait when irrelevant. No collage unless the concept explicitly requires multiple real evidence slots. No fabricated before-and-after or medical claim. No watermark.
`;
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const referenceMatches = [body.referenceImage, body.brandReferenceImage]
    .map((image) => image?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match));
  let response: Response;
  if (referenceMatches.length) {
    const requestEdit = (editPrompt: string) => {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", editPrompt);
      referenceMatches.forEach((reference, index) => {
        const binary = atob(reference[2].replace(/\s/g, ""));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        form.append(referenceMatches.length > 1 ? "image[]" : "image", new Blob([bytes], { type: reference[1] }), `reference-${index + 1}`);
      });
      form.append("size", isPresentationSlide ? "1536x1024" : "1024x1024");
      form.append("quality", "low");
      form.append("output_format", "png");
      return fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(75_000), body: form });
    };
    response = await requestEdit(`${prompt}\nSafety framing: This is a non-sexual, fully clothed commercial clinic advertisement. Do not show nudity, lingerie, intimate body areas, or sexualized posing.`);
    if (!response.ok) {
      const rejected = await response.clone().json().catch(() => null) as { error?: { message?: string } } | null;
      if (rejected?.error?.message?.toLowerCase().includes("safety")) {
        response = await requestEdit(`${prompt}\nCreate a conservative, non-sexual clinic education or service advertisement. Keep the supplied source image only as a normal commercial reference; show an everyday, fully clothed person or the relevant service context. No nudity, no lingerie, no intimate-area focus, no suggestive pose.`);
      }
    }
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(75_000),
      body: JSON.stringify({ model, prompt, size: isPresentationSlide ? "1536x1024" : "1024x1024", quality: "low", output_format: "png" }),
    });
  }
  const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  if (!response.ok || !payload.data?.[0]) return NextResponse.json({ error: "Image generation failed", nextStep: payload.error?.message ?? "OpenAI rejected image generation" }, { status: 502 });
  const image = payload.data[0].b64_json ? `data:image/png;base64,${payload.data[0].b64_json}` : payload.data[0].url;
  if (!image) return NextResponse.json({ error: "Image AI returned no image" }, { status: 502 });
  return NextResponse.json({ image });
}
