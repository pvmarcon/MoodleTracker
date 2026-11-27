import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { setAIEnv } from './services/ai/env';

const env = import.meta.env;
setAIEnv({
  provider: env.VITE_AI_PROVIDER,
  openaiKey: env.VITE_OPENAI_API_KEY,
  openaiModel: env.VITE_OPENAI_MODEL,
  geminiKey: env.VITE_GEMINI_API_KEY,
  geminiModel: env.VITE_GEMINI_MODEL,
  proxyUrl: env.VITE_AI_PROXY_URL,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
