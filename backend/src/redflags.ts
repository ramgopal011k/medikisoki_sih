import { supabase } from './supabase';

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
    console.log(`No deterministic red flag triggered for session ${answer.session_id}. Semantic fallback is currently disabled.`);
    // DEFERRED: Gemini semantic red flag logic is disabled for now to remove cloud dependency
    /*
    try {
      const res = await fetch('http://localhost:3001/api/gemini/red-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers })
      });
      const data: any = await res.json();
      if (data.isFlagged) {
        console.log(`SEMANTIC FLAG! Updating session ${answer.session_id} to red_flag=true`);
        await supabase
          .from('sessions')
          .update({ red_flag: true })
          .eq('id', answer.session_id);
      }
    } catch (err) {
      console.error('Semantic Red-Flag evaluation failed:', err);
    }
    */
  }
}
