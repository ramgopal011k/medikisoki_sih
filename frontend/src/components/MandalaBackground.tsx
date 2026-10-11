import React from 'react';

export const MandalaBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 overflow-hidden">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="mandala-pattern" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
            {/* Center Core */}
            <circle cx="80" cy="80" r="3" fill="currentColor" />
            <circle cx="80" cy="80" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="80" cy="80" r="16" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />

            {/* Inner 8-Petal Lotus */}
            <path d="M80 64 C88 44 96 64 80 80 C64 64 72 44 80 64 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M80 96 C88 116 96 96 80 80 C64 96 72 116 80 96 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M96 80 C116 88 96 96 80 80 C96 64 116 72 96 80 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M64 80 C44 88 64 96 80 80 C64 64 44 72 64 80 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M91 69 C107 53 102 75 80 80 C75 58 97 53 91 69 Z" fill="none" stroke="currentColor" strokeWidth="0.75" />
            <path d="M69 91 C53 107 58 85 80 80 C85 102 63 107 69 91 Z" fill="none" stroke="currentColor" strokeWidth="0.75" />
            <path d="M91 91 C107 107 102 85 80 80 C75 102 97 107 91 91 Z" fill="none" stroke="currentColor" strokeWidth="0.75" />
            <path d="M69 69 C53 53 58 75 80 80 C85 58 63 53 69 69 Z" fill="none" stroke="currentColor" strokeWidth="0.75" />

            {/* Outer Enclosing Rings */}
            <circle cx="80" cy="80" r="36" fill="none" stroke="currentColor" strokeWidth="1.25" />
            <circle cx="80" cy="80" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4" />

            {/* Outer Large 4 Petals */}
            <path d="M80 40 C110 5 130 25 80 80 C30 25 50 5 80 40 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M80 120 C110 155 130 135 80 80 C30 135 50 155 80 120 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M120 80 C155 110 135 130 80 80 C135 30 155 50 120 80 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M40 80 C5 110 25 130 80 80 C25 30 5 50 40 80 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mandala-pattern)" />
      </svg>
    </div>
  );
};
