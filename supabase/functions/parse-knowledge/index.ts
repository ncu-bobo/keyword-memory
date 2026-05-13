import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

interface ParseRequest {
  text: string;
  preferredTags?: string[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = (await request.json()) as ParseRequest;
  const text = body.text?.trim();

  if (!text) {
    return json({ error: "Text is required" }, 400);
  }

  const apiKey = Deno.env.get("AI_API_KEY");
  const baseUrl = Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1";
  const model = Deno.env.get("AI_MODEL") ?? "gpt-4.1-mini";

  if (!apiKey) {
    return json({ error: "AI_API_KEY is not configured" }, 500);
  }

  const prompt = buildPrompt(text, body.preferredTags ?? []);
  const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a precise knowledge extraction engine. Return compact JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!aiResponse.ok) {
    return json({ error: "AI parse failed", detail: await aiResponse.text() }, 502);
  }

  const completion = await aiResponse.json();
  const content = completion.choices?.[0]?.message?.content ?? '{"items":[]}';

  try {
    const parsed = JSON.parse(content);
    return json(normalizeParsedResponse(parsed));
  } catch (_error) {
    return json({ error: "AI returned invalid JSON" }, 502);
  }
});

function buildPrompt(text: string, preferredTags: string[]): string {
  return `
Extract high-value knowledge points from the text below.

Rules:
1. Split long text into multiple independent items. Do not merge unrelated topics.
2. Each item must include title, keywords, tag, sourceExcerpt.
3. Title must be concise and standard.
4. Keywords must keep only concepts, methods, models, architecture, algorithms, tactics, risk control, indicators, syntax, frameworks, principles, or pitfalls.
5. Remove emotions, jokes, filler, greetings, and redundant setup.
6. For AI content, prioritize models, architecture, algorithms, and practical techniques.
7. For programming content, prioritize syntax, frameworks, principles, and pitfalls.
8. For investing content, prioritize logic, tactics, risk control, market context, and indicators.
9. Use preferred tags when suitable: ${preferredTags.join(", ") || "AI, 程序员技术, 股市投资, 通用知识"}.
10. Return JSON with this shape: {"items":[{"title":"...","keywords":["..."],"tag":"...","sourceExcerpt":"..."}]}.

Text:
${text}
`;
}

function normalizeParsedResponse(value: unknown) {
  const items = Array.isArray((value as { items?: unknown[] }).items)
    ? (value as { items: unknown[] }).items
    : [];

  return {
    items: items
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        keywords: Array.isArray(item.keywords)
          ? item.keywords.map(String).map((keyword) => keyword.trim()).filter(Boolean)
          : [],
        tag: String(item.tag ?? "").trim() || undefined,
        sourceExcerpt: String(item.sourceExcerpt ?? "").trim() || undefined
      }))
      .filter((item) => item.title && item.keywords.length > 0)
      .slice(0, 12)
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
