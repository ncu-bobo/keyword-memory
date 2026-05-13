/// <reference types="vite/client" />

interface Window {
  keywordMemory?: {
    readClipboardText: () => Promise<string>;
    onQuickCapture: (callback: () => void) => void;
  };
}
