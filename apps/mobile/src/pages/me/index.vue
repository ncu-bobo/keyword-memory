<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import type { KnowledgeItem } from "@keyword-memory/core";
import { getDueItems, loadItems } from "../../store";

const items = ref<KnowledgeItem[]>([]);
const dueCount = ref(0);
const tags = computed(() =>
  Array.from(new Set(items.value.map((item) => item.tag).filter(Boolean) as string[]))
);

onShow(() => {
  items.value = loadItems();
  dueCount.value = getDueItems().length;
});
</script>

<template>
  <view class="screen">
    <view class="hero">
      <view class="eyebrow">同步与分类</view>
      <view class="title">你的记忆库</view>
    </view>

    <view style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <view class="panel" style="padding: 18px; text-align: center;">
        <view class="card-title">{{ items.length }}</view>
        <view class="muted">已保存</view>
      </view>
      <view class="panel" style="padding: 18px; text-align: center;">
        <view class="card-title">{{ dueCount }}</view>
        <view class="muted">今日复习</view>
      </view>
    </view>

    <view class="panel" style="padding: 14px; margin-top: 12px;">
      <view class="tag">同步设置</view>
      <view class="muted" style="margin-top: 8px;">Supabase 登录、云同步、导出会在下一阶段接入。</view>
    </view>

    <view class="panel" style="padding: 14px; margin-top: 12px;">
      <view class="tag">标签</view>
      <view v-if="tags.length === 0" class="muted" style="margin-top: 8px;">还没有标签。</view>
      <view v-else style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
        <view v-for="name in tags" :key="name" class="button" style="flex: 0 0 auto; padding: 0 12px;">{{ name }}</view>
      </view>
    </view>
  </view>
</template>
