// ⚠️ SYNC WARNING: This file is mirrored at frontend/src/lib/drugInteractions.ts.
// If you change rules here, update the other file and run:
//   cd backend && npm test -- drugInteractions.sync
// A failing sync test will block your PR.
/**
 * Deterministic Drug Interaction Engine
 * PS §3.3 Module B: Potential drug interactions for physician attention.
 * High-yield pairs for Indian OPD context (deterministic string matching, no LLM).
 */

export interface DrugInteractionRule {
  id: string;
  name: string;
  drugA: { name: string; aliases: string[] };
  drugB: { name: string; aliases: string[] };
  severity: 'critical' | 'major' | 'moderate';
  clinicalEffect: string;
  recommendation: string;
}

export interface DetectedInteraction {
  ruleId: string;
  name: string;
  drugAFound: string;
  drugBFound: string;
  severity: 'critical' | 'major' | 'moderate';
  clinicalEffect: string;
  recommendation: string;
  disclaimer: string;
}

export const DRUG_INTERACTION_RULES: DrugInteractionRule[] = [
  {
    id: 'DI-01',
    name: 'Warfarin + Aspirin',
    drugA: { name: 'Warfarin', aliases: ['warfarin', 'coumadin'] },
    drugB: { name: 'Aspirin', aliases: ['aspirin', 'ecosprin', 'acetylsalicylic'] },
    severity: 'critical',
    clinicalEffect: 'Synergistic anticoagulation and platelet inhibition substantially elevate major hemorrhagic risk.',
    recommendation: 'Avoid combination unless indicated for prosthetic cardiac valves with strict INR monitoring.'
  },
  {
    id: 'DI-02',
    name: 'Metformin + Contrast Media',
    drugA: { name: 'Metformin', aliases: ['metformin', 'glycomet', 'glucophage'] },
    drugB: { name: 'Contrast Agent', aliases: ['contrast', 'iodinated contrast', 'radiocontrast'] },
    severity: 'major',
    clinicalEffect: 'Contrast-induced nephropathy can impair metformin clearance, precipitating fatal lactic acidosis.',
    recommendation: 'Withhold metformin at time of or prior to iodinated contrast study and resume after 48h if eGFR stable.'
  },
  {
    id: 'DI-03',
    name: 'SSRI + Tramadol',
    drugA: { name: 'SSRI', aliases: ['fluoxetine', 'sertraline', 'escitalopram', 'paroxetine', 'citalopram', 'ssri'] },
    drugB: { name: 'Tramadol', aliases: ['tramadol', 'ultram', 'tramazac'] },
    severity: 'critical',
    clinicalEffect: 'Combined serotonin reuptake inhibition risks potentially fatal serotonin syndrome and seizure precipitation.',
    recommendation: 'Avoid concurrent prescribing. Consider alternative non-serotonergic analgesics.'
  },
  {
    id: 'DI-04',
    name: 'Statin + Macrolide',
    drugA: { name: 'Statin', aliases: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'atorva', 'statin'] },
    drugB: { name: 'Macrolide', aliases: ['clarithromycin', 'erythromycin', 'azithromycin', 'macrolide'] },
    severity: 'major',
    clinicalEffect: 'Potent CYP3A4 inhibition elevates statin systemic exposure, drastically increasing rhabdomyolysis and myopathy risk.',
    recommendation: 'Temporarily pause statin during macrolide therapy or select alternative antimicrobial.'
  },
  {
    id: 'DI-05',
    name: 'ACE Inhibitor + Potassium-sparing Diuretic',
    drugA: { name: 'ACEi', aliases: ['ramipril', 'enalapril', 'lisinopril', 'perindopril', 'cardace', 'acei'] },
    drugB: { name: 'K-Sparing Diuretic', aliases: ['spironolactone', 'aldactone', 'eplerenone', 'triamterene', 'amiloride'] },
    severity: 'major',
    clinicalEffect: 'Combined potassium retention predisposes to life-threatening severe hyperkalemia.',
    recommendation: 'Monitor serum potassium and renal parameters within 1 week of co-initiation and periodically thereafter.'
  },
  {
    id: 'DI-06',
    name: 'Methotrexate + NSAID',
    drugA: { name: 'Methotrexate', aliases: ['methotrexate', 'mtx', 'folitrax'] },
    drugB: { name: 'NSAID', aliases: ['ibuprofen', 'diclofenac', 'naproxen', 'piroxicam', 'combiflam', 'voveran', 'nsaid'] },
    severity: 'critical',
    clinicalEffect: 'NSAIDs reduce renal perfusion and tubular secretion of methotrexate, causing marrow suppression and toxic accumulation.',
    recommendation: 'Avoid combination with high-dose methotrexate; use paracetamol for analgesia if required.'
  },
  {
    id: 'DI-07',
    name: 'Clopidogrel + Omeprazole',
    drugA: { name: 'Clopidogrel', aliases: ['clopidogrel', 'plavix', 'clopilet', 'deplatt'] },
    drugB: { name: 'Omeprazole', aliases: ['omeprazole', 'esomeprazole', 'omez', 'prilosec'] },
    severity: 'moderate',
    clinicalEffect: 'Competitive CYP2C19 inhibition attenuates bioactivation of clopidogrel, diminishing antiplatelet protection.',
    recommendation: 'Substitute with pantoprazole or rabeprazole, which exert minimal CYP2C19 interference.'
  },
  {
    id: 'DI-08',
    name: 'Rifampicin + Oral Contraceptive',
    drugA: { name: 'Rifampicin', aliases: ['rifampicin', 'rifampin', 'rcine', 'akt-4'] },
    drugB: { name: 'Oral Contraceptive', aliases: ['oral contraceptive', 'ocp', 'ethinylestradiol', 'levonorgestrel', 'mala-d', 'mala-n'] },
    severity: 'major',
    clinicalEffect: 'Strong hepatic CYP3A4 induction dramatically accelerates estrogen/progestin clearance, causing contraceptive failure.',
    recommendation: 'Advise non-hormonal barrier contraception during treatment and for 28 days following completion.'
  },
  {
    id: 'DI-09',
    name: 'Digoxin + Loop/Thiazide Diuretic',
    drugA: { name: 'Digoxin', aliases: ['digoxin', 'lanoxin'] },
    drugB: { name: 'Diuretic', aliases: ['furosemide', 'lasix', 'hydrochlorothiazide', 'hctz', 'torsemide', 'dytor'] },
    severity: 'major',
    clinicalEffect: 'Diuretic-induced hypokalemia and hypomagnesemia sensitize cardiac myocardium to lethal digitalis arrhythmias.',
    recommendation: 'Ensure normokalemia (serum K+ >= 4.0 mEq/L) and routine digoxin serum monitoring.'
  },
  {
    id: 'DI-10',
    name: 'Allopurinol + Azathioprine',
    drugA: { name: 'Allopurinol', aliases: ['allopurinol', 'zyloric', 'zyloprim'] },
    drugB: { name: 'Azathioprine', aliases: ['azathioprine', 'imuran', 'azoran', '6-mercaptopurine', '6-mp'] },
    severity: 'critical',
    clinicalEffect: 'Xanthine oxidase blockade suppresses azathioprine degradation, leading to catastrophic pancytopenia.',
    recommendation: 'Dose-reduce azathioprine to 25-33% of standard dose or consider febuxostat/alternative urate-lowering therapy.'
  }
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesDrug(text: string, aliases: string[]): string | null {
  const norm = normalizeText(text);
  for (const alias of aliases) {
    const normAlias = normalizeText(alias);
    // Whole word match or substring check
    const regex = new RegExp(`\\b${normAlias}\\b`, 'i');
    if (regex.test(norm)) {
      return alias;
    }
  }
  return null;
}

/**
 * Deterministically checks a list of medication strings against the rule set.
 */
export function checkDrugInteractions(medications: string[]): DetectedInteraction[] {
  if (!Array.isArray(medications) || medications.length === 0) {
    return [];
  }

  const detected: DetectedInteraction[] = [];

  for (const rule of DRUG_INTERACTION_RULES) {
    let matchA: { original: string; matchedAlias: string } | null = null;
    let matchB: { original: string; matchedAlias: string } | null = null;

    for (const med of medications) {
      if (!matchA) {
        const aliasA = matchesDrug(med, rule.drugA.aliases);
        if (aliasA) {
          matchA = { original: med, matchedAlias: aliasA };
          continue;
        }
      }
      if (!matchB) {
        const aliasB = matchesDrug(med, rule.drugB.aliases);
        if (aliasB) {
          matchB = { original: med, matchedAlias: aliasB };
        }
      }
    }

    if (matchA && matchB) {
      detected.push({
        ruleId: rule.id,
        name: rule.name,
        drugAFound: matchA.original,
        drugBFound: matchB.original,
        severity: rule.severity,
        clinicalEffect: rule.clinicalEffect,
        recommendation: rule.recommendation,
        disclaimer: 'Rule-based — verify before prescribing.'
      });
    }
  }

  return detected;
}
