import type { InterviewTree } from "@/types/interview-tree";
import { chestPainTree } from './chest_pain';
import { feverTree } from './fever';
import { abdominalPainTree } from './abdominal_pain';
import { headacheTree } from './headache';
import { backPainTree } from './back_pain';
import { coughTree } from './cough';
import { otherTree } from './other';

export const trees: Record<string, InterviewTree> = {
  // English
  'Chest pain': chestPainTree,
  'Fever': feverTree,
  'Abdominal pain': abdominalPainTree,
  'Headache': headacheTree,
  'Back pain': backPainTree,
  'Cough': coughTree,
  'Other': otherTree,

  // Hindi
  'छाती में दर्द': chestPainTree,
  'बुखार': feverTree,
  'पेट में दर्द': abdominalPainTree,
  'सिरदर्द': headacheTree,
  'पीठ में दर्द': backPainTree,
  'खांसी': coughTree,
  'अन्य': otherTree,

  // Marathi
  'छातीत दुखणे': chestPainTree,
  'ताप': feverTree,
  'पोटदुखी': abdominalPainTree,
  'डोकेदुखी': headacheTree,
  'पाठदुखी': backPainTree,
  'खोकला': coughTree,
  'इतर': otherTree,

  // Bengali
  'বুকে ব্যথা': chestPainTree,
  'জ্বর': feverTree,
  'পেটে ব্যথা': abdominalPainTree,
  'মাথাব্যথা': headacheTree,
  'পিঠে ব্যথা': backPainTree,
  'কাশি': coughTree,
  'অন্যান্য': otherTree
};

export const getInterviewTree = (complaint: string): InterviewTree | null => {
  if (!complaint) return null;
  if (trees[complaint]) return trees[complaint];

  const lower = complaint.toLowerCase().trim();
  for (const [key, tree] of Object.entries(trees)) {
    if (key.toLowerCase().trim() === lower) {
      return tree;
    }
  }

  // Substring match heuristics
  if (lower.includes('chest') || lower.includes('छाती') || lower.includes('বুকে')) return chestPainTree;
  if (lower.includes('fever') || lower.includes('बुखार') || lower.includes('ताप') || lower.includes('জ্বর')) return feverTree;
  if (lower.includes('abdominal') || lower.includes('पेट') || lower.includes('पोट') || lower.includes('পেট')) return abdominalPainTree;
  if (lower.includes('headache') || lower.includes('सिरदर्द') || lower.includes('डोकेदुखी') || lower.includes('মাথাব্যথা')) return headacheTree;
  if (lower.includes('back') || lower.includes('पीठ') || lower.includes('पाठ') || lower.includes('পিঠ')) return backPainTree;
  if (lower.includes('cough') || lower.includes('खांसी') || lower.includes('खोकला') || lower.includes('কাশি')) return coughTree;

  return otherTree;
};
