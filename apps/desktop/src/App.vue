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
  createId,
  isDueForReview,
  sortReviewQueue,
  splitKeywords,
  type KnowledgeItem,
  type ParsedKnowledgeItem,
  type ReviewResult
} from "@keyword-memory/core";
import {
  addItems,
  getCurrentUser,
  isSupabaseConfigured,
  loadItems,
  reviewItem,
  saveItems,
  signInOrSignUp,
  signOut
} from "./storage";

type Tab = "capture" | "review" | "me";
type CaptureMode = "manual" | "ai";

const activeTab = ref<Tab>("capture");
const captureMode = ref<CaptureMode>("manual");
const items = ref<KnowledgeItem[]>([]);
const title = ref("");
const keywordBlocks = ref<string[]>([""]);
const tag = ref("");
const pinned = ref(false);
const sourceText = ref("");
const parseStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const parsedItems = ref<ParsedKnowledgeItem[]>([]);
const revealedId = ref<string | null>(null);
const toast = ref("");
const supabaseReady = isSupabaseConfigured();
const authEmail = ref("");
const authPassword = ref("");
const currentUserEmail = ref("");
const syncStatus = ref<"local" | "signed-out" | "syncing" | "synced" | "error">(
  supabaseReady ? "signed-out" : "local"
);

const dueItems = computed(() => sortReviewQueue(items.value.filter((item) => isDueForReview(item))));
const manualKeywords = computed(() =>
  Array.from(new Set(keywordBlocks.value.map((keyword) => keyword.trim()).filter(Boolean)))
);
const tags = computed(() =>
  Array.from(new Set(items.value.map((item) => item.tag).filter(Boolean) as string[]))
);
const savedCount = computed(() => items.value.length);
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

  items.value = await addItems([item]);
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
  parsedItems.value = [];

  const functionUrl = import.meta.env.VITE_PARSE_FUNCTION_URL as string | undefined;

  try {
    if (!functionUrl) {
      parsedItems.value = fallbackParse(sourceText.value);
    } else {
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText.value,
          preferredTags: ["AI", "程序员技术", "股市投资", "通用知识"]
        })
      });
      const data = await response.json();
      parsedItems.value = data.items ?? [];
    }

    parseStatus.value = "ready";
    showToast("已拆解，可微调后保存");
  } catch {
    parseStatus.value = "error";
    showToast("解析失败，请稍后重试");
  }
}

function fallbackParse(text: string): ParsedKnowledgeItem[] {
  const chunks = text.split(/\n{2,}|。|；/).map((chunk) => chunk.trim()).filter(Boolean).slice(0, 5);
  return chunks.map((chunk) => ({
    title: chunk.slice(0, 28),
    keywords: splitKeywords(chunk).slice(0, 8),
    tag: "待分类",
    sourceExcerpt: chunk.slice(0, 120)
  }));
}

async function saveParsedItems() {
  const now = new Date().toISOString();
  const nextItems: KnowledgeItem[] = parsedItems.value
    .filter((item) => item.title.trim() && item.keywords.length > 0)
    .map((item) => ({
      id: createId(),
      title: item.title.trim(),
      keywords: item.keywords,
      tag: item.tag,
      pinned: false,
      sourceText: sourceText.value,
      sourceExcerpt: item.sourceExcerpt,
      reviewAt: now,
      reviewLevel: 0,
      createdAt: now,
      updatedAt: now
    }));

  if (nextItems.length === 0) {
    showToast("没有可保存的知识点");
    return;
  }

  items.value = await addItems(nextItems);
  syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
  sourceText.value = "";
  parsedItems.value = [];
  parseStatus.value = "idle";
  showToast(`已保存 ${nextItems.length} 条知识点`);
}

async function handleReview(id: string, result: ReviewResult) {
  items.value = await reviewItem(id, result);
  syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
  revealedId.value = null;
}

async function togglePin(item: KnowledgeItem) {
  items.value = items.value.map((current) =>
    current.id === item.id ? { ...current, pinned: !current.pinned, updatedAt: new Date().toISOString() } : current
  );
  await saveItems(items.value);
  syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
}

async function refreshItems() {
  syncStatus.value = currentUserEmail.value ? "syncing" : syncStatus.value;
  try {
    items.value = await loadItems();
    syncStatus.value = currentUserEmail.value ? "synced" : syncStatus.value;
  } catch {
    syncStatus.value = "error";
    items.value = await loadItems();
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

onMounted(async () => {
  await refreshAuthState();
  await refreshItems();
  window.keywordMemory?.onQuickCapture(() => {
    activeTab.value = "capture";
    captureMode.value = "manual";
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
          <small v-if="dueItems.length">{{ dueItems.length }}</small>
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
        class="capture-grid"
        :class="{ 'manual-mode': captureMode === 'manual' }"
      >
        <section class="panel capture-panel">
          <div class="segmented">
            <button :class="{ active: captureMode === 'manual' }" @click="captureMode = 'manual'">手动速记</button>
            <button :class="{ active: captureMode === 'ai' }" @click="captureMode = 'ai'">AI 原文解析</button>
          </div>

          <div v-if="captureMode === 'manual'" class="form-stack">
            <label>
              <span>知识点标题</span>
              <input v-model="title" autofocus placeholder="例如：React Hooks 闭包陷阱" />
            </label>
            <label>
              <span>核心关键词</span>
              <div class="keyword-board">
                <div v-for="(_, index) in keywordBlocks" :key="index" class="keyword-block">
                  <input
                    :value="keywordBlocks[index]"
                    :placeholder="index === 0 ? 'useEffect' : '关键词'"
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
              <input v-model="tag" placeholder="不强制，例如：程序员技术" />
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
              <span>原文</span>
              <textarea v-model="sourceText" class="source-input" rows="10" placeholder="粘贴文章、帖子、文案或干货笔记" />
            </label>
            <div class="action-row">
              <button class="soft-button" @click="parseSourceText">
                <RotateCcw :size="17" />
                {{ parseStatus === 'ready' ? '重试解析' : 'AI 拆解知识点' }}
              </button>
              <button class="primary-button" :disabled="parsedItems.length === 0" @click="saveParsedItems">
                <Save :size="17" />
                保存全部
              </button>
            </div>
          </div>
        </section>

        <section v-if="captureMode === 'ai'" class="panel result-panel">
          <div class="panel-heading">
            <Sparkles :size="19" />
            <strong>解析结果</strong>
          </div>
          <p v-if="parseStatus === 'idle'" class="empty">长文会被拆成独立知识点，保留标题、关键词、标签和原文溯源。</p>
          <p v-if="parseStatus === 'loading'" class="empty">正在剔除废话，只留下可复习的核心。</p>
          <p v-if="parseStatus === 'error'" class="empty">解析失败，可以重试或先手动保存。</p>

          <article v-for="(item, index) in parsedItems" :key="index" class="parsed-card">
            <input v-model="item.title" class="parsed-title" />
            <input v-model="item.tag" class="tag-input" />
            <textarea
              :value="item.keywords.join('、')"
              rows="2"
              @input="item.keywords = splitKeywords(($event.target as HTMLTextAreaElement).value)"
            />
            <small>{{ item.sourceExcerpt }}</small>
          </article>
        </section>
      </div>

      <section v-if="activeTab === 'review'" class="review-list">
        <article v-if="dueItems.length === 0" class="panel empty-review">
          <BookOpenCheck :size="42" />
          <h2>今天没有待复习</h2>
          <p>新保存的知识点会自动进入这里。</p>
        </article>

        <article v-for="item in dueItems" :key="item.id" class="review-card">
          <div class="review-card-head">
            <span>{{ item.tag || '未分类' }}</span>
            <button class="icon-button" :class="{ selected: item.pinned }" title="置顶" @click="togglePin(item)">
              <Star :size="17" />
            </button>
          </div>
          <h2>{{ item.title }}</h2>
          <button class="mask" @click="revealedId = revealedId === item.id ? null : item.id">
            <span v-if="revealedId !== item.id">点击揭晓关键词</span>
            <strong v-else>{{ item.keywords.join('  /  ') }}</strong>
          </button>
          <div class="review-actions">
            <button @click="handleReview(item.id, 'forgot')">忘了</button>
            <button @click="handleReview(item.id, 'vague')">模糊</button>
            <button class="primary-button" @click="handleReview(item.id, 'remembered')">记住了</button>
          </div>
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
          <strong>{{ dueItems.length }}</strong>
          <span>今日待复习</span>
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
      </section>
    </section>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </main>
</template>
