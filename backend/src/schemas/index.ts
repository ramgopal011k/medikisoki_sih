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
    clinicalCare: z.boolean().default(false),
    dataAnalytics: z.boolean().default(false),
    research: z.boolean().default(false),
    communications: z.boolean().default(false)
  }).optional().nullable()
});

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

export const ayushAssessmentSchema = z.object({
  session_id: z.string(),
  dimension: z.string(),
  value: z.string()
});

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3)
});

export const analyzeRecordsSchema = z.object({
  text: z.string()
});
