import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { requireDoctorOrAdmin } from '../middleware/auth';

const router = Router();

router.get('/hospital/:id', requireDoctorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const range = (req.query.range as string) || '7d';

    const user = (req as any).user;
    const role = user?.role || 'doctor';

    // If doctors table has hospital_id, filter analytics to that hospital.
    // If admin role, allow any hospital.
    let targetHospitalId = id;
    if (role !== 'admin' && user?.hospital_id && user.hospital_id !== 'all') {
      targetHospitalId = user.hospital_id;
    }

    // Determine day range
    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDate.toISOString();

    // 1. Fetch sessions for the hospital within the date range
    let sessionsQuery = supabase
      .from('sessions')
      .select('id, created_at, red_flag, hospital_id')
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: true });

    if (targetHospitalId && targetHospitalId !== 'all') {
      sessionsQuery = sessionsQuery.eq('hospital_id', targetHospitalId);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.warn('Analytics sessions query warning:', sessionsError.message);
    }

    const sessionList = sessions || [];
    const sessionIds = sessionList.map(s => s.id);
    const total_sessions = sessionList.length;

    // 2. Red flags count
    const red_flag_count = sessionList.filter(s => Boolean(s.red_flag)).length;

    // 3. Sessions by day: 3 points min, 90 points max
    const dateMap: Record<string, number> = {};
    const today = new Date();
    for (let d = new Date(cutoffDate); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dateMap[key] = 0;
    }
    sessionList.forEach(s => {
      const key = s.created_at ? s.created_at.slice(0, 10) : '';
      if (key) {
        if (dateMap[key] !== undefined) {
          dateMap[key] += 1;
        } else {
          dateMap[key] = 1;
        }
      }
    });

    const sessions_by_day = Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // 4. OCR Documents Count (Supabase aggregate count)
    let ocr_documents_count = 0;
    if (sessionIds.length > 0) {
      try {
        const { count, error: docError } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds);
        if (!docError && count !== null) {
          ocr_documents_count = count;
        }
      } catch (err) {
        console.warn('Analytics documents count warning:', err);
      }
    }

    // 5. Ayush Assessments Count (Supabase aggregate count)
    let ayush_assessments_count = 0;
    if (sessionIds.length > 0) {
      try {
        const { count, error: ayushError } = await supabase
          .from('ayush_assessments')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds);
        if (!ayushError && count !== null) {
          ayush_assessments_count = count;
        }
      } catch (err) {
        console.warn('Analytics ayush count warning:', err);
      }
    }

    // 6. Top complaints (Top 5)
    let top_complaints: { complaint: string; count: number }[] = [];
    if (sessionIds.length > 0) {
      try {
        const { data: answers, error: ansError } = await supabase
          .from('answers')
          .select('answer_text, session_id')
          .eq('question_id', 'chief_complaint')
          .in('session_id', sessionIds);

        if (!ansError && answers) {
          const complaintCounts: Record<string, number> = {};
          answers.forEach(a => {
            const complaint = (a.answer_text || 'General Consultation').trim();
            complaintCounts[complaint] = (complaintCounts[complaint] || 0) + 1;
          });

          top_complaints = Object.entries(complaintCounts)
            .map(([complaint, count]) => ({ complaint, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        }
      } catch (err) {
        console.warn('Analytics top complaints warning:', err);
      }
    }

    // 7. Average session duration seconds (sessions.created_at to summaries.created_at/generated_at)
    let avg_session_duration_seconds: number | null = null;
    if (sessionIds.length > 0) {
      try {
        const { data: summaries, error: sumError } = await supabase
          .from('summaries')
          .select('session_id, created_at')
          .in('session_id', sessionIds);

        if (!sumError && summaries && summaries.length > 0) {
          let totalSeconds = 0;
          let validCount = 0;
          const sessionMap = new Map(sessionList.map(s => [s.id, s.created_at]));

          summaries.forEach((sum: any) => {
            const sessionCreatedAt = sessionMap.get(sum.session_id);
            const summaryGeneratedAt = sum.generated_at || sum.created_at;
            if (sessionCreatedAt && summaryGeneratedAt) {
              const start = new Date(sessionCreatedAt).getTime();
              const end = new Date(summaryGeneratedAt).getTime();
              const diffSec = Math.round((end - start) / 1000);
              if (diffSec >= 0) {
                totalSeconds += diffSec;
                validCount += 1;
              }
            }
          });

          if (validCount > 0) {
            avg_session_duration_seconds = Math.round(totalSeconds / validCount);
          }
        }
      } catch (err) {
        console.warn('Analytics duration warning:', err);
      }
    }

    return res.json({
      total_sessions,
      sessions_by_day,
      red_flag_count,
      top_complaints,
      avg_session_duration_seconds,
      ocr_documents_count,
      ayush_assessments_count
    });
  } catch (error: any) {
    console.error('Hospital analytics error:', error);
    return res.status(500).json({ error: 'Failed to retrieve hospital analytics' });
  }
});

export default router;
