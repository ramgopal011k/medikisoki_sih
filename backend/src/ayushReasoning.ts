export function reasonAyush(assessment: {
  prakriti: string;
  vikriti: string;
  agni: string;
  koshtha: string;
  sara: string;
  samhanana: string;
  pramana: string;
  satmya: string;
  sattva: string;
  ahara_shakti?: string;
  ahara_vihara?: string;
  vyayama_shakti: string;
  vaya: string;
}): {
  dominant_dosha: string;
  current_imbalance: string;
  samprapti_summary: string;
  ahara_recommendations: string[];
  vihara_recommendations: string[];
  clinical_focus_areas: string[];
  red_flags_ayush: string[];
  disclaimer: string;
} {
  const p = assessment.prakriti.toLowerCase();
  const v = assessment.vikriti.toLowerCase();
  const a = assessment.agni.toLowerCase();
  const k = assessment.koshtha.toLowerCase();

  let dominant_dosha = 'Tridosha';
  const firstWord = p.split(/[\s-]/)[0];
  if (firstWord.includes('vata')) dominant_dosha = 'Vata';
  else if (firstWord.includes('pitta')) dominant_dosha = 'Pitta';
  else if (firstWord.includes('kapha')) dominant_dosha = 'Kapha';

  let current_imbalance = 'Tridoshic Imbalance';
  if (v.includes('vata')) current_imbalance = 'Vata aggravation causing Malaavrodha and Rukshata';
  else if (v.includes('pitta')) current_imbalance = 'Pitta aggravation causing Daha and Paka';
  else if (v.includes('kapha')) current_imbalance = 'Kapha aggravation causing Gaurava and Srotorodha';

  let samprapti_summary = '';
  if (a.includes('manda') || a.includes('sluggish')) {
    samprapti_summary = `Manda Agni leading to Ama formation. ${current_imbalance}.`;
  } else if (a.includes('tikshna') || a.includes('intense')) {
    samprapti_summary = `Tikshna Agni causing Dhatu Kshaya. ${current_imbalance}.`;
  } else if (a.includes('visham') || a.includes('irregular')) {
    samprapti_summary = `Visham Agni leading to erratic digestion. ${current_imbalance}.`;
  } else {
    samprapti_summary = `Sama Agni maintains normal function, but ${current_imbalance} is present.`;
  }

  if (k.includes('krura') || k.includes('hard')) {
    samprapti_summary += ' Associated with Krura Koshtha and Vata disturbance.';
  } else if (k.includes('mridu') || k.includes('soft')) {
    samprapti_summary += ' Associated with Mridu Koshtha and Pitta predominance.';
  } else {
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
  if (assessment.sara.toLowerCase().includes('weak') && assessment.samhanana.toLowerCase().includes('loose')) {
    red_flags_ayush.push('Severe Dhatu Kshaya');
  }
  if (assessment.sattva.toLowerCase().includes('weak')) {
    red_flags_ayush.push('Avara Sattva requires psychological support');
  }

  return {
    dominant_dosha,
    current_imbalance,
    samprapti_summary,
    ahara_recommendations,
    vihara_recommendations,
    clinical_focus_areas,
    red_flags_ayush,
    disclaimer: 'This is an Ayurvedic assessment aid based on classical texts. Requires review by a qualified Ayurvedic physician.'
  };
}
