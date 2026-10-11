import { Router, Request, Response } from 'express';
import { getOllamaHealth } from '../orchestration/medgemmaClient';

const router = Router();

router.get('/ollama', async (_req: Request, res: Response) => {
  try {
    const health = await getOllamaHealth();
    return res.json(health);
  } catch (err: any) {
    return res.status(500).json({
      reachable: false,
      error: err?.message || 'Failed to check Ollama health'
    });
  }
});

export default router;
