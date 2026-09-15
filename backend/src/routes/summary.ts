import { Router } from 'express';
import { supabase } from '../supabase';

const router = Router();

router.get('/:sessionId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('summaries').select('*').eq('session_id', req.params.sessionId).single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify', async (req, res) => {
  const { session_id } = req.body;
  try {
    const { error } = await supabase.from('summaries').update({ doctor_verified: true }).eq('session_id', session_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
