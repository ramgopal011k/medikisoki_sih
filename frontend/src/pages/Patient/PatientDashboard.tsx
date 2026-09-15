import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, FileJson, Calendar, LogOut } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { MandalaBackground } from '../../components/MandalaBackground';
import { API_URL } from '@/lib/api';
import { supabase } from '../../lib/supabase';

export default function PatientDashboard() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [abhaId, setAbhaId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) navigate('/patient/login');
          return;
        }

        const id = session.user?.user_metadata?.abha_id;
        if (id && mounted) {
          setAbhaId(id);
          fetchVisits(id);
        } else if (mounted) {
          navigate('/patient/login');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        if (mounted) navigate('/patient/login');
      }
    };

    const fetchVisits = async (id: string) => {
      try {
        const res = await fetch(`${API_URL}/api/patient/visits/${id}`);
        const data = await res.json();
        if (mounted) setVisits(data.data || []);
      } catch (err) {
        console.error('Failed to fetch visits:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAuth();
    
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/patient/login');
  };

  const handleRevokeConsent = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to revoke consent? This will permanently anonymize this visit record.')) return;
    try {
      const res = await fetch(`${API_URL}/api/patient/visits/${sessionId}/revoke`, { method: 'POST' });
      if (res.ok) {
        setVisits(visits.filter(v => v.id !== sessionId));
      }
    } catch (err) {
      console.error('Failed to revoke consent:', err);
    }
  };

  const handleDownloadFHIR = (sessionId: string) => {
    window.open(`${API_URL}/api/fhir/${sessionId}`, '_blank');
  };

  if (!abhaId) return null;

  return (
    <div className="min-h-screen bg-sand p-6 relative font-body text-charcoal">
      <MandalaBackground />
      
      <div className="max-w-[1024px] mx-auto z-10 relative">
        <header className="flex justify-between items-center mb-8 bg-white/80 backdrop-blur-md p-6 rounded-[24px] border border-white/50 shadow-sm">
          <div>
            <h1 className="font-display text-3xl text-charcoal mb-1">My Health Record</h1>
            <p className="text-muted text-sm font-medium">ABHA ID: <span className="tracking-widest ml-1">{abhaId}</span></p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-terracotta text-terracotta hover:bg-terracotta hover:text-white">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </header>

        {loading ? (
          <div className="text-center py-12">
            <Activity className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted">Loading your records...</p>
          </div>
        ) : visits.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md p-12 rounded-[24px] text-center shadow-sm">
            <h2 className="text-2xl font-display text-charcoal mb-2">No visits found</h2>
            <p className="text-muted">You have not completed any triage sessions yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {visits.map((visit) => {
              const summary = visit.summaries?.[0]?.content;
              const date = new Date(visit.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              });

              return (
                <div key={visit.id} className="bg-white/80 backdrop-blur-md p-6 rounded-[24px] border border-white/50 shadow-sm transition-all hover:shadow-md">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                        <Calendar className="w-5 h-5" />
                        <span>{date}</span>
                      </div>
                      <h3 className="text-xl font-display text-charcoal">
                        Chief Complaint: <span className="font-body text-terracotta">{visit.chief_complaint || 'N/A'}</span>
                      </h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        onClick={() => handleRevokeConsent(visit.id)}
                        variant="outline"
                        className="border-danger text-danger hover:bg-danger hover:text-white rounded-[12px]"
                      >
                        Revoke Consent
                      </Button>
                      <Button 
                        onClick={() => handleDownloadFHIR(visit.id)}
                        className="bg-charcoal hover:bg-charcoal/90 text-white rounded-[12px]"
                      >
                        <FileJson className="w-4 h-4 mr-2" /> View FHIR Bundle
                      </Button>
                    </div>
                  </div>

                  {summary ? (
                    <div className="bg-sand/50 p-4 rounded-[16px] border border-warmgray/30">
                      <h4 className="font-semibold text-charcoal mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" /> Clinical Summary
                      </h4>
                      
                      <div className="space-y-3 text-sm">
                        <div>
                          <strong className="text-charcoal block mb-1">History of Present Illness:</strong>
                          <ul className="list-disc pl-5 space-y-1 text-muted">
                            {summary.hpi?.map((h: string, i: number) => <li key={i}>{h.replace('- ', '')}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong className="text-charcoal block mb-1">Past Medical History / OCR:</strong>
                          <ul className="list-disc pl-5 space-y-1 text-muted">
                            {summary.past_history?.map((h: string, i: number) => <li key={i}>{h.replace('- ', '')}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted text-sm italic bg-sand/30 p-3 rounded-[12px]">Summary pending doctor review...</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
