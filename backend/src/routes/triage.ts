import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { requireTriageOrDoctor } from '../middleware/auth';

const router = Router();

// Critical rule IDs that map to 'critical' severity
const CRITICAL_RULES = new Set([
  'R1', 'R2', 'R3', 'R4', 'R6', 'R7', 'R8', 'R9', 'R10', 'R15', 'SEMANTIC'
]);

router.get('/alerts', requireTriageOrDoctor, async (req: Request, res: Response) => {
  try {
    const { hospital_id } = req.query;

    let query = supabase
      .from('sessions')
      .select('*')
      .eq('red_flag', true)
      .order('created_at', { ascending: false });

    if (hospital_id && hospital_id !== 'all') {
      query = query.or(`hospital_id.eq.${hospital_id},hospital_id.is.null`);
    }

    const { data: sessions, error } = await query;

    if (error || !sessions) {
      console.warn('Supabase triage alerts sessions query warning:', error?.message);
      return res.json([
        { severity: 'critical', sessions: [] },
        { severity: 'high', sessions: [] }
      ]);
    }

    const sessionIds = sessions.map((s: any) => s.id);
    let allAnswers: any[] = [];
    let allRedFlags: any[] = [];

    if (sessionIds.length > 0) {
      try {
        const { data: answersData } = await supabase
          .from('answers')
          .select('session_id, question_id, answer_text')
          .in('session_id', sessionIds);
        if (answersData) allAnswers = answersData;
      } catch (e) {
        console.warn('Could not batch fetch answers for triage alerts:', e);
      }

      try {
        const { data: rfData } = await supabase
          .from('red_flags')
          .select('session_id, rule_id, created_at')
          .in('session_id', sessionIds);
        if (rfData) allRedFlags = rfData;
      } catch (e) {
        console.warn('Could not batch fetch red flags for triage alerts:', e);
      }
    }

    const mappedSessions = sessions.map((s: any) => {
      const sessionAnswers = allAnswers.filter((a: any) => a.session_id === s.id);
      const sessionRedFlags = allRedFlags.filter((rf: any) => rf.session_id === s.id);

      const complaintAnswer = sessionAnswers.find((a: any) => a.question_id === 'chief_complaint');
      const chiefComplaint = s.chief_complaint || complaintAnswer?.answer_text || 'General Consultation';

      // Determine severity: if any triggered rule is in CRITICAL_RULES, mark critical
      const hasCritical = sessionRedFlags.some((rf: any) => CRITICAL_RULES.has(rf.rule_id)) ||
        /chest pain|worst headache|breath|stroke|unconscious|bleed|suicid|anaphylax/i.test(chiefComplaint);

      const severity: 'critical' | 'high' = hasCritical ? 'critical' : 'high';

      return {
        id: s.id,
        session_id: s.id,
        hospital_id: s.hospital_id || (hospital_id && hospital_id !== 'all' ? hospital_id : '11111111-1111-1111-1111-111111111111'),
        patient_name: s.patient_name || 'Anonymous Patient',
        chief_complaint: chiefComplaint,
        created_at: s.created_at || new Date().toISOString(),
        red_flag: true,
        red_flag_count: sessionRedFlags.length || 1,
        red_flags: sessionRedFlags.map((rf: any) => rf.rule_id),
        severity
      };
    });

    const criticalSessions = mappedSessions.filter((s: any) => s.severity === 'critical');
    const highSessions = mappedSessions.filter((s: any) => s.severity === 'high');

    return res.json([
      { severity: 'critical', sessions: criticalSessions },
      { severity: 'high', sessions: highSessions }
    ]);
  } catch (err: any) {
    console.error('Triage alerts error:', err);
    return res.status(500).json({ error: 'Failed to fetch triage alerts' });
  }
});

export default router;
