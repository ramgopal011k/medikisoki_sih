import { Router } from 'express';
import { supabase } from '../supabase';
import { evaluateAnswer } from '../redflags';
import { historyFactSchema } from '../schemas';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    historyFactSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { session_id, question_id, answer_text, provenance } = req.body;
  try {
    const { data: answer, error } = await supabase.from('answers').insert({
      session_id,
      question_id,
      answer_text,
      provenance: provenance || 'patient_reported'
    }).select().single();

    if (error) throw error;

    await evaluateAnswer(answer).catch(err => console.error('Red flag evaluation failed:', err));

    res.status(201).json({ success: true, id: answer.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:sessionId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('answers').select('*').eq('session_id', req.params.sessionId);
    if (error) throw error;
    res.json({ items: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
