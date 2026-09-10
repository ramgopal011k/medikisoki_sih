import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, Mic, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAudio } from '../../hooks/useAudio';
import { MandalaBackground } from '../../components/MandalaBackground';
import { API_URL } from '@/lib/api';
import { useAsr } from '@/hooks/useAsr';

const complaintsMap: Record<string, string> = {
  'Fever': 'fever',
  'Cough': 'cough',
  'Stomach Pain': 'stomach_ache',
  'Headache': 'headache',
  'Chest Pain': 'chest_pain',
  'Other': 'other'
};

const complaints = Object.keys(complaintsMap);

export default function ChiefComplaint() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { speak, isPlaying } = useAudio();
  const { isListening, isProcessing, transcript, startListening, stopListening } = useAsr();

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      const patientLang = localStorage.getItem('patient_language') || 'en';
      startListening({
        lang: patientLang === 'hi' ? 'hi-IN' : 'en-IN',
        onResult: (text) => {
          const lower = text.toLowerCase();
          if (lower.includes('fever') || lower.includes('बुखार')) handleSelect('Fever');
          else if (lower.includes('chest') || lower.includes('pain') || lower.includes('छाती')) handleSelect('Chest Pain');
          else if (lower.includes('head') || lower.includes('सिर')) handleSelect('Headache');
          else if (lower.includes('stomach') || lower.includes('abdomen') || lower.includes('पेट')) handleSelect('Stomach Pain');
          else if (lower.includes('cough') || lower.includes('खांसी')) handleSelect('Cough');
          else handleSelect('Other');
        }
      });
    }
  };

  const handleSelect = async (complaintLabel: string) => {
    setLoading(true);
    try {
      const complaintId = complaintsMap[complaintLabel] || 'default';
      const sessionId = localStorage.getItem('session_id') || localStorage.getItem('patient_session') || crypto.randomUUID();
      localStorage.setItem('chief_complaint', complaintId);
      
      // If we don't have a session, create one
      if (!localStorage.getItem('patient_session')) {
        const { error } = await supabase.from('sessions').upsert({
          id: sessionId,
          hospital_id: '11111111-1111-1111-1111-111111111111',
          status: 'active'
        }).select().single();

        if (error) throw error;
        localStorage.setItem('patient_session', sessionId);
      }
      
      // Post to backend so it triggers red-flag logic if needed
      await fetch(`${API_URL}/api/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: 'chief_complaint',
          answer_text: complaintLabel
        })
      });

      // Check red flag
      const { data: session } = await supabase
        .from('sessions')
        .select('red_flag, locked')
        .eq('id', sessionId)
        .single();

      if (session && (session.red_flag || session.locked)) {
        navigate('/red-flag-alert');
        return;
      }

      navigate('/interview');
    } catch (err) {
      console.error(err);
      navigate('/interview');
    } finally {
      setLoading(false);
    }
  };

  const questionTitle = localStorage.getItem('patient_language') === 'hi' 
    ? 'आज आप यहाँ किस कारण आए हैं?' 
    : 'What brings you here today?';

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      <div className="w-full max-w-3xl z-10 flex flex-col items-center">
        
        {/* Main Card matching screenshot */}
        <div className="w-full bg-[#f7f4ed] rounded-[28px] sm:rounded-[32px] border border-[#e7e1d7] shadow-sm p-8 sm:p-10 md:p-12 flex flex-col">
          
          {/* Header with Title and Circular Audio Button */}
          <div className="flex justify-between items-start mb-8 sm:mb-10 w-full gap-4">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1f2937] leading-tight text-left">
              {questionTitle}
            </h1>
            <button 
              onClick={() => speak(questionTitle)}
              className="w-12 h-12 rounded-full bg-[#e3ded6] hover:bg-[#d8d2c8] text-[#4b5563] hover:text-[#1f2937] flex items-center justify-center transition-colors shadow-xs shrink-0 mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#8c7355]/30"
              title="Listen to question"
            >
              {isPlaying ? (
                <VolumeX className="w-6 h-6 animate-pulse" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xl font-body text-muted">Saving...</p>
            </div>
          ) : (
            <>
              {/* 2-Column Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full mb-8">
                {complaints.map(c => (
                  <button
                    key={c}
                    onClick={() => handleSelect(c)}
                    className="w-full min-h-[76px] sm:min-h-[84px] py-5 px-6 rounded-[18px] sm:rounded-[20px] text-lg sm:text-xl font-medium text-[#1f2937] bg-white border border-[#e5e0d8] shadow-xs hover:shadow-md hover:border-[#cbd5e1] hover:bg-[#faf8f5] active:scale-[0.99] transition-all flex items-center justify-center text-center cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#8c7355]/30"
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Voice input option */}
              <div className="w-full flex flex-col items-center border-t border-[#e5e0d8] pt-6">
                <p className="text-sm font-medium text-muted mb-3">Or speak your complaint (ASR):</p>
                <button
                  onClick={handleVoiceInput}
                  disabled={isProcessing}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-300 ${
                    isListening
                      ? 'bg-[#8c7355] scale-105 ring-2 ring-[#8c7355]/40'
                      : isProcessing
                      ? 'bg-amber-600'
                      : 'bg-[#8c7355] hover:bg-[#786146]'
                  }`}
                  title={isListening ? "Listening... Click to finish" : "Speak your complaint"}
                >
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
                </button>
                <p className="text-xs text-muted mt-2">
                  {isProcessing ? 'Processing audio...' : isListening ? 'Listening (tap to finish)...' : 'Tap to speak'}
                </p>
                {transcript && (
                  <p className="mt-2 text-primary font-semibold italic text-base">
                    "{transcript}"
                  </p>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
