import { supabase } from '../src/supabase';

async function testAnalytics(hospitalId: string, range: string) {
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  // 1. Total sessions & list of sessions in period
  let query = supabase
    .from('sessions')
    .select('id, created_at, red_flag, hospital_id')
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: true });

  if (hospitalId && hospitalId !== 'all') {
    query = query.eq('hospital_id', hospitalId);
  }

  const { data: sessions, count: totalCount } = await query;
  const sessionList = sessions || [];
  const sessionIds = sessionList.map(s => s.id);
  const total_sessions = sessionList.length;

  // 2. Red flags count
  const red_flag_count = sessionList.filter(s => s.red_flag).length;

  // 3. Sessions by day
  // Generate all dates in range from cutoff to today
  const dateMap: Record<string, number> = {};
  const today = new Date();
  for (let d = new Date(cutoff); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dateMap[key] = 0;
  }
  sessionList.forEach(s => {
    const key = s.created_at.slice(0, 10);
    if (dateMap[key] !== undefined) {
      dateMap[key] += 1;
    } else {
      dateMap[key] = 1;
    }
  });
  const sessions_by_day = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // 4. Documents count
  let ocr_documents_count = 0;
  if (sessionIds.length > 0) {
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds);
    ocr_documents_count = count || 0;
  }

  // 5. Ayush assessments count
  let ayush_assessments_count = 0;
  if (sessionIds.length > 0) {
    const { count } = await supabase
      .from('ayush_assessments')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds);
    ayush_assessments_count = count || 0;
  }

  // 6. Top complaints
  let top_complaints: { complaint: string; count: number }[] = [];
  if (sessionIds.length > 0) {
    const { data: answers } = await supabase
      .from('answers')
      .select('answer_text, session_id')
      .eq('question_id', 'chief_complaint')
      .in('session_id', sessionIds);
    
    const complaintCounts: Record<string, number> = {};
    (answers || []).forEach(a => {
      const c = (a.answer_text || 'General Consultation').trim();
      complaintCounts[c] = (complaintCounts[c] || 0) + 1;
    });

    top_complaints = Object.entries(complaintCounts)
      .map(([complaint, count]) => ({ complaint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // 7. Average session duration seconds (sessions.created_at to summaries.created_at)
  let avg_session_duration_seconds: number | null = null;
  if (sessionIds.length > 0) {
    const { data: summaries } = await supabase
      .from('summaries')
      .select('session_id, created_at')
      .in('session_id', sessionIds);

    if (summaries && summaries.length > 0) {
      let totalSeconds = 0;
      let validCount = 0;
      const sessionMap = new Map(sessionList.map(s => [s.id, s.created_at]));

      summaries.forEach(sum => {
        const sessionCreatedAt = sessionMap.get(sum.session_id);
        if (sessionCreatedAt && sum.created_at) {
          const start = new Date(sessionCreatedAt).getTime();
          const end = new Date(sum.created_at).getTime();
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
  }

  const result = {
    total_sessions,
    sessions_by_day,
    red_flag_count,
    top_complaints,
    avg_session_duration_seconds,
    ocr_documents_count,
    ayush_assessments_count
  };

  console.log('Result for hospital', hospitalId, 'range', range, ':\n', JSON.stringify(result, null, 2));
  process.exit(0);
}

testAnalytics('11111111-1111-1111-1111-111111111111', '7d');
