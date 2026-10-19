import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
// AuthContext removed — doctor auth is handled via localStorage in DoctorLogin.tsx
import { Clock } from 'lucide-react';
import ConsentFlow from './pages/Kiosk/ConsentFlow';
import DoctorLogin from './pages/DoctorLogin';
import DoctorDashboard from './pages/Doctor/DoctorDashboard';
import InterviewFlow from './pages/InterviewFlow';
import MedicalHistoryFlow from './pages/MedicalHistoryFlow';
import DocumentUploadFlow from './pages/DocumentUploadFlow';
import AyushFlow from './pages/AyushFlow';
import TriageSummary from './pages/TriageSummary';
import PatientSubmitted from './pages/Kiosk/PatientSubmitted';
import PatientPreview from './pages/PatientPreview';
import WelcomeScreen from './pages/Kiosk/WelcomeScreen';
import DataFiduciaryNotice from './pages/Kiosk/DataFiduciaryNotice';
import PatientLogin from './pages/Patient/PatientLogin';
import PatientDashboard from './pages/Patient/PatientDashboard';
import AdminHospitals from './pages/Admin/AdminHospitals';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminGuard from './components/AdminGuard';
import TriageDashboard from './pages/Triage/TriageDashboard';
import AnalyticsDashboard from './pages/Admin/AnalyticsDashboard';
import LandingPage from './pages/LandingPage';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { AccessibilityToggle } from './components/AccessibilityToggle';
import OrchestrationMonitor from './components/OrchestrationMonitor';
import { prefetchHospitals } from './lib/prefetch';

const AdminProtectedRoute = AdminGuard;

function AppRoutes() {
  const location = useLocation();
  const [showTimeout, setShowTimeout] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showMonitor = location.pathname.startsWith('/admin');

  useEffect(() => {
    let warningTimeoutId: ReturnType<typeof setTimeout>;
    const IDLE_TIMEOUT_MINUTES = 10;
    const WARNING_TIME_MS = (IDLE_TIMEOUT_MINUTES * 60 - 30) * 1000; // 9m 30s

    const clearTimers = () => {
      clearTimeout(warningTimeoutId);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };

    const resetTimer = () => {
      if (showTimeout) return; // Don't reset if warning is already showing
      
      clearTimers();
      
      // Apply idle timeout to patient flows
      if (['/consent', '/interview', '/ayush-assessment', '/medical-history'].includes(location.pathname)) {
        warningTimeoutId = setTimeout(() => {
          setShowTimeout(true);
          setCountdown(30);
          
          countdownIntervalRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                // Time is up, hard reload
                const kioskKeys = [
                  'patient_session', 'session_id', 'chief_complaint', 'patient_complaint',
                  'patient_name', 'patient_age', 'patient_gender', 'patient_phone',
                  'patient_language', 'ayush_mode'
                ];
                kioskKeys.forEach(k => {
                  localStorage.removeItem(k);
                  sessionStorage.removeItem(k);
                });
                Object.keys(localStorage).forEach(key => {
                  if (key.startsWith('interview_')) {
                    localStorage.removeItem(key);
                  }
                });
                Object.keys(sessionStorage).forEach(key => {
                  if (key.startsWith('interview_')) {
                    sessionStorage.removeItem(key);
                  }
                });
                sessionStorage.removeItem('seen_data_fiduciary_notice');
                window.location.href = '/'; 
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }, WARNING_TIME_MS);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    
    resetTimer();

    return () => {
      clearTimers();
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [location.pathname]);

  // Task 2A.7: Prefetch /admin/hospitals on link hover
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a, button');
      if (!target) return;
      const href = target.getAttribute('href') || target.getAttribute('data-href');
      const label = target.getAttribute('aria-label');
      if (href?.includes('/admin/hospitals') || label === 'Hospital Admin' || target.textContent?.includes('Hospital Admin')) {
        prefetchHospitals();
      }
    };
    window.addEventListener('mouseover', handleMouseOver);
    return () => window.removeEventListener('mouseover', handleMouseOver);
  }, []);

  return (
    <>
      {showMonitor && <OrchestrationMonitor />}
      {showTimeout && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-fade-in">
            <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="text-terracotta" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-charcoal mb-4">Are you still there?</h2>
            <p className="text-charcoal/70 mb-6 text-lg">
              Your session will expire in <span className="font-bold text-terracotta">{countdown}</span> seconds to protect your privacy.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowTimeout(false);
                  if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                }}
                className="flex-1 bg-forest hover:bg-forest/90 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        {/* Hospital-specific entry points */}
        <Route path="/hospital/:hospitalId" element={<WelcomeScreen />} />
        <Route path="/hospital/:hospitalId/kiosk" element={<WelcomeScreen />} />
        <Route path="/hospital/:hospitalId/notice" element={<DataFiduciaryNotice />} />
        <Route path="/hospital/:hospitalId/consent" element={<ConsentFlow />} />
        <Route path="/hospital/:hospitalId/doctor" element={<DoctorLogin />} />
        <Route path="/hospital/:id/triage" element={<TriageDashboard />} />
        <Route path="/hospital/:hospitalId/triage" element={<TriageDashboard />} />
        <Route path="/hospital/:id/analytics" element={<AnalyticsDashboard />} />
        <Route path="/hospital/:hospitalId/analytics" element={<AnalyticsDashboard />} />
        
        {/* Generic patient kiosk flow */}
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/notice" element={<DataFiduciaryNotice />} />
        <Route path="/consent" element={<ConsentFlow />} />
        <Route path="/interview" element={<InterviewFlow />} />
        <Route path="/ayush-assessment" element={<AyushFlow />} />
        <Route path="/records-upload" element={<DocumentUploadFlow />} />
        <Route path="/submitted" element={<PatientSubmitted />} />
        <Route path="/preview" element={<PatientPreview />} />
        <Route path="/medical-history" element={<MedicalHistoryFlow />} />
        
        {/* Patient Portal Routes */}
        <Route path="/patient/login" element={<PatientLogin />} />
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/patient" element={<Navigate to="/patient/dashboard" replace />} />

        {/* Doctor Routes */}
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/triage/:sessionId" element={<TriageSummary />} />
        <Route path="/doctor" element={<Navigate to="/doctor/dashboard" replace />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Navigate to="/admin/hospitals" replace />} />
        <Route path="/admin/hospitals" element={<AdminGuard><AdminHospitals /></AdminGuard>} />
        <Route path="/admin/*" element={<AdminGuard><AdminHospitals /></AdminGuard>} />

        {/* Catch-all wildcard redirect to eliminate dead/404 pages */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <Router>
        <AppRoutes />
        <AccessibilityToggle />
      </Router>
    </AccessibilityProvider>
  );
}

export default App;
