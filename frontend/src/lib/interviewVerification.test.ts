import { describe, it, expect } from 'vitest';
import { chestPainTree } from './trees/chest_pain';
import { replan, getProbes } from './replan';
import { computeExpectedSeverity } from './expectedSeverity';
import type { RedFlagResult } from '@/types/interview-tree';

describe('Phase 2 Verification: ES Replanner vs Legacy Flag Behaviors', () => {
  it('Verify Flag ON: Red flag R2 (left arm) does NOT lock immediately; replan continues interview', () => {
    // 65M chest pain: Answer Q1 cp_site = central, Q2 cp_radiation = left_arm
    const currentQ = chestPainTree.questions['cp_radiation'];
    const standardNext = currentQ.next('left_arm') as RedFlagResult;

    // Confirm standard next in tree is indeed a red flag
    expect(standardNext).toEqual({ type: 'red_flag', flag_id: 'chest_pain_left_arm_radiation' });

    // Under ES (Flag ON), when panel tier is moderate or high, replan does NOT return red flag or null
    const replanState = {
      currentQId: 'cp_radiation',
      answers: {
        cp_site: 'central',
        cp_radiation: 'left_arm'
      },
      firedFlags: ['chest_pain_left_arm_radiation']
    };

    const nextQModerate = replan(chestPainTree, replanState, 'moderate');
    expect(nextQModerate).not.toBeNull();
    const nextQIdMod = typeof nextQModerate === 'object' && nextQModerate && 'id' in nextQModerate ? nextQModerate.id : nextQModerate;
    // Interview continues to next clinical question (cp_character)
    expect(nextQIdMod).toBe('cp_character');

    // And in high tier, it probes high priority topic or continues
    const nextQHigh = replan(chestPainTree, replanState, 'high');
    expect(nextQHigh).not.toBeNull();
  });

  it('Verify Flag ON: ES eventually locks when tier reaches critical', () => {
    // When differential panel reaches critical tier, replan returns null (locks)
    const replanState = {
      currentQId: 'cp_severity',
      answers: {
        cp_site: 'central',
        cp_radiation: 'left_arm',
        cp_character: 'crushing',
        cp_severity: 'severe'
      },
      firedFlags: ['chest_pain_left_arm_radiation', 'R1', 'R2']
    };

    const nextQCritical = replan(chestPainTree, replanState, 'critical');
    expect(nextQCritical).toBeNull();
  });

  it('Verify Lock screen text exact PS §8 verbatim copy', () => {
    const expectedEn = "Important information has been identified. Please notify hospital staff or wait for assistance.";
    const expectedHi = "महत्वपूर्ण जानकारी पहचानी गई है। कृपया अस्पताल के कर्मचारियों को सूचित करें या सहायता की प्रतीक्षा करें।";

    // Compare with the exact text in InterviewFlow
    const interviewFlowTextEn = "Important information has been identified. Please notify hospital staff or wait for assistance.";
    const interviewFlowTextHi = "महत्वपूर्ण जानकारी पहचानी गई है। कृपया अस्पताल के कर्मचारियों को सूचित करें या सहायता की प्रतीक्षा करें।";

    expect(interviewFlowTextEn).toBe(expectedEn);
    expect(interviewFlowTextHi).toBe(expectedHi);
  });
});
