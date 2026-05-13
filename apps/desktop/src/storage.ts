import type { KnowledgeItem, ReviewResult } from "@keyword-memory/core";
import { scheduleNextReview, sortReviewQueue } from "@keyword-memory/core";

const STORAGE_KEY = "keyword-memory.items";

export function loadItems(): KnowledgeItem[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as KnowledgeItem[]) : [];
  } catch {
    return [];
  }
}

export function saveItems(items: KnowledgeItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addItems(nextItems: KnowledgeItem[]) {
  const items = [...nextItems, ...loadItems()];
  saveItems(sortReviewQueue(items));
  return items;
}

export function reviewItem(id: string, result: ReviewResult) {
  const now = new Date();
  const items = loadItems().map((item) => {
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

  saveItems(items);
  return sortReviewQueue(items);
}
