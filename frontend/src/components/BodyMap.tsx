import React, { useState } from 'react';
import { RotateCw, Check, Info } from 'lucide-react';

export interface BodyRegion {
  id: string;
  name: string;
  name_hi: string;
  name_mr?: string;
  name_bn?: string;
  view: 'front' | 'back' | 'both';
}

export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', name: 'Head', name_hi: 'सिर', name_mr: 'डोके', name_bn: 'মাথা', view: 'both' },
  { id: 'neck', name: 'Neck', name_hi: 'गर्दन', name_mr: 'मान', name_bn: 'ঘাড়', view: 'both' },
  { id: 'chest', name: 'Chest', name_hi: 'छाती', name_mr: 'छाती', name_bn: 'বুক', view: 'front' },
  { id: 'upper-abdomen', name: 'Upper Abdomen', name_hi: 'ऊपरी पेट', name_mr: 'वरचे पोट', name_bn: 'উপরের পেট', view: 'front' },
  { id: 'lower-abdomen', name: 'Lower Abdomen', name_hi: 'निचला पेट', name_mr: 'खालचे पोट', name_bn: 'তলপেট', view: 'front' },
  { id: 'pelvis', name: 'Pelvis', name_hi: 'पेल्विस', name_mr: 'ओटीपोट', name_bn: 'শ্রোণীদেশ', view: 'front' },
  { id: 'left-arm', name: 'Left Arm', name_hi: 'बायां हाथ', name_mr: 'डावा हात', name_bn: 'বাম হাত', view: 'both' },
  { id: 'right-arm', name: 'Right Arm', name_hi: 'दायां हाथ', name_mr: 'उजवा हात', name_bn: 'ডান হাত', view: 'both' },
  { id: 'left-leg', name: 'Left Leg', name_hi: 'बायां पैर', name_mr: 'डावा पाय', name_bn: 'বাম পা', view: 'both' },
  { id: 'right-leg', name: 'Right Leg', name_hi: 'दायां पैर', name_mr: 'उजवा पाय', name_bn: 'ডান পা', view: 'both' },
  { id: 'back', name: 'Back', name_hi: 'पीठ', name_mr: 'पाठ', name_bn: 'পিঠ', view: 'back' },
  { id: 'other', name: 'Other / Whole Body', name_hi: 'अन्य / पूरा शरीर', name_mr: 'इतर / संपूर्ण शरीर', name_bn: 'অন্যান্য / পুরো শরীর', view: 'both' },
];

export const REGION_TO_COMPLAINT_SUGGESTIONS: Record<string, string[]> = {
  head: ['Headache'],
  neck: ['Headache', 'Other'],
  chest: ['Chest pain'],
  'upper-abdomen': ['Abdominal pain'],
  'lower-abdomen': ['Abdominal pain'],
  'left-arm': ['Chest pain'], // Left arm radiation (cardiac)
  'right-arm': ['Other'],
  'left-leg': ['Back pain', 'Other'],
  'right-leg': ['Back pain', 'Other'],
  back: ['Back pain'],
  pelvis: ['Abdominal pain', 'Back pain'],
  other: ['Other', 'Fever', 'Cough'],
};

export interface BodyMapProps {
  selectedRegions: string[];
  onToggleRegion: (regionId: string) => void;
  language?: 'en' | 'hi' | string;
  className?: string;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  selectedRegions,
  onToggleRegion,
  language = 'en',
  className = '',
}) => {
  const [view, setView] = useState<'front' | 'back'>('front');
  const isHi = language.startsWith('hi');
  const isMr = language.startsWith('mr');
  const isBn = language.startsWith('bn');

  const getRegionName = (reg: BodyRegion) => {
    if (isMr && reg.name_mr) return reg.name_mr;
    if (isBn && reg.name_bn) return reg.name_bn;
    if (isHi && reg.name_hi) return reg.name_hi;
    return reg.name;
  };

  const isSelected = (id: string) => selectedRegions.includes(id);

  const getFill = (id: string, defaultFill = '#E2E8F0') => {
    if (isSelected(id)) {
      if (id === 'chest' || id === 'left-arm') return '#DC2626'; // Red highlight for cardiac/chest
      return '#0D5C3A'; // Primary green highlight
    }
    return defaultFill;
  };

  const getStroke = (id: string) => {
    if (isSelected(id)) return '#FFFFFF';
    return '#94A3B8';
  };

  return (
    <div className={`w-full max-w-2xl mx-auto bg-white rounded-2xl border-2 border-warmgray p-5 shadow-sm ${className}`}>
      {/* Header with Title and Front/Back Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-warmgray/60 mb-4">
        <div className="text-left w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {isMr ? 'परस्परसंवादी शरीर नकाशा' : isBn ? 'ইন্টারেক্টিভ বডি ম্যাপ' : isHi ? 'शरीर मानचित्र' : 'Interactive Body Map'}
            </span>
            {selectedRegions.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                {selectedRegions.length} {isMr ? 'स्थान निवडले' : isBn ? 'স্থান নির্বাচিত' : isHi ? 'स्थान चयनित' : 'selected'}
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-lg text-charcoal mt-1">
            {isMr ? 'त्रास होत असलेले स्थान निवडा (पर्यायी)' : isBn ? 'কোথায় সমস্যা হচ্ছে তা বেছে নিন (ঐচ্ছিক)' : isHi ? 'दर्द या परेशानी का स्थान चुनें (वैकल्पिक)' : 'Tap where it hurts (optional)'}
          </h3>
        </div>

        {/* View Toggle (Front / Back) */}
        <div className="flex items-center gap-2 bg-sand p-1 rounded-xl border border-warmgray shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setView('front')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              view === 'front' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'
            }`}
          >
            {isMr ? 'पुढील दृश्य' : isBn ? 'সামনের দৃশ্য' : isHi ? 'सामने का दृश्य' : 'Front View'}
          </button>
          <button
            type="button"
            onClick={() => setView('back')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              view === 'back' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'
            }`}
          >
            <RotateCw className="w-3 h-3" />
            {isMr ? 'मागील दृश्य' : isBn ? 'পিছনের দৃশ্য' : isHi ? 'पीछे का दृश्य (Back)' : 'Back View'}
          </button>
        </div>
      </div>

      {/* SVG Interactive Body Diagram */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-2">
        <div className="relative w-full max-w-[240px] aspect-[240/440] flex items-center justify-center bg-sand/30 rounded-2xl border border-warmgray/50 p-2">
          <svg
            viewBox="0 0 240 440"
            className="w-full h-full drop-shadow-sm select-none"
            role="img"
            aria-label="Human body diagram"
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
              </filter>
            </defs>

            {view === 'front' ? (
              /* ── FRONT VIEW ── */
              <g>
                {/* Head */}
                <path
                  id="region-head"
                  d="M 120 18 C 102 18 92 36 92 56 C 92 78 106 95 120 95 C 134 95 148 78 148 56 C 148 36 138 18 120 18 Z"
                  fill={getFill('head')}
                  stroke={getStroke('head')}
                  strokeWidth={isSelected('head') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('head')}
                />
                <text x="120" y="60" textAnchor="middle" fontSize="10" fontWeight="bold" fill={isSelected('head') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'डोके' : isBn ? 'মাথা' : isHi ? 'सिर' : 'Head'}
                </text>

                {/* Neck */}
                <path
                  id="region-neck"
                  d="M 112 95 L 128 95 L 132 112 L 108 112 Z"
                  fill={getFill('neck')}
                  stroke={getStroke('neck')}
                  strokeWidth={isSelected('neck') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('neck')}
                />

                {/* Chest */}
                <path
                  id="region-chest"
                  d="M 98 112 L 142 112 L 152 165 L 88 165 Z"
                  fill={getFill('chest')}
                  stroke={getStroke('chest')}
                  strokeWidth={isSelected('chest') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('chest')}
                />
                <text x="120" y="142" textAnchor="middle" fontSize="11" fontWeight="bold" fill={isSelected('chest') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'छाती' : isBn ? 'বুক' : isHi ? 'छाती' : 'Chest'}
                </text>

                {/* Upper Abdomen */}
                <path
                  id="region-upper-abdomen"
                  d="M 88 165 L 152 165 L 149 205 L 91 205 Z"
                  fill={getFill('upper-abdomen')}
                  stroke={getStroke('upper-abdomen')}
                  strokeWidth={isSelected('upper-abdomen') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('upper-abdomen')}
                />
                <text x="120" y="188" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('upper-abdomen') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'वरचे पोट' : isBn ? 'উপরের পেট' : isHi ? 'ऊपरी पेट' : 'Upper Abd'}
                </text>

                {/* Lower Abdomen */}
                <path
                  id="region-lower-abdomen"
                  d="M 91 205 L 149 205 L 146 238 L 94 238 Z"
                  fill={getFill('lower-abdomen')}
                  stroke={getStroke('lower-abdomen')}
                  strokeWidth={isSelected('lower-abdomen') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('lower-abdomen')}
                />
                <text x="120" y="224" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('lower-abdomen') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'खालचे पोट' : isBn ? 'নিচের পেট' : isHi ? 'निचला पेट' : 'Lower Abd'}
                </text>

                {/* Pelvis */}
                <path
                  id="region-pelvis"
                  d="M 94 238 L 146 238 L 142 270 L 120 280 L 98 270 Z"
                  fill={getFill('pelvis')}
                  stroke={getStroke('pelvis')}
                  strokeWidth={isSelected('pelvis') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('pelvis')}
                />
                <text x="120" y="258" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('pelvis') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'ओटीपोट' : isBn ? 'পেলভিস' : isHi ? 'पेल्विस' : 'Pelvis'}
                </text>

                {/* Right Arm (Viewer left) */}
                <path
                  id="region-right-arm"
                  d="M 88 116 L 62 180 L 52 245 L 66 248 L 76 190 L 96 138 Z"
                  fill={getFill('right-arm')}
                  stroke={getStroke('right-arm')}
                  strokeWidth={isSelected('right-arm') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('right-arm')}
                />
                <text x="68" y="195" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isSelected('right-arm') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'उजवा हात' : isBn ? 'ডান হাত' : isHi ? 'दायां' : 'R Arm'}
                </text>

                {/* Left Arm (Viewer right) */}
                <path
                  id="region-left-arm"
                  d="M 152 116 L 178 180 L 188 245 L 174 248 L 164 190 L 144 138 Z"
                  fill={getFill('left-arm')}
                  stroke={getStroke('left-arm')}
                  strokeWidth={isSelected('left-arm') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('left-arm')}
                />
                <text x="172" y="195" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isSelected('left-arm') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'डावा हात' : isBn ? 'বাম হাত' : isHi ? 'बायां' : 'L Arm'}
                </text>

                {/* Right Leg (Viewer left) */}
                <path
                  id="region-right-leg"
                  d="M 98 270 L 118 280 L 115 365 L 118 420 L 102 420 L 98 365 L 94 300 Z"
                  fill={getFill('right-leg')}
                  stroke={getStroke('right-leg')}
                  strokeWidth={isSelected('right-leg') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('right-leg')}
                />
                <text x="108" y="350" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isSelected('right-leg') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'उजवा पाय' : isBn ? 'ডান পা' : isHi ? 'दायां पैर' : 'R Leg'}
                </text>

                {/* Left Leg (Viewer right) */}
                <path
                  id="region-left-leg"
                  d="M 122 280 L 142 270 L 146 300 L 142 365 L 138 420 L 122 420 L 125 365 Z"
                  fill={getFill('left-leg')}
                  stroke={getStroke('left-leg')}
                  strokeWidth={isSelected('left-leg') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('left-leg')}
                />
                <text x="132" y="350" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isSelected('left-leg') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'डावा पाय' : isBn ? 'বাম পা' : isHi ? 'बायां पैर' : 'L Leg'}
                </text>
              </g>
            ) : (
              /* ── BACK VIEW ── */
              <g>
                {/* Back of Head */}
                <path
                  id="region-head-back"
                  d="M 120 18 C 102 18 92 36 92 56 C 92 78 106 95 120 95 C 134 95 148 78 148 56 C 148 36 138 18 120 18 Z"
                  fill={getFill('head')}
                  stroke={getStroke('head')}
                  strokeWidth={isSelected('head') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('head')}
                />
                <text x="120" y="60" textAnchor="middle" fontSize="10" fontWeight="bold" fill={isSelected('head') ? '#FFF' : '#475569'} pointerEvents="none">
                  {isMr ? 'डोके (मागे)' : isBn ? 'মাথা (পিছন)' : isHi ? 'सिर (पीछे)' : 'Head'}
                </text>

                {/* Back of Neck */}
                <path
                  id="region-neck-back"
                  d="M 112 95 L 128 95 L 132 112 L 108 112 Z"
                  fill={getFill('neck')}
                  stroke={getStroke('neck')}
                  strokeWidth={isSelected('neck') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('neck')}
                />

                {/* Entire Back (Upper + Lower Spine) */}
                <path
                  id="region-back"
                  d="M 98 112 L 142 112 L 146 238 L 94 238 Z"
                  fill={getFill('back')}
                  stroke={getStroke('back')}
                  strokeWidth={isSelected('back') ? 3 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('back')}
                />
                {/* Spine line indicator */}
                <line x1="120" y1="114" x2="120" y2="236" stroke={isSelected('back') ? '#FFFFFF' : '#CBD5E1'} strokeWidth="2" strokeDasharray="3 3" pointerEvents="none" />
                <text x="120" y="178" textAnchor="middle" fontSize="13" fontWeight="bold" fill={isSelected('back') ? '#FFF' : '#334155'} pointerEvents="none">
                  {isMr ? 'पाठ' : isBn ? 'পিঠ' : isHi ? 'पीठ (Back)' : 'Back'}
                </text>

                {/* Pelvis/Gluteal from back */}
                <path
                  id="region-pelvis-back"
                  d="M 94 238 L 146 238 L 142 270 L 120 280 L 98 270 Z"
                  fill={getFill('pelvis')}
                  stroke={getStroke('pelvis')}
                  strokeWidth={isSelected('pelvis') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('pelvis')}
                />

                {/* Arms & Legs in Back view */}
                <path
                  d="M 88 116 L 62 180 L 52 245 L 66 248 L 76 190 L 96 138 Z"
                  fill={getFill('left-arm')}
                  stroke={getStroke('left-arm')}
                  strokeWidth={isSelected('left-arm') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('left-arm')}
                />
                <path
                  d="M 152 116 L 178 180 L 188 245 L 174 248 L 164 190 L 144 138 Z"
                  fill={getFill('right-arm')}
                  stroke={getStroke('right-arm')}
                  strokeWidth={isSelected('right-arm') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('right-arm')}
                />
                <path
                  d="M 98 270 L 118 280 L 115 365 L 118 420 L 102 420 L 98 365 L 94 300 Z"
                  fill={getFill('left-leg')}
                  stroke={getStroke('left-leg')}
                  strokeWidth={isSelected('left-leg') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('left-leg')}
                />
                <path
                  d="M 122 280 L 142 270 L 146 300 L 142 365 L 138 420 L 122 420 L 125 365 Z"
                  fill={getFill('right-leg')}
                  stroke={getStroke('right-leg')}
                  strokeWidth={isSelected('right-leg') ? 2.5 : 1.5}
                  className="cursor-pointer transition-colors hover:opacity-90"
                  onClick={() => onToggleRegion('right-leg')}
                />
              </g>
            )}
          </svg>
        </div>

        {/* 12 Regions Pills & Quick Selector */}
        <div className="flex-1 w-full text-left">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2.5">
            {isMr ? 'सर्व १२ शारीरिक भाग (निवडण्यासाठी टॅप करा)' : isBn ? 'সকল ১২টি শারীরিক অঞ্চল (নির্বাচন করতে ট্যাপ করুন)' : isHi ? 'सभी 12 शारीरिक क्षेत्र (टैप करें)' : 'All 12 Body Regions (Tap to select)'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BODY_REGIONS.map((region) => {
              const active = isSelected(region.id);
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => onToggleRegion(region.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border-2 transition-all ${
                    active
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-sand/60 text-charcoal border-warmgray hover:border-primary/50 hover:bg-white'
                  }`}
                >
                  <span className="truncate">{getRegionName(region)}</span>
                  {active && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-white" />}
                </button>
              );
            })}
          </div>

          {/* Selected Summary Pill list */}
          {selectedRegions.length > 0 && (
            <div className="mt-4 p-3 bg-sand/80 rounded-xl border border-warmgray/60">
              <div className="flex items-center gap-1.5 text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>{isMr ? 'निवडलेले अवयव:' : isBn ? 'চিহ্নিত স্থান:' : isHi ? 'चयनित अंग:' : 'Indicated location(s):'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRegions.map((rId) => {
                  const reg = BODY_REGIONS.find((b) => b.id === rId);
                  return (
                    <span
                      key={rId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-primary border border-primary/20 shadow-2xs"
                    >
                      {reg ? getRegionName(reg) : rId}
                      <button
                        type="button"
                        onClick={() => onToggleRegion(rId)}
                        className="hover:text-danger ml-0.5"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default BodyMap;
