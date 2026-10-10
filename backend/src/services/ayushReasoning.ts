export interface NidanaPanchaka {
  nidana: string | null;
  purvarupa: string | null;
  rupa: string | null;
  upashaya: string | null;
  samprapti: string | null;
}

export interface SampraptiGhatakas {
  dosha: string | null;
  dushya: string | null;
  srotas: string | null;
  agni: string | null;
  ama: string | null;
  udbhava_sthana: string | null;
  vyakta_sthana: string | null;
  roga_marga: string | null;
  sadhya_asadhyata: string | null;
}

export interface AyushAssessmentInput {
  prakriti?: string;
  vikriti?: string;
  agni?: string;
  koshtha?: string;
  sara?: string;
  samhanana?: string;
  pramana?: string;
  satmya?: string;
  sattva?: string;
  ahara_shakti?: string;
  ahara_vihara?: string;
  vyayama_shakti?: string;
  vaya?: string;
  chief_complaint?: string;
  symptoms?: string[];
  nidana?: string;
  purvarupa?: string;
  rupa?: string;
  upashaya?: string;
  dushya?: string;
  srotas?: string;
  ama?: string;
  [key: string]: any;
}

export interface AyushReasoningOutput {
  dominant_dosha: string;
  current_imbalance: string;
  samprapti_summary: string;
  ahara_recommendations: string[];
  vihara_recommendations: string[];
  clinical_focus_areas: string[];
  red_flags_ayush: string[];
  disclaimer: string;
  nidana_panchaka: NidanaPanchaka;
  samprapti_ghatakas: SampraptiGhatakas;
}

export function reasonAyush(assessment: AyushAssessmentInput): AyushReasoningOutput {
  const p = (assessment.prakriti || '').toLowerCase();
  const v = (assessment.vikriti || '').toLowerCase();
  const a = (assessment.agni || '').toLowerCase();
  const k = (assessment.koshtha || '').toLowerCase();

  let dominant_dosha = 'Tridosha';
  if (p) {
    const firstWord = p.split(/[\s-]/)[0];
    if (firstWord.includes('vata')) dominant_dosha = 'Vata';
    else if (firstWord.includes('pitta')) dominant_dosha = 'Pitta';
    else if (firstWord.includes('kapha')) dominant_dosha = 'Kapha';
  }

  let current_imbalance = 'Tridoshic Imbalance';
  if (v.includes('vata')) current_imbalance = 'Vata aggravation causing Malaavrodha and Rukshata';
  else if (v.includes('pitta')) current_imbalance = 'Pitta aggravation causing Daha and Paka';
  else if (v.includes('kapha')) current_imbalance = 'Kapha aggravation causing Gaurava and Srotorodha';
  else if (dominant_dosha !== 'Tridosha') current_imbalance = `${dominant_dosha} vriddhi`;

  let samprapti_summary = '';
  if (a.includes('manda') || a.includes('sluggish')) {
    samprapti_summary = `Manda Agni leading to Ama formation. ${current_imbalance}.`;
  } else if (a.includes('tikshna') || a.includes('intense')) {
    samprapti_summary = `Tikshna Agni causing Dhatu Kshaya. ${current_imbalance}.`;
  } else if (a.includes('visham') || a.includes('irregular')) {
    samprapti_summary = `Visham Agni leading to erratic digestion. ${current_imbalance}.`;
  } else if (a.includes('sama')) {
    samprapti_summary = `Sama Agni maintains normal function, but ${current_imbalance} is present.`;
  } else {
    samprapti_summary = current_imbalance;
  }

  if (k.includes('krura') || k.includes('hard')) {
    samprapti_summary += ' Associated with Krura Koshtha and Vata disturbance.';
  } else if (k.includes('mridu') || k.includes('soft')) {
    samprapti_summary += ' Associated with Mridu Koshtha and Pitta predominance.';
  } else if (k.includes('madhyama')) {
    samprapti_summary += ' Associated with Madhyama Koshtha.';
  }

  const ahara_by_dosha: Record<string, string[]> = {
    'Vata': [
      'Snigdha (unctuous) and Ushna (warm) foods.',
      'Sweet, sour, and salty tastes to pacify Vata.',
      'Avoid Ruksha (dry) and Sheeta (cold) items.'
    ],
    'Pitta': [
      'Sheeta (cooling) and Madhura (sweet) foods.',
      'Bitter and astringent tastes to pacify Pitta.',
      'Avoid Katu (pungent) and Amla (sour) items.'
    ],
    'Kapha': [
      'Ruksha (dry) and Ushna (warm) foods.',
      'Pungent, bitter, and astringent tastes.',
      'Avoid Madhura (sweet) and Snigdha (heavy) items.'
    ],
    'Tridosha': [
      'Balanced diet according to Ritucharya.',
      'Freshly cooked warm meals.'
    ]
  };

  const vihara_by_dosha: Record<string, string[]> = {
    'Vata': [
      'Daily Abhyanga with warm sesame oil.',
      'Adequate rest and mild Yoga.'
    ],
    'Pitta': [
      'Avoid excessive sun exposure.',
      'Cooling practices like Shitali pranayama.'
    ],
    'Kapha': [
      'Vigorous Vyayama (exercise) daily.',
      'Avoid Divaswapna (daytime sleep).'
    ],
    'Tridosha': [
      'Follow Dinacharya regularly.',
      'Moderate Vyayama based on strength.'
    ]
  };

  const ahara_recommendations = ahara_by_dosha[dominant_dosha] || ahara_by_dosha['Tridosha'];
  const vihara_recommendations = vihara_by_dosha[dominant_dosha] || vihara_by_dosha['Tridosha'];

  let clinical_focus_areas = ['Agni Deepana', 'Ama Pachana'];
  if (v.includes('vata')) clinical_focus_areas.push('Vata Anulomana');
  if (v.includes('pitta')) clinical_focus_areas.push('Rakta Prasadana');
  if (v.includes('kapha')) clinical_focus_areas.push('Kapha Nissarana');

  let red_flags_ayush: string[] = [];
  const saraStr = (assessment.sara || '').toLowerCase();
  const samhananaStr = (assessment.samhanana || '').toLowerCase();
  const sattvaStr = (assessment.sattva || '').toLowerCase();

  if (saraStr.includes('weak') && samhananaStr.includes('loose')) {
    red_flags_ayush.push('Severe Dhatu Kshaya');
  }
  if (sattvaStr.includes('weak')) {
    red_flags_ayush.push('Avara Sattva requires psychological support');
  }

  // --- Nidana Panchaka (Populated from existing inputs without hallucination) ---
  const nidana = assessment.nidana || assessment.ahara_vihara || (a.includes('manda') ? 'Mithya Ahara (irregular/heavy diet leading to Agnimandya)' : null);
  const purvarupa = assessment.purvarupa || null;
  const rupa = assessment.rupa || assessment.chief_complaint || (v ? current_imbalance : null);
  const upashaya = assessment.upashaya || (dominant_dosha !== 'Tridosha' ? `${dominant_dosha}-pacifying Ahara-Vihara` : null);
  const samprapti = samprapti_summary || null;

  const nidana_panchaka: NidanaPanchaka = {
    nidana: nidana || null,
    purvarupa: purvarupa || null,
    rupa: rupa || null,
    upashaya: upashaya || null,
    samprapti: samprapti || null
  };

  // --- Samprapti Ghatakas ---
  let doshaVal: string | null = null;
  if (assessment.vikriti || assessment.prakriti) {
    doshaVal = assessment.vikriti ? `${dominant_dosha} (Prakriti) / ${assessment.vikriti} (Vikriti)` : dominant_dosha;
  }

  let dushyaVal: string | null = null;
  if (assessment.dushya) {
    dushyaVal = assessment.dushya;
  } else if (v.includes('vata')) {
    dushyaVal = 'Rasa, Asthi, Purisha';
  } else if (v.includes('pitta')) {
    dushyaVal = 'Rakta, Sweda';
  } else if (v.includes('kapha')) {
    dushyaVal = 'Rasa, Meda, Kleda';
  } else if (dominant_dosha === 'Vata') {
    dushyaVal = 'Rasa, Asthi';
  } else if (dominant_dosha === 'Pitta') {
    dushyaVal = 'Rakta, Sweda';
  } else if (dominant_dosha === 'Kapha') {
    dushyaVal = 'Rasa, Meda';
  }

  let srotasVal: string | null = null;
  if (assessment.srotas) {
    srotasVal = assessment.srotas;
  } else if (a.length > 0 || k.length > 0) {
    srotasVal = 'Annavaha, Purishavaha Srotas';
  }

  let agniVal: string | null = null;
  if (assessment.agni) {
    agniVal = assessment.agni.charAt(0).toUpperCase() + assessment.agni.slice(1);
  }

  let amaVal: string | null = null;
  if (assessment.ama) {
    amaVal = assessment.ama;
  } else if (a.includes('manda') || a.includes('sluggish')) {
    amaVal = 'Saama (Ama present due to Mandagni)';
  } else if (a.includes('sama')) {
    amaVal = 'Niraama (No significant Ama)';
  } else if (a.includes('tikshna') || a.includes('visham')) {
    amaVal = 'Alpa Ama / Agni Vaishamya';
  }

  let udbhava_sthana: string | null = null;
  if (dominant_dosha === 'Vata' || v.includes('vata')) {
    udbhava_sthana = 'Pakvashaya (Colon / Lower Pelvis)';
  } else if (dominant_dosha === 'Pitta' || v.includes('pitta')) {
    udbhava_sthana = 'Amashaya / Grahani (Lower Stomach & Duodenum)';
  } else if (dominant_dosha === 'Kapha' || v.includes('kapha')) {
    udbhava_sthana = 'Amashaya / Uras (Upper Stomach & Thorax)';
  }

  let vyakta_sthana: string | null = null;
  if (k.includes('krura') || k.includes('mridu')) {
    vyakta_sthana = 'Purishadhara Kala / Koshtha';
  } else if (dominant_dosha === 'Vata') {
    vyakta_sthana = 'Pakvashaya, Kati, Sandhi';
  } else if (dominant_dosha === 'Pitta') {
    vyakta_sthana = 'Twak, Rakta, Netra';
  } else if (dominant_dosha === 'Kapha') {
    vyakta_sthana = 'Uras, Kantha, Shira';
  }

  let roga_marga: string | null = null;
  if (k.length > 0 || a.length > 0) {
    roga_marga = 'Abhyantara Roga Marga (Koshtha)';
  } else if (dominant_dosha) {
    roga_marga = 'Abhyantara Roga Marga';
  }

  let sadhya_asadhyata: string | null = null;
  if (assessment.sattva || assessment.sara || assessment.samhanana || assessment.vaya) {
    if (red_flags_ayush.length > 0 || saraStr.includes('avara') || samhananaStr.includes('avara')) {
      sadhya_asadhyata = 'Krichhra-Sadhya (Curable with intensive therapeutic supervision)';
    } else if (sattvaStr.includes('pravara') || saraStr.includes('madhyama') || saraStr.includes('pravara')) {
      sadhya_asadhyata = 'Sukha-Sadhya (Easily curable through Nidana Parivarjana and pathya)';
    } else {
      sadhya_asadhyata = 'Sukha-Sadhya to Krichhra-Sadhya';
    }
  }

  const samprapti_ghatakas: SampraptiGhatakas = {
    dosha: doshaVal,
    dushya: dushyaVal,
    srotas: srotasVal,
    agni: agniVal,
    ama: amaVal,
    udbhava_sthana,
    vyakta_sthana,
    roga_marga,
    sadhya_asadhyata
  };

  return {
    dominant_dosha,
    current_imbalance,
    samprapti_summary,
    ahara_recommendations,
    vihara_recommendations,
    clinical_focus_areas,
    red_flags_ayush,
    disclaimer: 'This is an Ayurvedic assessment aid based on classical texts. Requires review by a qualified Ayurvedic physician.',
    nidana_panchaka,
    samprapti_ghatakas
  };
}
