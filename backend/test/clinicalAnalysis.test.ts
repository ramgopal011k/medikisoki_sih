import { analyzeText } from '../src/clinicalAnalysis';

describe('Clinical Analysis Engine', () => {
  describe('Drug-Drug Interactions', () => {
    it('detects no interactions for single drug', async () => {
      const result = await analyzeText('Patient is taking amlodipine 5mg daily');
      expect(result.drugsDetected).toContain('amlodipine');
      expect(result.interactions).toHaveLength(0);
    });

    it('detects high-risk interaction between amlodipine and simvastatin', async () => {
      const result = await analyzeText('Prescribed amlodipine 5mg and simvastatin 20mg');
      expect(result.drugsDetected).toContain('amlodipine');
      expect(result.drugsDetected).toContain('simvastatin');
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].drugA).toBe('amlodipine');
      expect(result.interactions[0].drugB).toBe('simvastatin');
      expect(result.interactions[0].risk).toMatch(/High Risk/i);
    });

    it('detects high-risk interaction between warfarin and aspirin', async () => {
      const result = await analyzeText('History of warfarin anticoagulation, taking aspirin for pain');
      expect(result.drugsDetected).toContain('warfarin');
      expect(result.drugsDetected).toContain('aspirin');
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].risk).toMatch(/High Risk/i);
    });

    it('handles text with no medications gracefully', async () => {
      const result = await analyzeText('Patient reports mild seasonal cough for 2 days');
      expect(result.drugsDetected).toHaveLength(0);
      expect(result.interactions).toHaveLength(0);
    });
  });

  describe('Abnormal Lab Value Detection', () => {
    it('detects elevated HbA1c (> 6.5%)', async () => {
      const result = await analyzeText('Recent lab shows HbA1c 7.4%');
      expect(result.abnormalLabs).toHaveLength(1);
      expect(result.abnormalLabs[0]).toContain('HbA1c is elevated at 7.4%');
    });

    it('ignores normal HbA1c (<= 6.5%)', async () => {
      const result = await analyzeText('Recent lab shows HbA1c 5.4%');
      expect(result.abnormalLabs).toHaveLength(0);
    });

    it('detects elevated fasting glucose (> 100 mg/dL)', async () => {
      const result = await analyzeText('Fasting Glucose: 145 mg/dL');
      expect(result.abnormalLabs).toHaveLength(1);
      expect(result.abnormalLabs[0]).toContain('Glucose is elevated at 145');
    });

    it('detects elevated Blood Pressure (> 130/80)', async () => {
      const result = await analyzeText('Vitals on triage: BP 142/92');
      expect(result.abnormalLabs).toHaveLength(1);
      expect(result.abnormalLabs[0]).toContain('Blood Pressure is elevated at 142/92');
    });

    it('does not flag normal BP (<= 130/80)', async () => {
      const result = await analyzeText('Vitals on triage: BP 120/78');
      expect(result.abnormalLabs).toHaveLength(0);
    });
  });
});
