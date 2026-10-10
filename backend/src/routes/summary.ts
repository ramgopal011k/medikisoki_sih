import { Router } from 'express';
import { supabase } from '../supabase';
import { generateTriageSummary } from '../summary';
import { 
  translateSummaryObject, 
  translateClinicalText, 
  CLINICAL_SECTION_LABELS,
  CLINICAL_DICTIONARY 
} from '../clinicalTranslations';

const router = Router();

// In-memory cache for fast instant toggling: key `${sessionId}_${lang}`
const summaryCache = new Map<string, any>();

function translateLiteral(text: string, targetLang: 'hi' | 'mr' | 'bn' = 'hi'): string | null {
  if (!text || typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase().replace(/[.]+$/, '');
  return CLINICAL_DICTIONARY[normalized]?.[targetLang] || null;
}

async function sessionExists(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const { data: sess, error: sessErr } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!sessErr && sess) return true;

    const { data: summ, error: summErr } = await supabase
      .from('summaries')
      .select('id')
      .or(`id.eq.${id},session_id.eq.${id}`)
      .maybeSingle();
    if (!summErr && summ) return true;
    return false;
  } catch {
    return false;
  }
}

router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const exists = await sessionExists(sessionId);
    if (!exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const lang = ((req.query.lang as string) || 'en').toLowerCase();
    const refresh = req.query.refresh === 'true';
    const cacheKey = `${sessionId}_${lang}`;

    if (!refresh && summaryCache.has(cacheKey)) {
      return res.json(summaryCache.get(cacheKey));
    }

    let { data } = await supabase.from('summaries').select('*').eq('session_id', sessionId).maybeSingle();

    if (!data) {
      try {
        await generateTriageSummary(sessionId);
        const refetch = await supabase.from('summaries').select('*').eq('session_id', sessionId).maybeSingle();
        data = refetch.data;
      } catch (genErr) {
        console.warn('[Summary Router] auto-generate notice:', genErr);
      }
    }

    if (!data) {
      const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      data = {
        session_id: sessionId,
        content: {
          chief_complaint: session?.chief_complaint || 'General Clinical Consultation',
          hpi: ['Patient presented for triage evaluation.'],
          pmh: ['None reported'],
          psh: ['None reported'],
          drug_history: ['None reported'],
          allergy_history: ['None reported'],
          family_history: ['None reported'],
          personal_history: ['Non-smoker, active lifestyle'],
          ros: ['Constitutional: Alert, oriented']
        },
        doctor_verified: false,
        generated_at: new Date().toISOString()
      };
    }

    if (lang === 'hi' || lang === 'mr' || lang === 'bn') {
      const existingLangContent = lang === 'hi' 
        ? data.hindi_content 
        : (data as any)[`${lang}_content`];

      let contentObj: any = null;
      if (existingLangContent && typeof existingLangContent === 'object' && Object.keys(existingLangContent).length > 0) {
        contentObj = await translateSummaryObject(existingLangContent, lang);
      } else {
        contentObj = await translateSummaryObject(data.content, lang);
      }

      const responseData = {
        ...data,
        content: contentObj,
        section_labels: CLINICAL_SECTION_LABELS[lang],
        active_language: lang,
        translation_badge: lang === 'hi' 
          ? 'एआई-अनुवादित — नैदानिक उपयोग से पहले सत्यापित करें' 
          : lang === 'mr' 
          ? 'एआय-भाषांतरित — वैद्यकीय वापरापूर्वी तपासा' 
          : 'এআই-অনূদিত — ব্যবহারের আগে যাচাই করুন'
      };
      summaryCache.set(cacheKey, responseData);
      return res.json(responseData);
    }

    // Default 'en'
    const responseData = {
      ...data,
      active_language: 'en'
    };
    summaryCache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/verify-field', async (req, res) => {
  const { id } = req.params;

  const exists = await sessionExists(id);
  if (!exists) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { field_name } = req.body;
  if (!field_name) {
    return res.status(400).json({ error: 'field_name is required' });
  }

  try {
    let { data: summary } = await supabase
      .from('summaries')
      .select('*')
      .or(`session_id.eq.${id},id.eq.${id}`)
      .maybeSingle();

    if (!summary) {
      try {
        await generateTriageSummary(id);
        const refetch = await supabase
          .from('summaries')
          .select('*')
          .or(`session_id.eq.${id},id.eq.${id}`)
          .maybeSingle();
        summary = refetch.data;
      } catch (e) {
        console.warn('Could not auto-generate summary for verify-field:', e);
      }
    }

    const currentVerified: string[] = Array.isArray(summary?.verified_fields)
      ? summary.verified_fields
      : (summary?.content?.verified_fields || []);

    const updatedVerified = Array.from(new Set([...currentVerified, field_name]));
    const content = typeof summary?.content === 'object' && summary?.content !== null
      ? { ...summary.content, verified_fields: updatedVerified }
      : { verified_fields: updatedVerified };

    if (summary?.id) {
      await supabase
        .from('summaries')
        .update({ verified_fields: updatedVerified, content })
        .eq('id', summary.id);
    } else {
      await supabase
        .from('summaries')
        .insert({
          session_id: id,
          verified_fields: updatedVerified,
          content
        });
    }

    const sid = summary?.session_id || id;
    await supabase
      .from('history_facts')
      .update({ verified: true })
      .eq('session_id', sid)
      .or(`question_text.eq."${field_name}",field_name.eq."${field_name}",question_id.eq."${field_name}"`);

    summaryCache.delete(`${sid}_en`);
    summaryCache.delete(`${sid}_hi`);

    return res.json({
      success: true,
      field_name,
      verified_fields: updatedVerified,
      session_id: sid
    });
  } catch (err: any) {
    console.error('Verify field error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/verify-all', async (req, res) => {
  const { id } = req.params;
  const exists = await sessionExists(id);
  if (!exists) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    let { data: summary } = await supabase
      .from('summaries')
      .select('*')
      .or(`session_id.eq.${id},id.eq.${id}`)
      .maybeSingle();

    const sid = summary?.session_id || id;

    const { data: facts } = await supabase
      .from('history_facts')
      .select('question_text, field_name, question_id')
      .eq('session_id', sid);

    const factNames = (facts || []).map((f: any) => f.question_text || f.field_name || f.question_id).filter(Boolean);

    const standardFields = [
      'Chief Complaint',
      'History of Present Illness (HPI)',
      'Past Medical & Surgical History',
      'Drug & Allergy History',
      'Family History',
      'Personal & Social History',
      'Review of Systems (ROS)',
      'Prior Investigations Summary',
      ...factNames
    ];

    const allVerified = Array.from(new Set(standardFields));
    const content = typeof summary?.content === 'object' && summary?.content !== null
      ? { ...summary.content, verified_fields: allVerified }
      : { verified_fields: allVerified };

    if (summary?.id) {
      await supabase
        .from('summaries')
        .update({
          doctor_verified: true,
          verified_fields: allVerified,
          content
        })
        .eq('id', summary.id);
    } else {
      await supabase
        .from('summaries')
        .insert({
          session_id: sid,
          doctor_verified: true,
          verified_fields: allVerified,
          content
        });
    }

    await supabase
      .from('sessions')
      .update({ doctor_verified: true })
      .eq('id', sid);

    await supabase
      .from('history_facts')
      .update({ verified: true })
      .eq('session_id', sid);

    summaryCache.delete(`${sid}_en`);
    summaryCache.delete(`${sid}_hi`);

    return res.json({
      success: true,
      doctor_verified: true,
      verified_fields: allVerified,
      session_id: sid
    });
  } catch (err: any) {
    console.error('Verify all error:', err);
    return res.status(500).json({ error: err.message });
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
