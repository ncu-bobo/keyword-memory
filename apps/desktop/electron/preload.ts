import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("keywordMemory", {
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text") as Promise<string>,
  onQuickCapture: (callback: () => void) => {
    ipcRenderer.on("quick-capture", callback);
  }
});
