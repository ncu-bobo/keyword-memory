<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import type { KnowledgeItem, ReviewResult } from "@keyword-memory/core";
import { getDueItems, recordReview, togglePin } from "../../store";

const items = ref<KnowledgeItem[]>([]);
const revealedId = ref<string | null>(null);

function refresh() {
  items.value = getDueItems();
}

function review(id: string, result: ReviewResult) {
  recordReview(id, result);
  revealedId.value = null;
  refresh();
}

function pin(id: string) {
  togglePin(id);
  refresh();
}

onShow(refresh);
</script>

<template>
  <view class="screen">
    <view class="hero">
      <view class="eyebrow">遮罩回忆</view>
      <view class="title">先想起来，再揭晓</view>
    </view>

    <view v-if="items.length === 0" class="panel" style="padding: 42px 18px; text-align: center;">
      <view class="card-title">今天没有待复习</view>
      <view class="muted" style="margin-top: 8px;">新保存的知识点会自动进入这里。</view>
    </view>

    <view v-for="item in items" :key="item.id" class="panel" style="margin-top: 12px; padding: 14px;">
      <view style="display: flex; justify-content: space-between; align-items: center;">
        <view class="tag">{{ item.tag || '未分类' }}</view>
        <view class="button" :class="{ selected: item.pinned }" style="flex: 0 0 64px;" @tap="pin(item.id)">置顶</view>
      </view>
      <view class="card-title">{{ item.title }}</view>
      <view
        style="display: grid; place-items: center; min-height: 86px; margin-top: 14px; border: 1px dashed #b9ae9b; border-radius: 8px; background: #fffaf0;"
        @tap="revealedId = revealedId === item.id ? null : item.id"
      >
        <view v-if="revealedId !== item.id" class="muted">点击揭晓关键词</view>
        <view v-else style="padding: 12px; text-align: center; font-weight: 900;">{{ item.keywords.join(' / ') }}</view>
      </view>
      <view class="button-row">
        <view class="button" @tap="review(item.id, 'forgot')">忘了</view>
        <view class="button" @tap="review(item.id, 'vague')">模糊</view>
        <view class="button primary" @tap="review(item.id, 'remembered')">记住了</view>
      </view>
    </view>
  </view>
</template>
