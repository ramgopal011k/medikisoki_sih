import { ALLOWED_SEVERITIES, type AllowedSeverity } from './clinicalSeverity';

export type Tier = 'critical' | 'high' | 'moderate' | 'low';

export interface DifferentialDiagnosis {
  name: string;
  probability: number;
  severity: AllowedSeverity | number;
  source: string;
}

export type DifferentialPanel = DifferentialDiagnosis[];

export interface ExpectedSeverityResult {
  expected_severity: number;
  safety_override: boolean;
  override_reason: string | null;
  tier: Tier;
  normalized_panel: DifferentialPanel;
}

export function computeExpectedSeverity(rawPanel: DifferentialPanel): ExpectedSeverityResult {
  if (!rawPanel || rawPanel.length === 0) {
    return {
      expected_severity: 0,
      safety_override: false,
      override_reason: null,
      tier: 'low',
      normalized_panel: [],
    };
  }

  // Filter valid severities and valid probabilities
  const valid = rawPanel.filter(d =>
    (ALLOWED_SEVERITIES as readonly number[]).includes(d.severity) &&
    typeof d.probability === 'number' &&
    !isNaN(d.probability) &&
    d.probability >= 0
  );

  if (valid.length === 0) {
    return {
      expected_severity: 50,
      safety_override: false,
      override_reason: 'Invalid panel data fallback',
      tier: 'high',
      normalized_panel: [],
    };
  }

  // Normalize probabilities if sum > 0
  const sumProb = valid.reduce((acc, curr) => acc + curr.probability, 0);
  const normalizedPanel: DifferentialPanel = valid.map(d => ({
    ...d,
    probability: sumProb > 0 ? Number((d.probability / sumProb).toFixed(4)) : 0,
  }));

  // Compute ES = sum(probability * severity)
  let es = 0;
  for (const d of normalizedPanel) {
    es += d.probability * d.severity;
  }
  es = Math.round(es * 100) / 100;

  // Check safety override: any (severity >= 85 AND probability >= 0.25)
  let safety_override = false;
  let override_reason: string | null = null;

  for (const d of normalizedPanel) {
    if (d.severity >= 85 && d.probability >= 0.25) {
      safety_override = true;
      override_reason = `Differential '${d.name}' with severity ${d.severity} has probability ${(d.probability * 100).toFixed(1)}% (>= 25%)`;
      break;
    }
  }

  // Tier assignment per specification:
  // Override triggered -> critical
  // ES >= 80 -> critical
  // ES 50-79 -> high
  // ES 25-49 -> moderate
  // ES < 25 -> low
  let tier: Tier = 'low';
  if (safety_override) {
    tier = 'critical';
  } else if (es >= 80) {
    tier = 'critical';
  } else if (es >= 50) {
    tier = 'high';
  } else if (es >= 25) {
    tier = 'moderate';
  } else {
    tier = 'low';
  }

  return {
    expected_severity: es,
    safety_override,
    override_reason,
    tier,
    normalized_panel: normalizedPanel,
  };
}
