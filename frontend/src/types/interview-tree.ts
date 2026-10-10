export interface InterviewOption {
  value: string;
  label: string;
  label_hi?: string;
  label_mr?: string;
  label_bn?: string;
}

export interface RedFlagResult {
  type: 'red_flag';
  flag_id: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  text_hi?: string;
  text_mr?: string;
  text_bn?: string;
  type: 'single_choice' | 'multi_choice' | 'text' | 'number';
  options?: InterviewOption[];
  next: (answer: string | string[]) => string | RedFlagResult | null;
}

export interface InterviewTree {
  complaint: string;
  start_question_id: string;
  questions: Record<string, InterviewQuestion>;
}

/** Type guard to check if a next() result is a red flag */
export function isRedFlag(result: string | RedFlagResult | null): result is RedFlagResult {
  return result !== null && typeof result === 'object' && result.type === 'red_flag';
}
