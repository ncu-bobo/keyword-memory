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
    getAiConfig: () => Promise<{
      baseUrl: string;
      hasApiKey: boolean;
    }>;
    saveAiConfig: (config: { baseUrl?: string; apiKey?: string }) => Promise<{
      baseUrl: string;
      hasApiKey: boolean;
    }>;
    clearAiConfig: () => Promise<{
      baseUrl: string;
      hasApiKey: boolean;
    }>;
    onQuickCapture: (callback: () => void) => void;
  };
}
