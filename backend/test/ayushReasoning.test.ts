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
});
