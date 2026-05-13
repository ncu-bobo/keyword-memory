<script setup lang="ts">
import { ref } from "vue";
import { splitKeywords, type ParsedKnowledgeItem } from "@keyword-memory/core";
import { addManualItem, addParsedItems, parseClipboardText } from "../../store";

const mode = ref<"manual" | "ai">("manual");
const title = ref("");
const keywords = ref("");
const tag = ref("");
const pinned = ref(false);
const sourceText = ref("");
const parsedItems = ref<ParsedKnowledgeItem[]>([]);

function toast(title: string) {
  uni.showToast({ title, icon: "none" });
}

function clearManual() {
  title.value = "";
  keywords.value = "";
  tag.value = "";
  pinned.value = false;
}

function pasteClipboard() {
  uni.getClipboardData({
    success: (result) => {
      const parsed = parseClipboardText(result.data);
      title.value = parsed.title;
      keywords.value = parsed.keywords;
      toast("已拆入表单");
    },
    fail: () => toast("读取剪贴板失败")
  });
}

function saveManual() {
  if (!title.value.trim() || splitKeywords(keywords.value).length === 0) {
    toast("标题和关键词必填");
    return;
  }

  addManualItem({
    title: title.value,
    keywords: keywords.value,
    tag: tag.value,
    pinned: pinned.value
  });
  clearManual();
  toast("已入复习队列");
}

function fallbackParse() {
  if (!sourceText.value.trim()) {
    toast("先粘贴原文");
    return;
  }

  parsedItems.value = sourceText.value
    .split(/\n{2,}|。|；/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((chunk) => ({
      title: chunk.slice(0, 28),
      keywords: splitKeywords(chunk).slice(0, 8),
      tag: "待分类",
      sourceExcerpt: chunk.slice(0, 100)
    }));
  toast("已生成预览");
}

function saveParsed() {
  if (parsedItems.value.length === 0) {
    toast("没有可保存内容");
    return;
  }

  addParsedItems(parsedItems.value, sourceText.value);
  parsedItems.value = [];
  sourceText.value = "";
  toast("已保存全部");
}

function updateParsedKeywords(index: number, event: unknown) {
  const value = (event as { detail?: { value?: string } }).detail?.value ?? "";
  parsedItems.value[index].keywords = splitKeywords(value);
}
</script>

<template>
  <view class="screen">
    <view class="hero">
      <view class="eyebrow">极速录入</view>
      <view class="title">把干货压成关键词</view>
    </view>

    <view class="panel" style="padding: 14px;">
      <view class="segmented">
        <view class="segmented-item" :class="{ active: mode === 'manual' }" @tap="mode = 'manual'">手动速记</view>
        <view class="segmented-item" :class="{ active: mode === 'ai' }" @tap="mode = 'ai'">AI 原文解析</view>
      </view>

      <template v-if="mode === 'manual'">
        <view class="field">
          <view class="label">知识点标题</view>
          <input v-model="title" class="input" placeholder="例如：均线多头排列" />
        </view>
        <view class="field">
          <view class="label">核心关键词</view>
          <textarea v-model="keywords" class="textarea" placeholder="均线、趋势、支撑、买点" />
        </view>
        <view class="field">
          <view class="label">归属标签</view>
          <input v-model="tag" class="input" placeholder="不强制" />
        </view>
        <view class="button-row">
          <view class="button" :class="{ selected: pinned }" @tap="pinned = !pinned">置顶</view>
          <view class="button" @tap="pasteClipboard">粘贴</view>
          <view class="button" @tap="clearManual">清空</view>
          <view class="button primary" @tap="saveManual">保存</view>
        </view>
      </template>

      <template v-else>
        <view class="field">
          <view class="label">原文</view>
          <textarea v-model="sourceText" class="textarea" style="min-height: 260px;" placeholder="粘贴文章、帖子、文案或干货笔记" />
        </view>
        <view class="button-row">
          <view class="button" @tap="fallbackParse">AI 拆解</view>
          <view class="button primary" @tap="saveParsed">保存全部</view>
        </view>

        <view v-for="(item, index) in parsedItems" :key="index" class="card">
          <input v-model="item.title" class="input" />
          <textarea
            class="textarea"
            :value="item.keywords.join('、')"
            @input="updateParsedKeywords(index, $event)"
          />
          <input v-model="item.tag" class="input" />
          <view class="muted">{{ item.sourceExcerpt }}</view>
        </view>
      </template>
    </view>
  </view>
</template>
