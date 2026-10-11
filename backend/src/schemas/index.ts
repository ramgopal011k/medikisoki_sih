import { z } from 'zod';

export const sessionSchema = z.object({
  hospital_id: z.string().optional().nullable(),
  patient_name: z.string().optional().nullable(),
  dummy_aadhaar: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  chief_complaint: z.string().optional().nullable(),
  age: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  patient_type: z.string().optional().nullable(),
  consent: z.any().optional().nullable(),
  consents: z.object({
    clinical_care: z.boolean().optional(),
    ai_analytics: z.boolean().optional(),
    abdm_sharing: z.boolean().optional(),
    research: z.boolean().optional(),
    clinicalCare: z.boolean().optional(),
    dataAnalytics: z.boolean().optional(),
    communications: z.boolean().optional()
  }).passthrough().optional().nullable(),
  body_regions: z.array(z.string()).optional().nullable(),
  ayush_opt_in: z.boolean().optional().nullable(),
  ayush_mode: z.boolean().optional().nullable(),
  caregiver_mode: z.boolean().optional().nullable(),
  proxy_respondent: z.union([z.boolean(), z.string()]).optional().nullable()
}).passthrough();

export const historyFactSchema = z.object({
  session_id: z.string(),
  question_id: z.string().optional().nullable(),
  question_text: z.string().optional().nullable(),
  answer: z.string().optional().nullable(),
  answer_value: z.string().optional().nullable(),
  red_flag_id: z.string().optional().nullable()
});

export const medicalHistorySchema = z.object({
  session_id: z.string(),
  items: z.array(z.object({
    category: z.string(),
    value: z.string(),
    provenance: z.string().optional().nullable()
  }))
});

export const dashavidhaDimensions = [
  'prakriti', 'vikriti', 'agni', 'koshtha', 'sara', 'samhanana',
  'pramana', 'satmya', 'sattva', 'ahara_shakti', 'vyayama_shakti', 'vaya'
] as const;

export const ayushAssessmentSchema = z.object({
  session_id: z.string(),
  dimension: z.string().min(1, 'Dimension name required'),
  value: z.string().min(1, 'Dimension value required')
});

export const authSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(3)
});

export const analyzeRecordsSchema = z.object({
  text: z.string()
});
