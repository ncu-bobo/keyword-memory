<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import {
  BookOpenCheck,
  ClipboardPaste,
  LogOut,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Star,
  Tags,
  Trash2,
  UserRound,
  X
} from "lucide-vue-next";
import {
  createLocalKnowledgeItem,
  sortReviewQueue,
  splitKeywords,
  type KnowledgeItem
} from "@keyword-memory/core";
import {
  addItems,
  deleteItem,
  getCurrentUser,
  isSupabaseConfigured,
  loadItems,
  saveItems,
  signInOrSignUp,
  signOut
} from "./storage";

type Tab = "capture" | "review" | "me";
type CaptureMode = "manual" | "ai";
type ReviewMode = "sample" | "all";

const activeTab = ref<Tab>("capture");
const captureMode = ref<CaptureMode>("ai");
const items = ref<KnowledgeItem[]>([]);
const title = ref("");
const keywordBlocks = ref<string[]>([""]);
const tag = ref("");
const pinned = ref(false);
const sourceText = ref("");
const sourceExcerpt = ref("");
const parseStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const revealedId = ref<string | null>(null);
const toast = ref("");
const supabaseReady = isSupabaseConfigured();
const authEmail = ref("");
const authPassword = ref("");
const currentUserEmail = ref("");
const aiBaseUrl = ref("");
const aiApiKey = ref("");
const aiHasApiKey = ref(false);
const aiConfigStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
const syncStatus = ref<"local" | "signed-out" | "syncing" | "synced" | "error">(
  supabaseReady ? "signed-out" : "local"
);
const reviewMode = ref<ReviewMode>("sample");
const sampledReviewIds = ref<string[]>([]);

const manualKeywords = computed(() =>
  Array.from(new Set(keywordBlocks.value.map((keyword) => keyword.trim()).filter(Boolean)))
);
const tags = computed(() =>
  Array.from(new Set(items.value.map((item) => item.tag).filter(Boolean) as string[]))
);
const savedCount = computed(() => items.value.length);
const reviewItems = computed(() =>
  reviewMode.value === "all" ? sortReviewQueue(items.value) : getSampledReviewItems()
);
const syncLabel = computed(() => {
  if (!supabaseReady) {
    return "未配置 Supabase";
  }

  if (syncStatus.value === "syncing") {
    return "同步中";
  }

  if (syncStatus.value === "synced") {
    return "已连接";
  }

  if (syncStatus.value === "error") {
    return "同步异常";
  }

  return "未登录";
});

function shuffleItems(sourceItems: KnowledgeItem[]) {
  return [...sourceItems]
    .map((item) => ({ item, rank: Math.random() }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ item }) => item);
}

function getSampledReviewItems() {
  const byId = new Map(items.value.map((item) => [item.id, item]));
  const sampledItems = sampledReviewIds.value
    .map((id) => byId.get(id))
    .filter((item): item is KnowledgeItem => Boolean(item));

  if (sampledItems.length > 0 || items.value.length === 0) {
    return sampledItems;
  }

  const nextItems = shuffleItems(items.value).slice(0, 5);
  sampledReviewIds.value = nextItems.map((item) => item.id);
  return nextItems;
}

function setReviewMode(mode: ReviewMode) {
  reviewMode.value = mode;
  if (mode === "sample" && sampledReviewIds.value.length === 0) {
    reshuffleReviewItems();
  }
  revealedId.value = null;
}

function reshuffleReviewItems() {
  const previousIds = new Set(sampledReviewIds.value);
  const candidates = items.value.filter((item) => !previousIds.has(item.id));
  const sourceItems = candidates.length > 0 ? candidates : items.value;
  sampledReviewIds.value = shuffleItems(sourceItems).slice(0, 5).map((item) => item.id);
  revealedId.value = null;
}

function showToast(message: string) {
  toast.value = message;
  window.setTimeout(() => {
    if (toast.value === message) {
      toast.value = "";
    }
  }, 2200);
}

function clearManual() {
  title.value = "";
  keywordBlocks.value = [""];
  tag.value = "";
  pinned.value = false;

  if (captureMode.value === "ai") {
    sourceText.value = "";
    sourceExcerpt.value = "";
    parseStatus.value = "idle";
  }
}

async function addKeywordBlock() {
  keywordBlocks.value = [...keywordBlocks.value, ""];
  await nextTick();
  const inputs = document.querySelectorAll<HTMLInputElement>(".keyword-block input");
  inputs[inputs.length - 1]?.focus();
}

function removeKeywordBlock(index: number) {
  if (keywordBlocks.value.length === 1) {
    keywordBlocks.value = [""];
    return;
  }

  keywordBlocks.value = keywordBlocks.value.filter((_, currentIndex) => currentIndex !== index);
}

function updateKeywordBlock(index: number, value: string) {
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

async function pasteClipboard() {
  const text = (await window.keywordMemory?.readClipboardText?.()) ?? "";
  if (!text.trim()) {
    showToast("剪贴板是空的");
    return;
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  title.value = lines[0]?.slice(0, 42) ?? "";
  const pastedKeywords = splitKeywords(lines.slice(1).join(" ") || text).slice(0, 10);
  keywordBlocks.value = pastedKeywords.length > 0 ? pastedKeywords : [""];
  showToast("已从剪贴板拆入标题和关键词");
}

async function saveManual() {
  if (!title.value.trim() || manualKeywords.value.length === 0) {
    showToast("标题和关键词都要填");
    return;
  }

  const item = createLocalKnowledgeItem({
    title: title.value,
    keywords: manualKeywords.value.join("、"),
    tag: tag.value,
    pinned: pinned.value
  });
  const trimmedSource = captureMode.value === "ai" ? sourceText.value.trim() : "";
  const nextItem: KnowledgeItem = trimmedSource
    ? {
        ...item,
        sourceText: trimmedSource,
        sourceExcerpt: sourceExcerpt.value || trimmedSource.slice(0, 120)
      }
    : item;

  items.value = await addItems([nextItem]);
  syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
  clearManual();
  showToast("已保存，进入复习队列");
}

async function parseSourceText() {
  if (!sourceText.value.trim()) {
    showToast("先粘贴一段原文");
    return;
  }

  parseStatus.value = "loading";
  sourceExcerpt.value = "";

  try {
    if (!window.keywordMemory?.parseKnowledgeText) {
      throw new Error("Electron AI bridge is unavailable.");
    }

    const parsed = await window.keywordMemory.parseKnowledgeText(sourceText.value.trim());

    title.value = parsed.title;
    keywordBlocks.value = parsed.keywords.length > 0 ? parsed.keywords : [""];
    tag.value = parsed.tag ?? "";
    sourceExcerpt.value = parsed.sourceExcerpt ?? sourceText.value.trim().slice(0, 120);
    parseStatus.value = "ready";
    showToast("已提炼为一个知识点");
  } catch (error) {
    console.error("[keyword-memory] AI parse failed", error);
    parseStatus.value = "error";
    showToast("AI 解析失败，请检查本地 AI 配置");
  }
}

async function togglePin(item: KnowledgeItem) {
  items.value = items.value.map((current) =>
    current.id === item.id ? { ...current, pinned: !current.pinned, updatedAt: new Date().toISOString() } : current
  );
  await saveItems(items.value);
  syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
}

async function handleDeleteItem(item: KnowledgeItem) {
  if (!window.confirm(`删除「${item.title}」？`)) {
    return;
  }

  const previousItems = items.value;
  const previousSampledIds = sampledReviewIds.value;
  const nextItems = sortReviewQueue(previousItems.filter((current) => current.id !== item.id));

  items.value = nextItems;
  sampledReviewIds.value = sampledReviewIds.value.filter((id) => id !== item.id);
  if (reviewMode.value === "sample" && sampledReviewIds.value.length === 0) {
    reshuffleReviewItems();
  }
  syncStatus.value = currentUserEmail.value ? "syncing" : syncStatus.value;
  showToast(currentUserEmail.value ? "已删除，正在同步" : "知识点已删除");

  try {
    await deleteItem(item.id);
    syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
  } catch {
    items.value = previousItems;
    sampledReviewIds.value = previousSampledIds;
    syncStatus.value = currentUserEmail.value ? "error" : syncStatus.value;
    showToast("删除失败，已恢复");
  }
}

async function refreshItems() {
  syncStatus.value = currentUserEmail.value ? "syncing" : syncStatus.value;
  try {
    items.value = await loadItems();
    if (reviewMode.value === "sample") {
      reshuffleReviewItems();
    }
    syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
  } catch {
    syncStatus.value = "error";
    items.value = await loadItems();
    if (reviewMode.value === "sample") {
      reshuffleReviewItems();
    }
  }
}

async function refreshAuthState() {
  const user = await getCurrentUser();
  currentUserEmail.value = user?.email ?? "";
  syncStatus.value = !supabaseReady ? "local" : currentUserEmail.value ? "synced" : "signed-out";
}

async function handleAuth() {
  if (!authEmail.value.trim() || authPassword.value.length < 6) {
    showToast("请输入邮箱和至少 6 位密码");
    return;
  }

  syncStatus.value = "syncing";

  try {
    const result = await signInOrSignUp(authEmail.value, authPassword.value);
    await refreshAuthState();
    await refreshItems();
    authPassword.value = "";

    if (result.needsConfirmation) {
      showToast("已创建账号，请先在邮箱里确认注册");
      return;
    }

    showToast("Supabase 已连接并同步");
  } catch {
    syncStatus.value = "error";
    showToast("登录失败，请检查邮箱、密码或 Supabase 配置");
  }
}

async function handleSignOut() {
  await signOut();
  currentUserEmail.value = "";
  syncStatus.value = supabaseReady ? "signed-out" : "local";
  showToast("已退出云同步，本地数据仍可使用");
}

async function refreshAiConfig() {
  const config = await window.keywordMemory?.getAiConfig?.();
  if (!config) {
    return;
  }

  aiBaseUrl.value = config.baseUrl;
  aiHasApiKey.value = config.hasApiKey;
}

async function saveAiSettings() {
  if (!aiBaseUrl.value.trim()) {
    showToast("请填写 Base URL");
    return;
  }

  aiConfigStatus.value = "saving";

  try {
    const config = await window.keywordMemory?.saveAiConfig?.({
      baseUrl: aiBaseUrl.value,
      apiKey: aiApiKey.value
    });

    if (!config) {
      throw new Error("Electron AI config bridge is unavailable.");
    }

    aiBaseUrl.value = config.baseUrl;
    aiHasApiKey.value = config.hasApiKey;
    aiApiKey.value = "";
    aiConfigStatus.value = "saved";
    showToast("AI API 配置已保存");
  } catch {
    aiConfigStatus.value = "error";
    showToast("AI API 配置保存失败");
  }
}

async function clearAiSettings() {
  const config = await window.keywordMemory?.clearAiConfig?.();
  if (!config) {
    showToast("AI API 配置清除失败");
    return;
  }

  aiBaseUrl.value = config.baseUrl;
  aiHasApiKey.value = config.hasApiKey;
  aiApiKey.value = "";
  aiConfigStatus.value = "idle";
  showToast("已清除本地 AI API 配置");
}

onMounted(async () => {
  await refreshAuthState();
  await refreshItems();
  await refreshAiConfig();
  window.keywordMemory?.onQuickCapture(() => {
    activeTab.value = "capture";
    captureMode.value = "ai";
  });
});
</script>

<template>
  <main class="shell">
    <aside class="rail">
      <div class="brand">
        <div class="brand-mark">K</div>
        <div>
          <strong>Keyword</strong>
          <span>Memory</span>
        </div>
      </div>

      <nav class="tabs" aria-label="Main">
        <button :class="{ active: activeTab === 'capture' }" @click="activeTab = 'capture'">
          <ClipboardPaste :size="18" />
          首页
        </button>
        <button :class="{ active: activeTab === 'review' }" @click="activeTab = 'review'">
          <BookOpenCheck :size="18" />
          复习
          <small v-if="savedCount">{{ savedCount }}</small>
        </button>
        <button :class="{ active: activeTab === 'me' }" @click="activeTab = 'me'">
          <UserRound :size="18" />
          我的
        </button>
      </nav>

      <div class="rail-card">
        <span>已保存</span>
        <strong>{{ savedCount }}</strong>
        <em>Command + Shift + K 唤起速记</em>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p>{{ activeTab === 'capture' ? '极速录入' : activeTab === 'review' ? '遮罩回忆' : '同步与分类' }}</p>
          <h1>{{ activeTab === 'capture' ? '把干货压成关键词' : activeTab === 'review' ? '先想起来，再揭晓' : '你的记忆库' }}</h1>
        </div>
        <div class="search-box">
          <Search :size="17" />
          <input placeholder="搜索标题、关键词、标签" />
        </div>
      </header>

      <div
        v-if="activeTab === 'capture'"
        class="capture-grid manual-mode"
      >
        <section class="panel capture-panel">
          <div class="segmented">
            <button :class="{ active: captureMode === 'ai' }" @click="captureMode = 'ai'">AI 原文解析</button>
            <button :class="{ active: captureMode === 'manual' }" @click="captureMode = 'manual'">手动速记</button>
          </div>

          <div v-if="captureMode === 'manual'" class="form-stack">
            <label>
              <span>知识点标题</span>
              <input v-model="title" autofocus />
            </label>
            <label>
              <span>核心关键词</span>
              <div class="keyword-board">
                <div v-for="(_, index) in keywordBlocks" :key="index" class="keyword-block">
                  <input
                    :value="keywordBlocks[index]"
                    @input="updateKeywordBlock(index, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    type="button"
                    class="keyword-remove"
                    title="移除关键词"
                    @click="removeKeywordBlock(index)"
                  >
                    <X :size="15" />
                  </button>
                </div>
                <button type="button" class="keyword-add" @click="addKeywordBlock">
                  <Plus :size="16" />
                  添加关键词
                </button>
              </div>
            </label>
            <div v-if="manualKeywords.length" class="keyword-preview">
              <span v-for="keyword in manualKeywords" :key="keyword">{{ keyword }}</span>
            </div>
            <label>
              <span>归属标签</span>
              <input v-model="tag" />
            </label>

            <div class="action-row">
              <button class="icon-button" :class="{ selected: pinned }" title="快捷置顶" @click="pinned = !pinned">
                <Star :size="18" />
              </button>
              <button class="soft-button" @click="pasteClipboard">
                <ClipboardPaste :size="17" />
                快捷粘贴
              </button>
              <button class="soft-button" @click="clearManual">
                <Trash2 :size="17" />
                清空
              </button>
              <button class="primary-button" @click="saveManual">
                <Save :size="17" />
                保存
              </button>
            </div>
          </div>

          <div v-else class="form-stack">
            <label>
              <span>AI 原文</span>
              <textarea v-model="sourceText" class="source-input" rows="10" />
            </label>
            <div class="action-row">
              <button class="soft-button" :disabled="parseStatus === 'loading'" @click="parseSourceText">
                <Sparkles :size="17" />
                {{ parseStatus === 'loading' ? '解析中' : parseStatus === 'ready' ? '重新解析' : '解析' }}
              </button>
            </div>

            <p v-if="parseStatus === 'error'" class="inline-status">解析失败，请检查本地 AI 配置后重试。</p>

            <label>
              <span>知识点标题</span>
              <input v-model="title" />
            </label>
            <label>
              <span>核心关键词</span>
              <div class="keyword-board">
                <div v-for="(_, index) in keywordBlocks" :key="index" class="keyword-block">
                  <input
                    :value="keywordBlocks[index]"
                    @input="updateKeywordBlock(index, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    type="button"
                    class="keyword-remove"
                    title="移除关键词"
                    @click="removeKeywordBlock(index)"
                  >
                    <X :size="15" />
                  </button>
                </div>
                <button type="button" class="keyword-add" @click="addKeywordBlock">
                  <Plus :size="16" />
                  添加关键词
                </button>
              </div>
            </label>
            <div v-if="manualKeywords.length" class="keyword-preview">
              <span v-for="keyword in manualKeywords" :key="keyword">{{ keyword }}</span>
            </div>
            <label>
              <span>归属标签</span>
              <input v-model="tag" />
            </label>

            <div class="action-row">
              <button class="icon-button" :class="{ selected: pinned }" title="快捷置顶" @click="pinned = !pinned">
                <Star :size="18" />
              </button>
              <button class="soft-button" @click="clearManual">
                <Trash2 :size="17" />
                清空
              </button>
              <button class="primary-button" @click="saveManual">
                <Save :size="17" />
                保存
              </button>
            </div>
          </div>
        </section>
      </div>

      <section v-if="activeTab === 'review'" class="review-list">
        <div class="review-toolbar">
          <div>
            <strong>{{ reviewMode === 'all' ? '全部知识点' : '随机五个' }}</strong>
            <span>共 {{ savedCount }} 条，当前展示 {{ reviewItems.length }} 条</span>
          </div>
          <div class="review-tools">
            <button class="soft-button" :class="{ selected: reviewMode === 'sample' }" @click="setReviewMode('sample')">
              随机五个
            </button>
            <button v-if="reviewMode === 'sample'" class="soft-button" @click="reshuffleReviewItems">
              <RotateCcw :size="17" />
              换一组
            </button>
            <button class="soft-button" :class="{ selected: reviewMode === 'all' }" @click="setReviewMode('all')">
              全部展示
            </button>
          </div>
        </div>

        <article v-if="reviewItems.length === 0" class="panel empty-review">
          <BookOpenCheck :size="42" />
          <h2>还没有可复习的知识点</h2>
          <p>新保存的知识点会自动进入这里。</p>
        </article>

        <article v-for="item in reviewItems" :key="item.id" class="review-card">
          <div class="review-card-head">
            <span>{{ item.tag || '未分类' }}</span>
            <div class="card-actions">
              <button class="icon-button" :class="{ selected: item.pinned }" title="置顶" @click="togglePin(item)">
                <Star :size="17" />
              </button>
              <button class="icon-button danger" title="删除知识点" @click="handleDeleteItem(item)">
                <Trash2 :size="17" />
              </button>
            </div>
          </div>
          <h2>{{ item.title }}</h2>
          <button class="mask" @click="revealedId = revealedId === item.id ? null : item.id">
            <span v-if="revealedId !== item.id">点击揭晓关键词</span>
            <strong v-else>{{ item.keywords.join('  /  ') }}</strong>
          </button>
        </article>
      </section>

      <section v-if="activeTab === 'me'" class="me-grid">
        <article class="panel stat-panel">
          <Tags :size="22" />
          <strong>{{ tags.length }}</strong>
          <span>分类标签</span>
        </article>
        <article class="panel stat-panel">
          <BookOpenCheck :size="22" />
          <strong>{{ savedCount }}</strong>
          <span>可复习条目</span>
        </article>
        <article class="panel settings-panel">
          <div class="panel-heading">
            <Settings :size="19" />
            <strong>同步设置</strong>
          </div>
          <div class="sync-status" :class="syncStatus">
            <span>{{ syncLabel }}</span>
            <small v-if="currentUserEmail">{{ currentUserEmail }}</small>
            <small v-else-if="supabaseReady">登录后会自动合并本地与云端知识点。</small>
            <small v-else>请先填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。</small>
          </div>

          <div v-if="supabaseReady && !currentUserEmail" class="auth-form">
            <label>
              <span>邮箱</span>
              <input v-model="authEmail" type="email" placeholder="you@example.com" />
            </label>
            <label>
              <span>密码</span>
              <input v-model="authPassword" type="password" placeholder="至少 6 位" @keydown.enter="handleAuth" />
            </label>
            <button class="primary-button" :disabled="syncStatus === 'syncing'" @click="handleAuth">
              <Mail :size="17" />
              登录 / 注册
            </button>
          </div>

          <div v-if="supabaseReady && currentUserEmail" class="sync-actions">
            <button class="soft-button" :disabled="syncStatus === 'syncing'" @click="refreshItems">
              <RotateCcw :size="17" />
              立即同步
            </button>
            <button class="soft-button" @click="handleSignOut">
              <LogOut :size="17" />
              退出
            </button>
          </div>
        </article>
        <article class="panel tag-panel">
          <div class="panel-heading">
            <Tags :size="19" />
            <strong>标签</strong>
          </div>
          <button v-for="name in tags" :key="name">{{ name }}</button>
          <p v-if="tags.length === 0">还没有标签。</p>
        </article>
        <article class="panel settings-panel ai-settings-panel">
          <div class="panel-heading">
            <Sparkles :size="19" />
            <strong>AI API 配置</strong>
          </div>
          <div class="sync-status" :class="aiConfigStatus">
            <span>{{ aiHasApiKey ? 'API Key 已配置' : '未配置 API Key' }}</span>
            <small>Base URL 会用于 AI 原文解析；API Key 留空保存时会保留现有值。</small>
          </div>

          <div class="auth-form">
            <label>
              <span>Base URL</span>
              <input v-model="aiBaseUrl" />
            </label>
            <label>
              <span>API Key</span>
              <input v-model="aiApiKey" type="password" :placeholder="aiHasApiKey ? '已配置，留空保持不变' : ''" />
            </label>
            <div class="sync-actions">
              <button class="primary-button" :disabled="aiConfigStatus === 'saving'" @click="saveAiSettings">
                <Save :size="17" />
                保存配置
              </button>
              <button class="soft-button" @click="clearAiSettings">
                <Trash2 :size="17" />
                清除本地配置
              </button>
            </div>
          </div>
        </article>
      </section>
    </section>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </main>
</template>
