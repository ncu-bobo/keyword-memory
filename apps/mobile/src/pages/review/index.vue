<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { sortReviewQueue, type KnowledgeItem } from "@keyword-memory/core";
import { deleteItem, loadItems, togglePin } from "../../store";

const items = ref<KnowledgeItem[]>([]);
const revealedId = ref<string | null>(null);
const reviewMode = ref<"sample" | "all">("sample");
const sampledIds = ref<string[]>([]);
const visibleItems = computed(() => {
  if (reviewMode.value === "all") {
    return sortReviewQueue(items.value);
  }

  const byId = new Map(items.value.map((item) => [item.id, item]));
  return sampledIds.value
    .map((id) => byId.get(id))
    .filter((item): item is KnowledgeItem => Boolean(item));
});

function refresh() {
  items.value = loadItems();
  if (reviewMode.value === "sample" && sampledIds.value.length === 0) {
    reshuffle();
  }
}

function shuffle(sourceItems: KnowledgeItem[]) {
  return [...sourceItems]
    .map((item) => ({ item, rank: Math.random() }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ item }) => item);
}

function setMode(mode: "sample" | "all") {
  reviewMode.value = mode;
  revealedId.value = null;
  if (mode === "sample" && sampledIds.value.length === 0) {
    reshuffle();
  }
}

function reshuffle() {
  const previousIds = new Set(sampledIds.value);
  const candidates = items.value.filter((item) => !previousIds.has(item.id));
  const sourceItems = candidates.length > 0 ? candidates : items.value;
  sampledIds.value = shuffle(sourceItems).slice(0, 5).map((item) => item.id);
  revealedId.value = null;
}

function pin(id: string) {
  togglePin(id);
  refresh();
}

function remove(item: KnowledgeItem) {
  uni.showModal({
    title: "删除知识点",
    content: `确认删除「${item.title}」？`,
    success: async (result) => {
      if (!result.confirm) {
        return;
      }

      const previousItems = items.value;
      const previousSampledIds = sampledIds.value;
      items.value = previousItems.filter((current) => current.id !== item.id);
      sampledIds.value = sampledIds.value.filter((id) => id !== item.id);

      try {
        await deleteItem(item.id);
        uni.showToast({ title: "已删除", icon: "none" });
      } catch {
        items.value = previousItems;
        sampledIds.value = previousSampledIds;
        uni.showToast({ title: "删除失败，已恢复", icon: "none" });
      }
    }
  });
}

onShow(refresh);
</script>

<template>
  <view class="screen">
    <view class="hero">
      <view class="eyebrow">遮罩回忆</view>
      <view class="title">先想起来，再揭晓</view>
    </view>

    <view class="panel review-toolbar">
      <view>
        <view class="tag">{{ reviewMode === "all" ? "全部知识点" : "随机五个" }}</view>
        <view class="muted">共 {{ items.length }} 条，当前展示 {{ visibleItems.length }} 条</view>
      </view>
      <view class="review-actions">
        <view class="button" :class="{ selected: reviewMode === 'sample' }" @tap="setMode('sample')">随机五个</view>
        <view v-if="reviewMode === 'sample'" class="button" @tap="reshuffle">换一组</view>
        <view class="button" :class="{ selected: reviewMode === 'all' }" @tap="setMode('all')">全部展示</view>
      </view>
    </view>

    <view v-if="visibleItems.length === 0" class="panel" style="padding: 42px 18px; text-align: center; margin-top: 12px;">
      <view class="card-title">还没有可复习的知识点</view>
      <view class="muted" style="margin-top: 8px;">新保存的知识点会自动进入这里。</view>
    </view>

    <view v-for="item in visibleItems" :key="item.id" class="panel" style="margin-top: 12px; padding: 14px;">
      <view style="display: flex; justify-content: space-between; align-items: center;">
        <view class="tag">{{ item.tag || '未分类' }}</view>
        <view style="display: flex; gap: 8px;">
          <view class="button" :class="{ selected: item.pinned }" style="flex: 0 0 64px;" @tap="pin(item.id)">置顶</view>
          <view class="button danger" style="flex: 0 0 64px;" @tap="remove(item)">删除</view>
        </view>
      </view>
      <view class="card-title">{{ item.title }}</view>
      <view
        style="display: grid; place-items: center; min-height: 86px; margin-top: 14px; border: 1px dashed #b9ae9b; border-radius: 8px; background: #fffaf0;"
        @tap="revealedId = revealedId === item.id ? null : item.id"
      >
        <view v-if="revealedId !== item.id" class="muted">点击揭晓关键词</view>
        <view v-else style="padding: 12px; text-align: center; font-weight: 900;">{{ item.keywords.join(' / ') }}</view>
      </view>
    </view>
  </view>
</template>
