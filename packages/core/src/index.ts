export type ReviewResult = "forgot" | "vague" | "remembered";

export interface KnowledgeItem {
  id: string;
  userId?: string;
  title: string;
  keywords: string[];
  tag?: string;
  pinned: boolean;
  sourceText?: string;
  sourceUrl?: string;
  sourceExcerpt?: string;
  reviewAt: string;
  reviewLevel: number;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedKnowledgeItem {
  title: string;
  keywords: string[];
  tag?: string;
  sourceExcerpt?: string;
}

export interface ManualCaptureInput {
  title: string;
  keywords: string;
  tag?: string;
  pinned?: boolean;
}

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 15, 30, 60] as const;

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function splitKeywords(value: string): string[] {
  return value
    .split(/[\n,，、\s]+/g)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((keyword, index, all) => all.indexOf(keyword) === index);
}

export function createLocalKnowledgeItem(input: ManualCaptureInput): KnowledgeItem {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: input.title.trim(),
    keywords: splitKeywords(input.keywords),
    tag: input.tag?.trim() || undefined,
    pinned: Boolean(input.pinned),
    reviewAt: now,
    reviewLevel: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function scheduleNextReview(
  currentLevel: number,
  result: ReviewResult,
  fromDate = new Date()
): { reviewAt: string; reviewLevel: number } {
  const next = new Date(fromDate);

  if (result === "forgot") {
    next.setMinutes(next.getMinutes() + 10);
    return { reviewAt: next.toISOString(), reviewLevel: 0 };
  }

  if (result === "vague") {
    next.setDate(next.getDate() + 1);
    return { reviewAt: next.toISOString(), reviewLevel: Math.max(0, currentLevel) };
  }

  const reviewLevel = Math.min(currentLevel + 1, REVIEW_INTERVAL_DAYS.length - 1);
  next.setDate(next.getDate() + REVIEW_INTERVAL_DAYS[reviewLevel]);
  return { reviewAt: next.toISOString(), reviewLevel };
}

export function isDueForReview(item: Pick<KnowledgeItem, "reviewAt">, at = new Date()): boolean {
  return new Date(item.reviewAt).getTime() <= at.getTime();
}

export function sortReviewQueue(items: KnowledgeItem[]): KnowledgeItem[] {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(left.reviewAt).getTime() - new Date(right.reviewAt).getTime();
  });
}
