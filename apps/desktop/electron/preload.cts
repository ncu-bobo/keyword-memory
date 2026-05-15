import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("keywordMemory", {
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text") as Promise<string>,
  parseKnowledgeText: (text: string) => ipcRenderer.invoke("ai:parse-knowledge", text) as Promise<{
    title: string;
    keywords: string[];
    tag?: string;
    sourceExcerpt?: string;
  }>,
  getAiConfig: () => ipcRenderer.invoke("ai:get-config") as Promise<{
    baseUrl: string;
    hasApiKey: boolean;
  }>,
  saveAiConfig: (config: { baseUrl?: string; apiKey?: string }) =>
    ipcRenderer.invoke("ai:save-config", config) as Promise<{
      baseUrl: string;
      hasApiKey: boolean;
    }>,
  clearAiConfig: () => ipcRenderer.invoke("ai:clear-config") as Promise<{
    baseUrl: string;
    hasApiKey: boolean;
  }>,
  onQuickCapture: (callback: () => void) => {
    ipcRenderer.on("quick-capture", callback);
  }
});
