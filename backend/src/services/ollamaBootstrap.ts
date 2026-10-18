import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MEDGEMMA_MODEL = 'medgemma1.5:latest';

async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureOllamaRunning(): Promise<void> {
  if (await isOllamaRunning()) {
    console.log('[ollama] Already running');
    return;
  }
  console.log('[ollama] Not running. Starting ollama serve in background...');
  // Windows: try to start Ollama app; Linux/Mac: spawn ollama serve
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'ollama.exe' : 'ollama';
  const args = ['serve'];
  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    shell: isWindows,
  });
  child.unref();

  // Wait up to 30s for Ollama to respond
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    if (await isOllamaRunning()) {
      console.log(`[ollama] Started in ${i + 1}s`);
      // Verify MedGemma model is loaded
      try {
        const tags = await fetch(`${OLLAMA_URL}/api/tags`).then(r => r.json()) as {
          models?: Array<{ name: string }>;
        };
        const hasModel = tags.models?.some((m) => m.name.includes('medgemma'));
        if (!hasModel) {
          console.warn(`[ollama] WARNING: ${MEDGEMMA_MODEL} not found. Run: ollama pull ${MEDGEMMA_MODEL}`);
        } else {
          console.log(`[ollama] MedGemma ready`);
        }
      } catch (err) {
        console.warn(`[ollama] Could not check tags: ${err}`);
      }
      return;
    }
  }
  console.warn('[ollama] Failed to start in 30s. MedGemma calls will fall back to Gemini.');
}
