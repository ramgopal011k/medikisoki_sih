const { reasonAyush } = require('./dist/ayushReasoning.js');

const vata = reasonAyush({
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
});

const kapha = reasonAyush({
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
});

console.log('--- Vata ---');
console.log(vata);
console.log('--- Kapha ---');
console.log(kapha);
