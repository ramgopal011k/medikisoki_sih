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
  ayushMode?: boolean;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  selectedRegions,
  onToggleRegion,
  language = 'en',
  className = '',
  ayushMode = false,
}) => {
  const [view, setView] = useState<'front' | 'back'>('front');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
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

  const getFill = (id: string) => {
    if (isSelected(id)) {
      if (id === 'chest' || id === 'left-arm') return 'url(#grad-selected-red)';
      return 'url(#grad-selected-green)';
    }
    return 'url(#grad-unselected)';
  };

  const getStroke = (id: string) => {
    if (isSelected(id)) return '#FFFFFF';
    return '#94A3B8';
  };

  return (
    <div className={`w-full max-w-4xl mx-auto bg-white rounded-[24px] border border-warmgray p-6 sm:p-8 shadow-sm ${className}`}>
      {/* Header row 1: Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary">
          {isMr ? 'परस्परसंवादी शरीर नकाशा' : isBn ? 'ইন্টারেক্টিভ বডি ম্যাপ' : isHi ? 'शरीर मानचित्र' : 'Interactive Body Map'}
        </span>
      </div>

      {/* Header row 2: Title and View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h3 className="font-display font-bold text-2xl text-charcoal leading-tight max-w-xl">
          {isMr ? 'डॉक्टरांना तुमची समस्या अधिक चांगल्या प्रकारे समजून घेण्यासाठी त्रास होत असलेले स्थान निवडा' : isBn ? 'ডাক্তারকে আপনার সমস্যাটি আরও ভালোভাবে বুঝতে সাহায্য করতে কোথায় সমস্যা হচ্ছে তা বেছে নিন' : isHi ? 'डॉक्टर को आपकी समस्या बेहतर समझने में मदद करने के लिए दर्द या परेशानी का स्थान चुनें' : 'Tap where it hurts to help the doctor better understand your issue'}
        </h3>
        
        {/* View Toggle (Front / Back) */}
        <div className="flex items-center gap-1 bg-sand p-1 rounded-xl border border-warmgray shrink-0">
          <button
            type="button"
            onClick={() => setView('front')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${view === 'front' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'}`}
          >
            {isMr ? 'पुढील दृश्य' : isBn ? 'সামনের' : isHi ? 'सामने' : 'Front View'}
          </button>
          <button
            type="button"
            onClick={() => setView('back')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${view === 'back' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'}`}
          >
            <RotateCw className="w-4 h-4" />
            {isMr ? 'मागील दृश्य' : isBn ? 'পিছনের' : isHi ? 'पीछे' : 'Back View'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <div className={`relative w-full max-w-[320px] mx-auto md:mx-0 aspect-[240/500] flex items-center justify-center bg-white rounded-[32px] border-2 border-sand p-2 shadow-xs`}>
          {/* Top-Right Marma Toggle (Visual Reference) */}
          {ayushMode && <div className="absolute top-4 right-4 flex items-center gap-2">
             <div className="w-4 h-4 text-charcoal/60">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             </div>
             <div className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
               Marma
             </div>
          </div>}
          <div className="absolute top-4 left-4">
             <span className="text-[10px] font-bold text-charcoal/60">{view === 'front' ? 'Front View' : 'Back View'}</span>
          </div>

          <svg
            viewBox="0 0 240 500"
            className="w-full h-full drop-shadow-sm select-none mt-6"
            role="img"
            aria-label="Human body diagram"
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
              </filter>
            </defs>

            {view === 'front' ? (
              <g>
                <path id="region-head" d="M 120 20 C 95 20 95 65 95 75 C 95 95 105 105 120 105 C 135 105 145 95 145 75 C 145 65 145 20 120 20 Z" fill={getFill('head')} stroke={isSelected('head') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('head') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('head')} />
                <text x="120" y="65" textAnchor="middle" fontSize="10" fontWeight="600" fill={isSelected('head') ? '#0369A1' : '#334155'} pointerEvents="none">Head</text>
                {ayushMode && <circle cx="120" cy="30" r="3" fill="#FBBF24" pointerEvents="none" />}

                <path id="region-neck" d="M 108 102 C 108 115 110 120 120 120 C 130 120 132 115 132 102 C 125 107 115 107 108 102 Z" fill={getFill('neck')} stroke={isSelected('neck') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('neck') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('neck')} />
                <text x="120" y="114" textAnchor="middle" fontSize="7" fontWeight="600" fill={isSelected('neck') ? '#0369A1' : '#334155'} pointerEvents="none">Neck</text>
                {ayushMode && <circle cx="120" cy="108" r="2.5" fill="#FBBF24" pointerEvents="none" />}

                <path id="region-chest" d="M 120 120 C 100 120 75 130 75 145 C 75 170 85 190 120 190 C 155 190 165 170 165 145 C 165 130 140 120 120 120 Z" fill={getFill('chest')} stroke={isSelected('chest') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('chest') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('chest')} />
                <text x="120" y="160" textAnchor="middle" fontSize="11" fontWeight="600" fill={isSelected('chest') ? '#991B1B' : '#334155'} pointerEvents="none">Chest</text>
                {ayushMode && <circle cx="120" cy="175" r="3" fill="#EF4444" pointerEvents="none" />}

                <path id="region-upper-abdomen" d="M 83 190 C 85 220 85 240 120 240 C 155 240 155 220 157 190 C 135 195 105 195 83 190 Z" fill={getFill('upper-abdomen')} stroke={isSelected('upper-abdomen') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('upper-abdomen') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('upper-abdomen')} />
                <text x="120" y="220" textAnchor="middle" fontSize="10" fontWeight="600" fill={isSelected('upper-abdomen') ? '#0369A1' : '#334155'} pointerEvents="none">Upper Abd</text>
                {ayushMode && <circle cx="120" cy="205" r="3" fill="#34D399" pointerEvents="none" />}

                <path id="region-lower-abdomen" d="M 85 240 C 82 270 88 290 120 290 C 152 290 158 270 155 240 C 140 242 100 242 85 240 Z" fill={getFill('lower-abdomen')} stroke={isSelected('lower-abdomen') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('lower-abdomen') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('lower-abdomen')} />
                <text x="120" y="270" textAnchor="middle" fontSize="10" fontWeight="600" fill={isSelected('lower-abdomen') ? '#0369A1' : '#334155'} pointerEvents="none">Lower Abd</text>
                {ayushMode && <circle cx="120" cy="255" r="3" fill="#34D399" pointerEvents="none" />}

                <path id="region-pelvis" d="M 88 290 C 95 320 115 325 120 325 C 125 325 145 320 152 290 C 135 295 105 295 88 290 Z" fill={getFill('pelvis')} stroke={isSelected('pelvis') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('pelvis') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('pelvis')} />
                <text x="120" y="310" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('pelvis') ? '#0369A1' : '#334155'} pointerEvents="none">Pelvis</text>
                {ayushMode && <circle cx="120" cy="315" r="3" fill="#34D399" pointerEvents="none" />}

                <path id="region-right-arm" d="M 75 145 C 55 155 35 220 35 270 C 35 285 50 285 50 270 C 55 220 65 170 83 190 Z" fill={getFill('right-arm')} stroke={isSelected('right-arm') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('right-arm') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('right-arm')} />
                <text x="50" y="215" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('right-arm') ? '#0369A1' : '#334155'} pointerEvents="none">R Arm</text>
                {ayushMode && <circle cx="65" cy="155" r="3" fill="#60A5FA" pointerEvents="none" />}
                {ayushMode && <circle cx="45" cy="210" r="3" fill="#60A5FA" pointerEvents="none" />}
                {ayushMode && <circle cx="42" cy="265" r="3" fill="#60A5FA" pointerEvents="none" />}

                <path id="region-left-arm" d="M 165 145 C 185 155 205 220 205 270 C 205 285 190 285 190 270 C 185 220 175 170 157 190 Z" fill={getFill('left-arm')} stroke={isSelected('left-arm') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('left-arm') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('left-arm')} />
                <text x="190" y="215" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('left-arm') ? '#0369A1' : '#334155'} pointerEvents="none">L Arm</text>
                {ayushMode && <circle cx="175" cy="155" r="3" fill="#60A5FA" pointerEvents="none" />}
                {ayushMode && <circle cx="195" cy="210" r="3" fill="#60A5FA" pointerEvents="none" />}
                {ayushMode && <circle cx="198" cy="265" r="3" fill="#60A5FA" pointerEvents="none" />}

                <path id="region-right-leg" d="M 88 290 C 85 340 75 420 75 460 C 75 475 95 475 95 460 C 105 400 115 340 120 325 Z" fill={getFill('right-leg')} stroke={isSelected('right-leg') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('right-leg') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('right-leg')} />
                <text x="90" y="395" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('right-leg') ? '#0369A1' : '#334155'} pointerEvents="none">R Leg</text>
                {ayushMode && <circle cx="95" cy="340" r="3" fill="#34D399" pointerEvents="none" />}
                {ayushMode && <circle cx="88" cy="410" r="3" fill="#34D399" pointerEvents="none" />}
                {ayushMode && <circle cx="85" cy="465" r="3" fill="#34D399" pointerEvents="none" />}

                <path id="region-left-leg" d="M 152 290 C 155 340 165 420 165 460 C 165 475 145 475 145 460 C 135 400 125 340 120 325 Z" fill={getFill('left-leg')} stroke={isSelected('left-leg') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('left-leg') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('left-leg')} />
                <text x="150" y="395" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('left-leg') ? '#0369A1' : '#334155'} pointerEvents="none">L Leg</text>
                {ayushMode && <circle cx="145" cy="340" r="3" fill="#34D399" pointerEvents="none" />}
                {ayushMode && <circle cx="152" cy="410" r="3" fill="#34D399" pointerEvents="none" />}
                {ayushMode && <circle cx="155" cy="465" r="3" fill="#34D399" pointerEvents="none" />}
              </g>
            ) : (
              <g>
                <path d="M 120 20 C 95 20 95 65 95 75 C 95 95 105 105 120 105 C 135 105 145 95 145 75 C 145 65 145 20 120 20 Z" fill={getFill('head')} stroke={isSelected('head') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('head') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('head')} />
                <text x="120" y="65" textAnchor="middle" fontSize="10" fontWeight="600" fill={isSelected('head') ? '#0369A1' : '#334155'} pointerEvents="none">Head</text>
                {ayushMode && <circle cx="120" cy="30" r="3" fill="#FBBF24" pointerEvents="none" />}

                <path d="M 108 102 C 108 115 110 120 120 120 C 130 120 132 115 132 102 C 125 107 115 107 108 102 Z" fill={getFill('neck')} stroke={isSelected('neck') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('neck') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('neck')} />
                
                <path d="M 120 120 C 100 120 75 130 75 145 C 75 170 83 190 85 240 C 88 290 120 325 120 325 C 120 325 152 290 155 240 C 157 190 165 170 165 145 C 165 130 140 120 120 120 Z" fill={getFill('back')} stroke={isSelected('back') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('back') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('back')} />
                <line x1="120" y1="125" x2="120" y2="300" stroke={isSelected('back') ? '#0284C7' : '#94A3B8'} strokeWidth="1.5" strokeDasharray="4 4" pointerEvents="none" />
                <text x="120" y="210" textAnchor="middle" fontSize="11" fontWeight="600" fill={isSelected('back') ? '#0369A1' : '#334155'} pointerEvents="none">Back</text>
                {ayushMode && <circle cx="120" cy="150" r="3" fill="#FBBF24" pointerEvents="none" />}
                {ayushMode && <circle cx="120" cy="220" r="3" fill="#FBBF24" pointerEvents="none" />}
                {ayushMode && <circle cx="120" cy="280" r="3" fill="#FBBF24" pointerEvents="none" />}

                <path d="M 75 145 C 55 155 35 220 35 270 C 35 285 50 285 50 270 C 55 220 65 170 83 190 Z" fill={getFill('left-arm')} stroke={isSelected('left-arm') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('left-arm') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('left-arm')} />
                <text x="50" y="215" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('left-arm') ? '#0369A1' : '#334155'} pointerEvents="none">L Arm</text>

                <path d="M 165 145 C 185 155 205 220 205 270 C 205 285 190 285 190 270 C 185 220 175 170 157 190 Z" fill={getFill('right-arm')} stroke={isSelected('right-arm') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('right-arm') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('right-arm')} />
                <text x="190" y="215" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('right-arm') ? '#0369A1' : '#334155'} pointerEvents="none">R Arm</text>

                <path d="M 88 290 C 85 340 75 420 75 460 C 75 475 95 475 95 460 C 105 400 115 340 120 325 Z" fill={getFill('left-leg')} stroke={isSelected('left-leg') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('left-leg') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('left-leg')} />
                <text x="90" y="395" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('left-leg') ? '#0369A1' : '#334155'} pointerEvents="none">L Leg</text>

                <path d="M 152 290 C 155 340 165 420 165 460 C 165 475 145 475 145 460 C 135 400 125 340 120 325 Z" fill={getFill('right-leg')} stroke={isSelected('right-leg') ? '#0284C7' : '#67E8F9'} strokeWidth={isSelected('right-leg') ? 2.5 : 2} className="cursor-pointer transition-all hover:brightness-95" onClick={() => onToggleRegion('right-leg')} />
                <text x="150" y="395" textAnchor="middle" fontSize="9" fontWeight="600" fill={isSelected('right-leg') ? '#0369A1' : '#334155'} pointerEvents="none">R Leg</text>
              </g>
            )}
          </svg>
        </div>
        {/* 12 Regions Pills & Quick Selector */}
        <div className="flex-1 w-full text-left">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-6">
            {isMr ? 'सर्व शारीरिक भाग (निवडण्यासाठी टॅप करा)' : isBn ? 'সকল শারীরিক অঞ্চল (নির্বাচন করতে ট্যাপ করুন)' : isHi ? 'सभी शारीरिक क्षेत्र (टैप करें)' : 'Body Regions (Tap to select)'}
          </p>
          
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {[
              { title: 'Head & Neck', ids: ['head', 'neck'] },
              { title: 'Torso', ids: ['chest', 'upper-abdomen', 'lower-abdomen', 'back', 'pelvis'] },
              { title: 'Limbs', ids: ['left-arm', 'right-arm', 'left-leg', 'right-leg'] },
              { title: 'General', ids: ['other'] }
            ].map(group => (
              <div key={group.title}>
                <h4 className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-3">{group.title}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {group.ids.map(id => {
                    const region = BODY_REGIONS.find(r => r.id === id);
                    if (!region) return null;
                    const active = isSelected(region.id);
                    return (
                      <button
                        key={region.id}
                        type="button"
                        onClick={() => onToggleRegion(region.id)}
                        className={`px-4 py-3 rounded-[16px] text-sm font-semibold flex items-center justify-between transition-all border ${
                          active
                            ? 'bg-primary/10 text-primary border-primary shadow-xs'
                            : 'bg-sand/40 text-charcoal border-transparent hover:border-primary/30'
                        }`}
                      >
                        <span className="truncate">{getRegionName(region)}</span>
                        {active && <Check className="w-4 h-4 shrink-0 ml-1 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
