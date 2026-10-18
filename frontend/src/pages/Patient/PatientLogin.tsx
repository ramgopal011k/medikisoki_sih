import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { MandalaBackground } from '../../components/MandalaBackground';
import { QuestionCard } from '../../components/QuestionCard';
import { supabase } from '../../lib/supabase';
import { prefetchPatientVisits } from '@/lib/prefetch';
import { API_URL } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PatientLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 3) {
      setError('Password must be at least 3 characters.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (authError) throw authError;
        const pAbha = authData.user?.user_metadata?.abha_id;
        if (pAbha) {
          prefetchPatientVisits(pAbha);
        }
        navigate('/patient/dashboard');
      } else {
        if (abhaId.length !== 14) {
          throw new Error('Please enter a valid 14-digit ABHA ID.');
        }

        let signupSuccess = false;
        try {
          const res = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password, abhaId })
          });
          const result = await res.json();
          if (res.ok || res.status === 409) {
            signupSuccess = true;
          } else if (result.error) {
            console.warn('Backend signup notice:', result.error);
          }
        } catch (backendErr) {
          console.warn('Backend signup unreachable, falling back to direct auth:', backendErr);
        }

        if (!signupSuccess) {
          const { error: authError } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                abha_id: abhaId
              }
            }
          });
          if (authError) throw authError;
        }

        // Establish active session
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (signInErr) {
          if (signInErr.message.includes('Email not confirmed')) {
            throw new Error('Registration successful! Please check your email to confirm your account.');
          }
          throw signInErr;
        }

        prefetchPatientVisits(abhaId);
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      
      <div className="w-full max-w-[768px] z-10">
        <QuestionCard className="w-full text-center p-8">
          <div className="mb-8">
             <h1 className="font-display text-4xl text-charcoal mb-2">Patient Portal</h1>
             <h2 className="text-muted text-lg">{isLogin ? 'Log in to view your medical history' : 'Register to access your health records'}</h2>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4 max-w-sm mx-auto">
            <input 
              type="email" 
              placeholder="Email Address"
              required
              className="w-full text-center text-lg p-4 min-h-[56px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            
            <input 
              type="password" 
              placeholder="Password"
              required
              className="w-full text-center text-lg p-4 min-h-[56px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            {!isLogin && (
              <input 
                type="text" 
                placeholder="14-digit ABHA ID"
                required
                className="w-full text-center text-xl tracking-[0.2em] p-4 min-h-[56px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
                value={abhaId}
                onChange={e => setAbhaId(e.target.value.replace(/\D/g, '').slice(0, 14))}
              />
            )}
            
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            
            <Button 
              type="submit"
              disabled={loading}
              className="w-full min-h-[56px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body mt-4" 
            >
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
            </Button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-warmgray/30 text-sm text-muted">
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-primary hover:underline font-semibold"
            >
              {isLogin ? "Don't have an account? Register here" : "Already have an account? Log in"}
            </button>
          </div>
        </QuestionCard>
      </div>
    </div>
  );
}
