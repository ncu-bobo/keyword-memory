/// <reference types="vite/client" />

interface Window {
  keywordMemory?: {
    readClipboardText: () => Promise<string>;
    parseKnowledgeText: (text: string) => Promise<{
      title: string;
      keywords: string[];
      tag?: string;
      sourceExcerpt?: string;
    }>;
    onQuickCapture: (callback: () => void) => void;
  };
}
