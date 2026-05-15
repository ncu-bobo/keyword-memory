<script setup lang="ts">
import { nextTick, ref } from "vue";
import { createLocalKnowledgeItem, splitKeywords, type KnowledgeItem } from "@keyword-memory/core";
import { addItems, parseClipboardText, parseKnowledgeText } from "../../store";

const mode = ref<"manual" | "ai">("ai");
const title = ref("");
const keywordBlocks = ref<string[]>([""]);
const tag = ref("");
const pinned = ref(false);
const sourceText = ref("");
const sourceExcerpt = ref("");
const parseStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const focusIndex = ref(-1);

function toast(title: string) {
  uni.showToast({ title, icon: "none" });
}

function getKeywords() {
  return Array.from(new Set(keywordBlocks.value.map((keyword) => keyword.trim()).filter(Boolean)));
}

function clearManual() {
  title.value = "";
  keywordBlocks.value = [""];
  tag.value = "";
  pinned.value = false;
  sourceExcerpt.value = "";
  parseStatus.value = "idle";

  if (mode.value === "ai") {
    sourceText.value = "";
  }
}

async function addKeywordBlock() {
  keywordBlocks.value = [...keywordBlocks.value, ""];
  focusIndex.value = keywordBlocks.value.length - 1;
  await nextTick();
  setTimeout(() => {
    focusIndex.value = -1;
  }, 200);
}

function removeKeywordBlock(index: number) {
  if (keywordBlocks.value.length === 1) {
    keywordBlocks.value = [""];
    return;
  }

  keywordBlocks.value = keywordBlocks.value.filter((_, currentIndex) => currentIndex !== index);
}

function updateKeywordBlock(index: number, event: unknown) {
  const value = (event as { detail?: { value?: string } }).detail?.value ?? "";
  const pastedKeywords = splitKeywords(value);

  if (pastedKeywords.length > 1) {
    keywordBlocks.value = [
      ...keywordBlocks.value.slice(0, index),
      ...pastedKeywords,
      ...keywordBlocks.value.slice(index + 1)
    ];
    return;
  }

  keywordBlocks.value = keywordBlocks.value.map((keyword, currentIndex) =>
    currentIndex === index ? value : keyword
  );
}

function pasteClipboard() {
  uni.getClipboardData({
    success: (result) => {
      const parsed = parseClipboardText(result.data);
      title.value = parsed.title;
      const parsedKeywords = splitKeywords(parsed.keywords);
      keywordBlocks.value = parsedKeywords.length > 0 ? parsedKeywords : [""];
      toast("已拆入表单");
    },
    fail: () => toast("读取剪贴板失败")
  });
}

function saveManual() {
  const keywords = getKeywords();
  if (!title.value.trim() || keywords.length === 0) {
    toast("标题和关键词必填");
    return;
  }

  const item = createLocalKnowledgeItem({
    title: title.value,
    keywords: keywords.join("、"),
    tag: tag.value,
    pinned: pinned.value
  });
  const trimmedSource = mode.value === "ai" ? sourceText.value.trim() : "";
  const nextItem: KnowledgeItem = trimmedSource
    ? {
        ...item,
        sourceText: trimmedSource,
        sourceExcerpt: sourceExcerpt.value || trimmedSource.slice(0, 120)
      }
    : item;

  addItems([nextItem]);
  clearManual();
  toast("已入复习队列");
}

async function parseSource() {
  if (!sourceText.value.trim()) {
    toast("先粘贴原文");
    return;
  }

  parseStatus.value = "loading";
  try {
    const parsed = await parseKnowledgeText(sourceText.value.trim());
    title.value = parsed.title;
    keywordBlocks.value = parsed.keywords.length > 0 ? parsed.keywords : [""];
    tag.value = parsed.tag ?? "";
    sourceExcerpt.value = parsed.sourceExcerpt ?? sourceText.value.trim().slice(0, 120);
    parseStatus.value = "ready";
    toast("已提炼为一个知识点");
  } catch {
    parseStatus.value = "error";
    toast("AI 解析失败，请检查配置");
  }
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
        <view class="segmented-item" :class="{ active: mode === 'ai' }" @tap="mode = 'ai'">AI 原文解析</view>
        <view class="segmented-item" :class="{ active: mode === 'manual' }" @tap="mode = 'manual'">手动速记</view>
      </view>

      <template v-if="mode === 'manual'">
        <view class="field">
          <view class="label">知识点标题</view>
          <input v-model="title" class="input" />
        </view>
        <view class="field">
          <view class="label">核心关键词</view>
          <view class="keyword-board">
            <view v-for="(_, index) in keywordBlocks" :key="index" class="keyword-block">
              <input
                class="keyword-input"
                :value="keywordBlocks[index]"
                :focus="focusIndex === index"
                @input="updateKeywordBlock(index, $event)"
              />
              <view class="keyword-remove" @tap="removeKeywordBlock(index)">×</view>
            </view>
            <view class="keyword-add" @tap="addKeywordBlock">添加关键词</view>
          </view>
        </view>
        <view class="field">
          <view class="label">归属标签</view>
          <input v-model="tag" class="input" />
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
          <view class="label">AI 原文</view>
          <textarea v-model="sourceText" class="textarea" style="min-height: 260px;" />
        </view>
        <view class="button-row">
          <view class="button" @tap="parseSource">{{ parseStatus === "loading" ? "解析中" : parseStatus === "ready" ? "重新解析" : "解析" }}</view>
        </view>
        <view v-if="parseStatus === 'error'" class="muted" style="margin-top: 8px;">解析失败，请先在“我的”页检查 AI API 配置。</view>

        <view class="field">
          <view class="label">知识点标题</view>
          <input v-model="title" class="input" />
        </view>
        <view class="field">
          <view class="label">核心关键词</view>
          <view class="keyword-board">
            <view v-for="(_, index) in keywordBlocks" :key="index" class="keyword-block">
              <input
                class="keyword-input"
                :value="keywordBlocks[index]"
                :focus="focusIndex === index"
                @input="updateKeywordBlock(index, $event)"
              />
              <view class="keyword-remove" @tap="removeKeywordBlock(index)">×</view>
            </view>
            <view class="keyword-add" @tap="addKeywordBlock">添加关键词</view>
          </view>
        </view>
        <view class="field">
          <view class="label">归属标签</view>
          <input v-model="tag" class="input" />
        </view>
        <view class="button-row">
          <view class="button" :class="{ selected: pinned }" @tap="pinned = !pinned">置顶</view>
          <view class="button" @tap="clearManual">清空</view>
          <view class="button primary" @tap="saveManual">保存</view>
        </view>
      </template>
    </view>
  </view>
</template>
