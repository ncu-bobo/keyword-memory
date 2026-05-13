import type { KnowledgeItem, ReviewResult } from "@keyword-memory/core";
import { scheduleNextReview, sortReviewQueue } from "@keyword-memory/core";
import { createSupabaseBrowserClient } from "@keyword-memory/supabase";

const STORAGE_KEY = "keyword-memory.items";

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

function loadLocalItems(): KnowledgeItem[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as KnowledgeItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalItems(items: KnowledgeItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortReviewQueue(items)));
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

export async function loadItems(): Promise<KnowledgeItem[]> {
  const localItems = loadLocalItems();
  const cloudItems = await loadCloudItems().catch(() => null);

  if (!cloudItems) {
    return sortReviewQueue(localItems);
  }

  const mergedItems = mergeItems(localItems, cloudItems);
  saveLocalItems(mergedItems);
  await saveCloudItems(mergedItems);
  return mergedItems;
}

export async function saveItems(items: KnowledgeItem[]) {
  const sortedItems = sortReviewQueue(items);
  saveLocalItems(sortedItems);
  await saveCloudItems(sortedItems);
}

export async function addItems(nextItems: KnowledgeItem[]) {
  const items = sortReviewQueue([...nextItems, ...loadLocalItems()]);
  await saveItems(items);
  return items;
}

export async function reviewItem(id: string, result: ReviewResult) {
  const now = new Date();
  const items = loadLocalItems().map((item) => {
    if (item.id !== id) {
      return item;
    }

    const next = scheduleNextReview(item.reviewLevel, result, now);
    return {
      ...item,
      ...next,
      lastReviewedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  });

  await saveItems(items);
  await saveReviewLog(id, result, now);
  return sortReviewQueue(items);
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
