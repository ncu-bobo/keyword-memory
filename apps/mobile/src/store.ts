import {
  createLocalKnowledgeItem,
  createId,
  isDueForReview,
  scheduleNextReview,
  sortReviewQueue,
  splitKeywords,
  type KnowledgeItem,
  type ManualCaptureInput,
  type ReviewResult
} from "@keyword-memory/core";

const STORAGE_KEY = "keyword-memory.items";

export function loadItems(): KnowledgeItem[] {
  const items = uni.getStorageSync(STORAGE_KEY);
  return Array.isArray(items) ? items : [];
}

export function saveItems(items: KnowledgeItem[]) {
  uni.setStorageSync(STORAGE_KEY, items);
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
  const next = sortReviewQueue([...items, ...loadItems()]);
  saveItems(next);
  return next;
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
  return items;
}

export function togglePin(id: string) {
  const items = loadItems().map((item) =>
    item.id === id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item
  );
  saveItems(items);
  return items;
}

export function parseClipboardText(text: string) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    title: lines[0]?.slice(0, 42) ?? "",
    keywords: splitKeywords(lines.slice(1).join(" ") || text).slice(0, 10).join("、")
  };
}
