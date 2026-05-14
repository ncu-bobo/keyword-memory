import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("keywordMemory", {
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text") as Promise<string>,
  parseKnowledgeText: (text: string) => ipcRenderer.invoke("ai:parse-knowledge", text) as Promise<{
    title: string;
    keywords: string[];
    tag?: string;
    sourceExcerpt?: string;
  }>,
  onQuickCapture: (callback: () => void) => {
    ipcRenderer.on("quick-capture", callback);
  }
});
