import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKnowledgeKeywordExtractionInput,
  KNOWLEDGE_KEYWORD_EXTRACTION_PROMPT
} from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const devServerUrl = process.env.VITE_DEV_SERVER_URL;

interface ParsedKnowledgePayload {
  title: string;
  keywords: string[];
  tag?: string;
  sourceExcerpt?: string;
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
}

interface AiConfig {
  baseUrl?: string;
  apiKey?: string;
}

interface AiConfigView {
  baseUrl: string;
  hasApiKey: boolean;
}

function getAiConfigPath() {
  return path.join(app.getPath("userData"), "ai-config.json");
}

function readSavedAiConfig(): AiConfig {
  try {
    const value = fs.readFileSync(getAiConfigPath(), "utf8");
    const config = JSON.parse(value) as AiConfig;

    return {
      baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : undefined,
      apiKey: typeof config.apiKey === "string" ? config.apiKey : undefined
    };
  } catch {
    return {};
  }
}

function getAiConfigView(): AiConfigView {
  const savedConfig = readSavedAiConfig();
  const baseUrl = savedConfig.baseUrl
    || readEnvValue("AI_API_ENDPOINT")
    || readEnvValue("VITE_AI_API_ENDPOINT")
    || readEnvValue("AI_BASE_URL")
    || readEnvValue("VITE_AI_BASE_URL")
    || "https://api.openai.com/v1";

  return {
    baseUrl,
    hasApiKey: Boolean(savedConfig.apiKey || readEnvValue("AI_API_KEY") || readEnvValue("VITE_AI_API_KEY"))
  };
}

function saveAiConfig(input: AiConfig): AiConfigView {
  const current = readSavedAiConfig();
  const nextConfig: AiConfig = {
    baseUrl: input.baseUrl?.trim() || current.baseUrl,
    apiKey: input.apiKey?.trim() || current.apiKey
  };

  fs.mkdirSync(path.dirname(getAiConfigPath()), { recursive: true });
  fs.writeFileSync(getAiConfigPath(), JSON.stringify(nextConfig, null, 2));
  return getAiConfigView();
}

function clearAiConfig(): AiConfigView {
  try {
    fs.rmSync(getAiConfigPath(), { force: true });
  } catch {
    // Nothing to clear.
  }

  return getAiConfigView();
}

function readLocalEnvFile() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "../.env"),
    path.join(app.getAppPath(), ".env")
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    return fs.readFileSync(filePath, "utf8");
  }

  return "";
}

function readEnvValue(name: string) {
  if (process.env[name]) {
    return process.env[name];
  }

  const localEnv = readLocalEnvFile();
  const matchedLine = localEnv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${name}=`));

  if (!matchedLine) {
    return undefined;
  }

  return matchedLine
    .slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("AI response did not contain JSON.");
}

function fallbackTitle(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/[。；.!?！？\n]/)
    .find(Boolean)
    ?.slice(0, 28) || "未命名知识点";
}

function normalizeParsedKnowledge(value: unknown, sourceText: string): ParsedKnowledgePayload {
  const parsed = (value ?? {}) as Partial<ParsedKnowledgePayload>;
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
    : [];

  return {
    title: String(parsed.title || fallbackTitle(sourceText)).trim().slice(0, 36),
    keywords: Array.from(new Set(keywords)).slice(0, 8),
    tag: parsed.tag ? String(parsed.tag).trim().slice(0, 16) : "AI",
    sourceExcerpt: String(parsed.sourceExcerpt || sourceText).trim().slice(0, 120)
  };
}

function extractAiContent(data: ChatCompletionsResponse | ResponsesApiResponse) {
  if ("output_text" in data && data.output_text) {
    return data.output_text;
  }

  if ("output" in data && data.output) {
    const outputText = data.output
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n");

    if (outputText) {
      return outputText;
    }
  }

  if ("choices" in data) {
    return data.choices?.[0]?.message?.content;
  }

  return undefined;
}

async function parseKnowledgeWithLocalAi(text: string): Promise<ParsedKnowledgePayload> {
  const savedConfig = readSavedAiConfig();
  const apiKey = savedConfig.apiKey || readEnvValue("AI_API_KEY") || readEnvValue("VITE_AI_API_KEY");
  const baseUrl = savedConfig.baseUrl
    || readEnvValue("AI_API_ENDPOINT")
    || readEnvValue("VITE_AI_API_ENDPOINT")
    || readEnvValue("AI_BASE_URL")
    || readEnvValue("VITE_AI_BASE_URL")
    || "https://api.openai.com/v1";
  const model = readEnvValue("AI_MODEL") || readEnvValue("VITE_AI_MODEL") || "gpt-4.1-mini";
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const requestUrl = normalizedBaseUrl.endsWith("/responses") || normalizedBaseUrl.endsWith("/chat/completions")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/responses`;
  const usesResponsesApi = requestUrl.endsWith("/responses");

  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured.");
  }

  console.info(`[keyword-memory] AI parse request: endpoint=${requestUrl}, model=${model}`);

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      usesResponsesApi
        ? {
            model,
            input: buildKnowledgeKeywordExtractionInput(text)
          }
        : {
            model,
            temperature: 0.2,
            max_tokens: 600,
            messages: [
              { role: "system", content: KNOWLEDGE_KEYWORD_EXTRACTION_PROMPT },
              { role: "user", content: text }
            ]
          }
    )
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${await response.text()}`);
  }

  console.info(`[keyword-memory] AI parse response: status=${response.status}`);

  const data = await response.json() as ChatCompletionsResponse | ResponsesApiResponse;
  const content = extractAiContent(data);

  if (!content) {
    throw new Error("AI response is empty.");
  }

  const parsed = normalizeParsedKnowledge(JSON.parse(extractJsonObject(content)), text);
  console.info(`[keyword-memory] AI parsed item: title=${parsed.title}, keywords=${parsed.keywords.length}`);
  return parsed;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f7f4ec",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, "../dist/tray.png"));
  tray.setToolTip("Keyword Memory");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开速记", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("CommandOrControl+Shift+K", () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("quick-capture");
  });

  try {
    createTray();
  } catch {
    tray = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("clipboard:read-text", () => clipboard.readText());
ipcMain.handle("ai:parse-knowledge", async (_event, text: string) => parseKnowledgeWithLocalAi(text));
ipcMain.handle("ai:get-config", () => getAiConfigView());
ipcMain.handle("ai:save-config", (_event, config: AiConfig) => saveAiConfig(config));
ipcMain.handle("ai:clear-config", () => clearAiConfig());
