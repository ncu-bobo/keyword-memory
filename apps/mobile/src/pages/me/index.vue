<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import type { KnowledgeItem } from "@keyword-memory/core";
import {
  clearAiConfig,
  getAiConfig,
  getCurrentUser,
  isSupabaseConfigured,
  loadItems,
  saveAiConfig,
  signInOrSignUp,
  signOut,
  syncWithCloud
} from "../../store";

const items = ref<KnowledgeItem[]>([]);
const email = ref("");
const password = ref("");
const currentUser = ref<Awaited<ReturnType<typeof getCurrentUser>>>(null);
const authMessage = ref("");
const isBusy = ref(false);
const isSyncing = ref(false);
const aiBaseUrl = ref("");
const aiApiKey = ref("");
const aiHasApiKey = ref(false);
const aiMessage = ref("");
const isSavingAi = ref(false);
const tags = computed(() =>
  Array.from(new Set(items.value.map((item) => item.tag).filter(Boolean) as string[]))
);
const isLoggedIn = computed(() => Boolean(currentUser.value));

function toast(title: string) {
  uni.showToast({ title, icon: "none" });
}

function refreshLocalStats() {
  items.value = loadItems();
}

async function refreshAccount() {
  refreshLocalStats();
  refreshAiConfig();
  if (!isSupabaseConfigured()) {
    authMessage.value = "Supabase 未配置";
    return;
  }

  currentUser.value = await getCurrentUser();
  if (currentUser.value) {
    await syncNow(false);
  }
}

async function syncNow(showToast = true) {
  if (!isSupabaseConfigured()) {
    toast("Supabase 未配置");
    return;
  }

  isSyncing.value = true;
  try {
    items.value = await syncWithCloud();
    authMessage.value = "同步完成";
    if (showToast) {
      toast("同步完成");
    }
  } catch (error) {
    authMessage.value = error instanceof Error ? error.message : "同步失败";
    if (showToast) {
      toast("同步失败");
    }
  } finally {
    isSyncing.value = false;
  }
}

function refreshAiConfig() {
  const config = getAiConfig();
  aiBaseUrl.value = config.baseUrl;
  aiHasApiKey.value = config.hasApiKey;
}

async function saveAiSettings() {
  if (!aiBaseUrl.value.trim()) {
    toast("请填写 Base URL");
    return;
  }

  isSavingAi.value = true;
  try {
    const config = saveAiConfig({
      baseUrl: aiBaseUrl.value,
      apiKey: aiApiKey.value
    });
    aiBaseUrl.value = config.baseUrl;
    aiHasApiKey.value = config.hasApiKey;
    aiApiKey.value = "";
    aiMessage.value = "AI API 配置已保存";
    toast("AI API 配置已保存");
  } catch {
    aiMessage.value = "AI API 配置保存失败";
    toast("保存失败");
  } finally {
    isSavingAi.value = false;
  }
}

function clearAiSettings() {
  const config = clearAiConfig();
  aiBaseUrl.value = config.baseUrl;
  aiHasApiKey.value = config.hasApiKey;
  aiApiKey.value = "";
  aiMessage.value = "已清除本地 AI API 配置";
  toast("已清除");
}

async function submitAuth() {
  if (!email.value.trim() || password.value.length < 6) {
    toast("请输入邮箱和至少 6 位密码");
    return;
  }

  isBusy.value = true;
  try {
    const result = await signInOrSignUp(email.value, password.value);
    currentUser.value = result.user;
    password.value = "";
    authMessage.value = result.needsConfirmation ? "已注册，请先完成邮箱确认" : "登录成功";
    await syncNow(false);
    toast(result.needsConfirmation ? "请确认邮箱" : "登录成功");
  } catch (error) {
    authMessage.value = error instanceof Error ? error.message : "登录失败";
    toast("登录失败");
  } finally {
    isBusy.value = false;
  }
}

async function logout() {
  isBusy.value = true;
  try {
    await signOut();
    currentUser.value = null;
    authMessage.value = "已退出";
    toast("已退出");
  } finally {
    isBusy.value = false;
  }
}

onShow(() => {
  void refreshAccount();
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
        <view class="card-title">{{ items.length }}</view>
        <view class="muted">可复习条目</view>
      </view>
    </view>

    <view class="panel" style="padding: 14px; margin-top: 12px;">
      <view class="tag">同步设置</view>
      <view v-if="!isSupabaseConfigured()" class="muted" style="margin-top: 8px;">当前安装包未配置 Supabase。</view>

      <template v-else-if="isLoggedIn">
        <view class="card-title" style="font-size: 20px;">已登录</view>
        <view class="muted" style="margin-top: 6px;">{{ currentUser?.email }}</view>
        <view v-if="authMessage" class="muted" style="margin-top: 6px;">{{ authMessage }}</view>
        <view class="button-row">
          <view class="button" @tap="syncNow()">{{ isSyncing ? "同步中" : "立即同步" }}</view>
          <view class="button" @tap="logout">退出</view>
        </view>
      </template>

      <template v-else>
        <view class="field">
          <view class="label">邮箱</view>
          <input v-model="email" class="input" type="text" placeholder="you@example.com" />
        </view>
        <view class="field">
          <view class="label">密码</view>
          <input v-model="password" class="input" password placeholder="至少 6 位" />
        </view>
        <view v-if="authMessage" class="muted" style="margin-top: 8px;">{{ authMessage }}</view>
        <view class="button-row">
          <view class="button primary" @tap="submitAuth">{{ isBusy ? "处理中" : "登录 / 注册" }}</view>
        </view>
      </template>
    </view>

    <view class="panel" style="padding: 14px; margin-top: 12px;">
      <view class="tag">AI API 配置</view>
      <view class="muted" style="margin-top: 8px;">{{ aiHasApiKey ? "API Key 已配置" : "未配置 API Key" }}</view>
      <view class="field">
        <view class="label">Base URL</view>
        <input v-model="aiBaseUrl" class="input" />
      </view>
      <view class="field">
        <view class="label">API Key</view>
        <input v-model="aiApiKey" class="input" password :placeholder="aiHasApiKey ? '已配置，留空保持不变' : ''" />
      </view>
      <view v-if="aiMessage" class="muted" style="margin-top: 8px;">{{ aiMessage }}</view>
      <view class="button-row">
        <view class="button primary" @tap="saveAiSettings">{{ isSavingAi ? "保存中" : "保存配置" }}</view>
        <view class="button" @tap="clearAiSettings">清除</view>
      </view>
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
