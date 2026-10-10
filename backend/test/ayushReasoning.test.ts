import { reasonAyush } from '../src/ayushReasoning';

describe('Ayush Reasoning Function', () => {
  it('should process Vata case correctly', () => {
    const vataCase = {
      prakriti: 'Vata-Pitta',
      vikriti: 'Vata',
      agni: 'Manda',
      koshtha: 'Krura',
      sara: 'Madhyama',
      samhanana: 'Avara',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Pravara',
      ahara_shakti: 'Avara',
      vyayama_shakti: 'Madhyama',
      vaya: 'Madhyama'
    };

    const result = reasonAyush(vataCase);

    expect(result).toHaveProperty('dominant_dosha');
    expect(result).toHaveProperty('current_imbalance');
    expect(result).toHaveProperty('samprapti_summary');
    expect(result).toHaveProperty('ahara_recommendations');
    expect(result).toHaveProperty('vihara_recommendations');
    expect(result).toHaveProperty('clinical_focus_areas');
    expect(result).toHaveProperty('red_flags_ayush');
    expect(result).toHaveProperty('disclaimer');

    expect(Array.isArray(result.ahara_recommendations)).toBe(true);
    expect(Array.isArray(result.vihara_recommendations)).toBe(true);
    expect(Array.isArray(result.clinical_focus_areas)).toBe(true);
    expect(Array.isArray(result.red_flags_ayush)).toBe(true);

    expect(result.dominant_dosha).toBe('Vata');
    
    const text = JSON.stringify(result);
    expect(text).toMatch(/Vata|Pitta|Kapha|Agni|Koshtha|Srotas|Dosha|Mala|Ama/i);
    expect(text).not.toMatch(/cancer|colorectal|IBS|GERD|hypertension/i);
    
    expect(result.disclaimer).toMatch(/Ayurvedic assessment aid/);
    expect(result.disclaimer).toMatch(/physician/);
  });

  it('should process Kapha case correctly and differ from Vata', () => {
    const kaphaCase = {
      prakriti: 'Kapha-Pitta',
      vikriti: 'Kapha',
      agni: 'Sama',
      koshtha: 'Mridu',
      sara: 'Madhyama',
      samhanana: 'Avara',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Pravara',
      ahara_shakti: 'Avara',
      vyayama_shakti: 'Madhyama',
      vaya: 'Madhyama'
    };

    const vataCase = {
      prakriti: 'Vata-Pitta',
      vikriti: 'Vata',
      agni: 'Manda',
      koshtha: 'Krura',
      sara: 'Madhyama',
      samhanana: 'Avara',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Pravara',
      ahara_shakti: 'Avara',
      vyayama_shakti: 'Madhyama',
      vaya: 'Madhyama'
    };

    const kaphaResult = reasonAyush(kaphaCase);
    const vataResult = reasonAyush(vataCase);

    expect(kaphaResult.dominant_dosha).not.toBe(vataResult.dominant_dosha);
    expect(kaphaResult.ahara_recommendations).not.toEqual(vataResult.ahara_recommendations);
    expect(kaphaResult.vihara_recommendations).not.toEqual(vataResult.vihara_recommendations);
  });

  it('should generate structured Nidana Panchaka and Samprapti Ghatakas without hallucination', () => {
    const fullCase = {
      prakriti: 'Vata-Kapha',
      vikriti: 'Vata',
      agni: 'Manda',
      koshtha: 'Krura',
      sara: 'Avara',
      samhanana: 'Avara',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Avara',
      ahara_shakti: 'Avara',
      vyayama_shakti: 'Avara',
      vaya: 'Madhyama',
      ahara_vihara: 'Excessive dry, cold food intake and irregular eating'
    };

    const result = reasonAyush(fullCase);

    expect(result).toHaveProperty('nidana_panchaka');
    expect(result).toHaveProperty('samprapti_ghatakas');

    // Nidana Panchaka fields
    expect(result.nidana_panchaka).toHaveProperty('nidana');
    expect(result.nidana_panchaka).toHaveProperty('purvarupa');
    expect(result.nidana_panchaka).toHaveProperty('rupa');
    expect(result.nidana_panchaka).toHaveProperty('upashaya');
    expect(result.nidana_panchaka).toHaveProperty('samprapti');

    expect(result.nidana_panchaka.nidana).toContain('dry, cold food');
    expect(result.nidana_panchaka.purvarupa).toBeNull(); // not provided -> null, never hallucinated!
    expect(result.nidana_panchaka.rupa).not.toBeNull();
    expect(result.nidana_panchaka.samprapti).toContain('Manda Agni');

    // Samprapti Ghatakas fields
    expect(result.samprapti_ghatakas).toHaveProperty('dosha');
    expect(result.samprapti_ghatakas).toHaveProperty('dushya');
    expect(result.samprapti_ghatakas).toHaveProperty('srotas');
    expect(result.samprapti_ghatakas).toHaveProperty('agni');
    expect(result.samprapti_ghatakas).toHaveProperty('ama');
    expect(result.samprapti_ghatakas).toHaveProperty('udbhava_sthana');
    expect(result.samprapti_ghatakas).toHaveProperty('vyakta_sthana');
    expect(result.samprapti_ghatakas).toHaveProperty('roga_marga');
    expect(result.samprapti_ghatakas).toHaveProperty('sadhya_asadhyata');

    expect(result.samprapti_ghatakas.dosha).toContain('Vata');
    expect(result.samprapti_ghatakas.agni).toBe('Manda');
    expect(result.samprapti_ghatakas.ama).toContain('Saama');
    expect(result.samprapti_ghatakas.udbhava_sthana).toContain('Pakvashaya');
    expect(result.samprapti_ghatakas.sadhya_asadhyata).toContain('Krichhra-Sadhya');
  });

  it('should return null for fields that cannot be determined from minimal input', () => {
    const minimalCase = {
      prakriti: '',
      vikriti: '',
      agni: '',
      koshtha: '',
      sara: '',
      samhanana: '',
      pramana: '',
      satmya: '',
      sattva: '',
      vyayama_shakti: '',
      vaya: ''
    };

    const result = reasonAyush(minimalCase);

    expect(result.nidana_panchaka.purvarupa).toBeNull();
    expect(result.nidana_panchaka.nidana).toBeNull();
    expect(result.samprapti_ghatakas.sadhya_asadhyata).toBeNull();
  });
});

