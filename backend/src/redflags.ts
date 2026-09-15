import { supabase } from './supabase';
import { orchestrate } from './orchestration/router';

const RED_FLAG_RULES = [
  { id: 'R1', condition: (answerText: string, _: any[], questionId: string) => (answerText === '7-10 Severe' && questionId === 'q_chest_severity') || (answerText === 'Worst headache of my life' && questionId === 'q_headache_severity') },
  { id: 'R2', condition: (answerText: string, _: any[], questionId: string) => answerText === 'Left arm' && questionId === 'q_chest_radiation' },
  { id: 'R3', condition: (answerText: string, _: any[], questionId: string) => answerText === 'Yes' && questionId === 'q_chest_breath' },
  { id: 'R4', condition: (answerText: string, _: any[], questionId: string) => answerText === 'Yes' && questionId === 'q_cough_blood' },
  { id: 'R5', condition: (answerText: string, _: any[], questionId: string) => answerText === 'High >103' && questionId === 'q_fever_temp' },
  { id: 'R6', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /facial droop|arm weakness|speech difficulty|slurred speech/i.test(all); } },
  { id: 'R7', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /anaphylaxis|throat closing|can't breathe/i.test(all) && /allergy|rash/i.test(all); } },
  { id: 'R8', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /vomiting blood|black tarry stool|blood in stool/i.test(all); } },
  { id: 'R9', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /suicid|kill myself|end my life/i.test(all); } },
  { id: 'R10', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /pregnant|pregnancy/i.test(all) && /bleeding|severe abdominal pain/i.test(all); } },
  { id: 'R11', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /child|baby|infant/i.test(all) && /lethargic|unresponsive|high fever|rash/i.test(all); } },
  { id: 'R12', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /diarrhea|vomit/i.test(all) && /dizz|no urination|extreme thirst/i.test(all); } },
  { id: 'R13', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /diabet/i.test(all) && /vomit|confusion|deep breathing/i.test(all); } },
  { id: 'R14', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /fever/i.test(all) && /neck stiffness|stiff neck|photophobia/i.test(all); } },
  { id: 'R15', condition: (text: string, ans: any[]) => { const all = ans.map(a => a.answer_text).join(' '); return /sudden breathlessness|chest pain/i.test(all) && /leg swelling/i.test(all); } }
];

export async function evaluateAnswer(answer: any) {
  const { data: allAnswers } = await supabase
    .from('answers')
    .select('*')
    .eq('session_id', answer.session_id);

  if (!allAnswers) return;

  // Optimistically include the new answer in allAnswers if not already present
  if (!allAnswers.some(a => a.id === answer.id)) {
    allAnswers.push(answer);
  }

  let isFlagged = false;
  let ruleIdTriggered = null;

  console.log(`Evaluating answer for session ${answer.session_id}: question_id=${answer.question_id}, answer_text=${answer.answer_text}`);

  for (const rule of RED_FLAG_RULES) {
    if (rule.condition(answer.answer_text, allAnswers, answer.question_id)) {
      console.log(`FLAGGED! Rule ${rule.id} triggered by answer_text=${answer.answer_text}`);
      isFlagged = true;
      ruleIdTriggered = rule.id;
      break;
    }
  }

  if (isFlagged && ruleIdTriggered) {
    console.log(`Updating session ${answer.session_id} to red_flag=true`);
    await supabase
      .from('sessions')
      .update({ red_flag: true })
      .eq('id', answer.session_id);
    
    const { error: flagError } = await supabase
      .from('red_flags')
      .insert({
        session_id: answer.session_id,
        rule_id: ruleIdTriggered,
        triggered_fact_id: answer.id,
        created_at: new Date().toISOString(),
      });
    if (flagError) {
      console.error('Failed to insert red flag:', flagError);
      throw flagError;
    }
  } else if (answer.question_id !== 'chief_complaint') {
    // Secondary: semantic red-flag via orchestration layer (MedGemma → Gemini fallback)
    // Deterministic rules already ran above — this is additive only.
    // NEVER let orchestration failure crash the interview.
    try {
      const allAnswerTexts = allAnswers.map((a) => `${a.question_id}: ${a.answer_text}`).join('\n');
      const prompt = `You are a triage nurse evaluating a patient's answers. Does the patient require IMMEDIATE medical attention (e.g. signs of heart attack, stroke, severe bleeding, suicidal intent, anaphylaxis)?
Patient answers:
${allAnswerTexts}

Reply with ONLY "YES" or "NO".`;
      const semanticResult = await orchestrate<string>('red-flag-semantic', { prompt });
      const verdict = semanticResult.result.trim().toUpperCase();
      if (verdict.includes('YES')) {
        console.log(`[red-flag-semantic] Semantic flag triggered for session ${answer.session_id} (provider: ${semanticResult.provider})`);
        await supabase
          .from('sessions')
          .update({ red_flag: true })
          .eq('id', answer.session_id);
        await supabase
          .from('red_flags')
          .insert({
            session_id: answer.session_id,
            rule_id: 'SEMANTIC',
            triggered_fact_id: answer.id,
            created_at: new Date().toISOString(),
          });
      }
    } catch (err) {
      console.warn('[red-flag-semantic] Orchestration failed — deterministic rules still active:', err);
    }
  }
}
