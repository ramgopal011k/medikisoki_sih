import { Router, Request, Response } from 'express';
import { getOllamaHealth } from '../orchestration/medgemmaClient';
import { getLastCallProvider } from '../orchestration/router';

const router = Router();

router.get('/ollama', async (_req: Request, res: Response) => {
  const lastCall = getLastCallProvider();
  try {
    const health = await getOllamaHealth();
    return res.json({
      ...health,
      last_call_provider: lastCall.last_call_provider,
      last_call_ms_ago: lastCall.last_call_ms_ago
    });
  } catch (err: any) {
    return res.status(500).json({
      reachable: false,
      error: err?.message || 'Failed to check Ollama health',
      last_call_provider: lastCall.last_call_provider,
      last_call_ms_ago: lastCall.last_call_ms_ago
    });
  }
});

export default router;
