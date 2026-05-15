import {
  createLocalKnowledgeItem,
  createId,
  isDueForReview,
  scheduleNextReview,
  sortReviewQueue,
  splitKeywords,
  type KnowledgeItem,
  type ManualCaptureInput,
  type ParsedKnowledgeItem,
  type ReviewResult
} from "@keyword-memory/core";
import { createSupabaseBrowserClient } from "@keyword-memory/supabase";

const STORAGE_KEY = "keyword-memory.items";
const AI_CONFIG_KEY = "keyword-memory.ai-config";

const KNOWLEDGE_KEYWORD_EXTRACTION_PROMPT = `你是 Keyword Memory 的知识点提炼助手。
你的任务是把用户提供的一段原文压缩成 1 个可复习的知识点。

输出要求：
1. 只输出 JSON，不要 Markdown，不要解释。
2. JSON 结构必须是：{"title":"", "keywords":[""], "tag":"", "sourceExcerpt":""}
3. title 使用中文，控制在 8 到 28 个字，表达这个知识点的核心结论。
4. keywords 输出 3 到 8 个中文或英文关键词，每个关键词尽量短，适合记忆卡片。
5. tag 输出一个简短分类，例如：程序员技术、通用知识、股市投资、AI。
6. sourceExcerpt 摘取原文中最能支撑该知识点的一小段，控制在 120 字以内。
7. 不要拆成多个知识点，只保留最值得记的一条。`;

type KnowledgeRow = {
  id: string;
  user_id: string;
  title: string;
  keywords: string[];
  tag: string | null;
  pinned: boolean;
  source_text: string | null;
  source_url: string | null;
  source_excerpt: string | null;
  review_at: string;
  review_level: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

interface AiConfig {
  baseUrl?: string;
  apiKey?: string;
}

interface AiConfigView {
  baseUrl: string;
  hasApiKey: boolean;
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = supabaseUrl && supabaseAnonKey
  ? createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

export async function getCurrentUser() {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signInOrSignUp(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedEmail = email.trim();
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (!signInError) {
    return { user: signInData.user, needsConfirmation: false };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password
  });

  if (signUpError) {
    throw signInError;
  }

  return {
    user: signUpData.user,
    needsConfirmation: Boolean(signUpData.user && !signUpData.session)
  };
}

export async function signOut() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

function readSavedAiConfig(): AiConfig {
  const value = uni.getStorageSync(AI_CONFIG_KEY);
  if (!value || typeof value !== "object") {
    return {};
  }

  const config = value as AiConfig;
  return {
    baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : undefined,
    apiKey: typeof config.apiKey === "string" ? config.apiKey : undefined
  };
}

function getDefaultAiBaseUrl() {
  return (import.meta.env.VITE_AI_API_ENDPOINT as string | undefined)
    || (import.meta.env.VITE_AI_BASE_URL as string | undefined)
    || "https://api.openai.com/v1";
}

export function getAiConfig(): AiConfigView {
  const savedConfig = readSavedAiConfig();
  const envApiKey = import.meta.env.VITE_AI_API_KEY as string | undefined;

  return {
    baseUrl: savedConfig.baseUrl || getDefaultAiBaseUrl(),
    hasApiKey: Boolean(savedConfig.apiKey || envApiKey)
  };
}

export function saveAiConfig(input: AiConfig): AiConfigView {
  const current = readSavedAiConfig();
  const nextConfig: AiConfig = {
    baseUrl: input.baseUrl?.trim() || current.baseUrl,
    apiKey: input.apiKey?.trim() || current.apiKey
  };

  uni.setStorageSync(AI_CONFIG_KEY, nextConfig);
  return getAiConfig();
}

export function clearAiConfig(): AiConfigView {
  uni.removeStorageSync(AI_CONFIG_KEY);
  return getAiConfig();
}

export function loadItems(): KnowledgeItem[] {
  const items = uni.getStorageSync(STORAGE_KEY);
  return Array.isArray(items) ? items : [];
}

export function saveItems(items: KnowledgeItem[]) {
  const sortedItems = sortReviewQueue(items);
  uni.setStorageSync(STORAGE_KEY, sortedItems);
  void saveCloudItems(sortedItems).catch(() => undefined);
}

export function addItems(nextItems: KnowledgeItem[]) {
  const items = sortReviewQueue([...nextItems, ...loadItems()]);
  saveItems(items);
  return items;
}

export function addManualItem(input: ManualCaptureInput) {
  const item = createLocalKnowledgeItem(input);
  const items = sortReviewQueue([item, ...loadItems()]);
  saveItems(items);
  return items;
}

export function addParsedItems(
  parsedItems: Array<{ title: string; keywords: string[]; tag?: string; sourceExcerpt?: string }>,
  sourceText: string
) {
  const now = new Date().toISOString();
  const items: KnowledgeItem[] = parsedItems.map((item) => ({
    id: createId(),
    title: item.title,
    keywords: item.keywords,
    tag: item.tag,
    pinned: false,
    sourceText,
    sourceExcerpt: item.sourceExcerpt,
    reviewAt: now,
    reviewLevel: 0,
    createdAt: now,
    updatedAt: now
  }));
  return addItems(items);
}

export function getDueItems() {
  return sortReviewQueue(loadItems().filter((item) => isDueForReview(item)));
}

export function recordReview(id: string, result: ReviewResult) {
  const now = new Date();
  const items = loadItems().map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      ...scheduleNextReview(item.reviewLevel, result, now),
      lastReviewedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  });
  saveItems(items);
  void saveReviewLog(id, result, now).catch(() => undefined);
  return items;
}

export function togglePin(id: string) {
  const items = loadItems().map((item) =>
    item.id === id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item
  );
  saveItems(items);
  return items;
}

export async function deleteItem(id: string) {
  const previousItems = loadItems();
  const nextItems = previousItems.filter((item) => item.id !== id);

  uni.setStorageSync(STORAGE_KEY, nextItems);

  try {
    await deleteCloudItem(id);
  } catch (error) {
    uni.setStorageSync(STORAGE_KEY, previousItems);
    throw error;
  }

  return sortReviewQueue(nextItems);
}

export function parseClipboardText(text: string) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    title: lines[0]?.slice(0, 42) ?? "",
    keywords: splitKeywords(lines.slice(1).join(" ") || text).slice(0, 10).join("、")
  };
}

function buildKnowledgeKeywordExtractionInput(sourceText: string) {
  return `${KNOWLEDGE_KEYWORD_EXTRACTION_PROMPT}\n\n原文：\n${sourceText}`;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("AI response did not contain JSON.");
}

function fallbackTitle(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/[。；.!?！？\n]/)
    .find(Boolean)
    ?.slice(0, 28) || "未命名知识点";
}

function extractAiContent(data: ChatCompletionsResponse | ResponsesApiResponse) {
  if ("output_text" in data && data.output_text) {
    return data.output_text;
  }

  if ("output" in data && data.output) {
    const outputText = data.output
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n");

    if (outputText) {
      return outputText;
    }
  }

  if ("choices" in data) {
    return data.choices?.[0]?.message?.content;
  }

  return undefined;
}

function normalizeParsedKnowledge(value: unknown, sourceText: string): ParsedKnowledgeItem {
  const parsed = (value ?? {}) as Partial<ParsedKnowledgeItem>;
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
    : [];

  return {
    title: String(parsed.title || fallbackTitle(sourceText)).trim().slice(0, 36),
    keywords: Array.from(new Set(keywords)).slice(0, 8),
    tag: parsed.tag ? String(parsed.tag).trim().slice(0, 16) : "AI",
    sourceExcerpt: String(parsed.sourceExcerpt || sourceText).trim().slice(0, 120)
  };
}

export async function parseKnowledgeText(text: string): Promise<ParsedKnowledgeItem> {
  const savedConfig = readSavedAiConfig();
  const apiKey = savedConfig.apiKey || (import.meta.env.VITE_AI_API_KEY as string | undefined);
  const baseUrl = savedConfig.baseUrl || getDefaultAiBaseUrl();
  const model = (import.meta.env.VITE_AI_MODEL as string | undefined) || "gpt-5.5";
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const requestUrl = normalizedBaseUrl.endsWith("/responses") || normalizedBaseUrl.endsWith("/chat/completions")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/responses`;
  const usesResponsesApi = requestUrl.endsWith("/responses");

  if (!apiKey) {
    throw new Error("AI API Key 未配置");
  }

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      usesResponsesApi
        ? {
            model,
            input: buildKnowledgeKeywordExtractionInput(text)
          }
        : {
            model,
            temperature: 0.2,
            max_tokens: 600,
            messages: [
              { role: "system", content: KNOWLEDGE_KEYWORD_EXTRACTION_PROMPT },
              { role: "user", content: text }
            ]
          }
    )
  });

  if (!response.ok) {
    throw new Error(`AI 请求失败：${response.status}`);
  }

  const data = await response.json() as ChatCompletionsResponse | ResponsesApiResponse;
  const content = extractAiContent(data);

  if (!content) {
    throw new Error("AI 返回为空");
  }

  return normalizeParsedKnowledge(JSON.parse(extractJsonObject(content)), text);
}

function rowToItem(row: KnowledgeRow): KnowledgeItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    keywords: row.keywords,
    tag: row.tag ?? undefined,
    pinned: row.pinned,
    sourceText: row.source_text ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceExcerpt: row.source_excerpt ?? undefined,
    reviewAt: row.review_at,
    reviewLevel: row.review_level,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function itemToRow(item: KnowledgeItem, userId: string): KnowledgeRow {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    keywords: item.keywords,
    tag: item.tag ?? null,
    pinned: item.pinned,
    source_text: item.sourceText ?? null,
    source_url: item.sourceUrl ?? null,
    source_excerpt: item.sourceExcerpt ?? null,
    review_at: item.reviewAt,
    review_level: item.reviewLevel,
    last_reviewed_at: item.lastReviewedAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  };
}

function mergeItems(localItems: KnowledgeItem[], cloudItems: KnowledgeItem[]) {
  const byId = new Map<string, KnowledgeItem>();

  for (const item of [...localItems, ...cloudItems]) {
    const existing = byId.get(item.id);
    if (!existing || new Date(item.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byId.set(item.id, item);
    }
  }

  return sortReviewQueue(Array.from(byId.values()));
}

async function loadCloudItems() {
  if (!supabase) {
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*")
    .order("pinned", { ascending: false })
    .order("review_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as KnowledgeRow[]).map(rowToItem);
}

async function saveCloudItems(items: KnowledgeItem[]) {
  if (!supabase) {
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

  const rows = items.map((item) => itemToRow(item, user.id));
  if (rows.length === 0) {
    return true;
  }

  const { error } = await supabase.from("knowledge_items").upsert(rows);
  if (error) {
    throw error;
  }

  return true;
}

async function deleteCloudItem(id: string) {
  if (!supabase) {
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

  const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
  if (error) {
    throw error;
  }

  return true;
}

async function saveReviewLog(knowledgeItemId: string, result: ReviewResult, reviewedAt: Date) {
  if (!supabase) {
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  await supabase.from("review_logs").insert({
    user_id: user.id,
    knowledge_item_id: knowledgeItemId,
    result,
    reviewed_at: reviewedAt.toISOString()
  });
}

export async function syncWithCloud() {
  const cloudItems = await loadCloudItems();
  if (!cloudItems) {
    return sortReviewQueue(loadItems());
  }

  const mergedItems = mergeItems(loadItems(), cloudItems);
  uni.setStorageSync(STORAGE_KEY, mergedItems);
  await saveCloudItems(mergedItems);
  return mergedItems;
}
