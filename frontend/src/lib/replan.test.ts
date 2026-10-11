import { describe, it, expect } from 'vitest';
import { computeExpectedSeverity } from './expectedSeverity';
import {
  isQuestionSkipped,
  getQuestionPriorityScore,
  replan,
  getProbes,
  shouldClarify
} from './replan';
import type { InterviewTree, InterviewQuestion } from '@/types/interview-tree';

describe('Expected Severity & Differential Panel', () => {
  it('Scenario 1: Low-risk patient panel yields moderate tier without override', () => {
    const panel = [
      { name: 'MSK chest pain', probability: 0.55, severity: 10, source: 'AAFP 2020' },
      { name: 'GERD', probability: 0.30, severity: 25, source: 'ACG 2022' },
      { name: 'ACS', probability: 0.15, severity: 95, source: 'AHA/ACC 2023' },
    ];

    const result = computeExpectedSeverity(panel);
    expect(result.expected_severity).toBe(27.25);
    expect(result.safety_override).toBe(false);
    expect(result.tier).toBe('moderate');
  });

  it('Scenario 2: High-risk patient panel triggers safety override to critical', () => {
    const panel = [
      { name: 'ACS', probability: 0.60, severity: 95, source: 'AHA/ACC 2023' },
      { name: 'GERD', probability: 0.25, severity: 25, source: 'ACG 2022' },
      { name: 'MSK chest pain', probability: 0.15, severity: 10, source: 'AAFP 2020' },
    ];

    const result = computeExpectedSeverity(panel);
    expect(result.expected_severity).toBe(64.75);
    expect(result.safety_override).toBe(true);
    expect(result.tier).toBe('critical');
    expect(result.override_reason).toContain('ACS');
  });

  it('Scenario 3: Non-urgent panel yields low tier', () => {
    const panel = [
      { name: 'Mild URI', probability: 0.80, severity: 10, source: 'CDC 2021' },
      { name: 'Uncomplicated Allergy', probability: 0.20, severity: 25, source: 'AAAAI 2022' },
    ];

    const result = computeExpectedSeverity(panel);
    expect(result.expected_severity).toBe(13);
    expect(result.safety_override).toBe(false);
    expect(result.tier).toBe('low');
  });

  it('Tier threshold boundaries verify correctly', () => {
    // ES >= 80 -> critical
    const panelCritical = [
      { name: 'Severe Sepsis', probability: 1.0, severity: 95, source: 'SSC 2021' },
    ];
    expect(computeExpectedSeverity(panelCritical).tier).toBe('critical');

    // ES 50-79 -> high
    const panelHigh = [
      { name: 'Acute Cholecystitis', probability: 1.0, severity: 50, source: 'Tokyo 2018' },
    ];
    expect(computeExpectedSeverity(panelHigh).tier).toBe('high');

    // ES 25-49 -> moderate
    const panelMod = [
      { name: 'Uncomplicated UTI', probability: 1.0, severity: 25, source: 'IDSA 2019' },
    ];
    expect(computeExpectedSeverity(panelMod).tier).toBe('moderate');

    // ES < 25 -> low
    const panelLow = [
      { name: 'Tension Headache', probability: 1.0, severity: 10, source: 'IHS 2018' },
    ];
    expect(computeExpectedSeverity(panelLow).tier).toBe('low');
  });

  it('Adversarial normalization: handles probability sum > 1.0 and drops invalid severity', () => {
    const rawPanel = [
      { name: 'Condition A', probability: 0.60, severity: 10, source: 'Test' },
      { name: 'Condition B', probability: 0.60, severity: 25, source: 'Test' },
      { name: 'Invalid Severity Condition', probability: 0.40, severity: 67, source: 'Invalid' },
    ];

    const result = computeExpectedSeverity(rawPanel);
    // Invalid 67 dropped, valid sum = 1.2, normalized to 0.5 and 0.5
    expect(result.normalized_panel).toHaveLength(2);
    expect(result.normalized_panel[0].probability).toBe(0.5);
    expect(result.normalized_panel[1].probability).toBe(0.5);
    expect(result.expected_severity).toBe(17.5);
    expect(result.tier).toBe('low');
  });

  it('Replanner Rule 1 (SKIP): Skips dependent arm radiation question when radiation is None', () => {
    const state = {
      currentQId: 'q_chest_radiation',
      answers: {
        'q_chest_radiation': 'None'
      }
    };

    expect(isQuestionSkipped('q_chest_radiation_arm', state)).toBe(true);
    expect(isQuestionSkipped('q_chest_character', state)).toBe(false);
  });

  it('Replanner Rule 2 & 3 (PROBE & PRIORITY): Prioritizes high urgency probes in high tier', () => {
    const mockQuestionLow: InterviewQuestion = {
      id: 'q_timing',
      text: 'What time of day does it occur?',
      type: 'single_choice',
      next: () => null
    };

    const mockQuestionHigh: InterviewQuestion = {
      id: 'q_breath_severity',
      text: 'Are you experiencing severe shortness of breath?',
      type: 'single_choice',
      next: () => null
    };

    const scoreLow = getQuestionPriorityScore(mockQuestionLow, 'high');
    const scoreHigh = getQuestionPriorityScore(mockQuestionHigh, 'high');

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('Replanner Rule 4 (CLARIFY): Triggers clarification when voice confidence is under 0.6', () => {
    expect(shouldClarify({ currentQId: 'q1', answers: {}, smartVoiceConfidence: 0.45 })).toBe(true);
    expect(shouldClarify({ currentQId: 'q1', answers: {}, smartVoiceConfidence: 0.85 })).toBe(false);
  });

  it('Replanner main replan locks interview when tier is critical', () => {
    const mockTree: InterviewTree = {
      complaint: 'Chest pain',
      start_question_id: 'q1',
      questions: {
        q1: {
          id: 'q1',
          text: 'Severity',
          type: 'single_choice',
          next: () => 'q2'
        },
        q2: {
          id: 'q2',
          text: 'Radiation',
          type: 'single_choice',
          next: () => null
        }
      }
    };

    const state = {
      currentQId: 'q1',
      answers: { q1: '9' }
    };

    // When tier is critical -> interview stops (locks)
    const result = replan(mockTree, state, 'critical');
    expect(result).toBeNull();
  });
});
