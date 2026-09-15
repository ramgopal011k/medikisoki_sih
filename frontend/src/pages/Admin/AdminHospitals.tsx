import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Bed, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  RefreshCw, 
  Flower2, 
  Stethoscope, 
  Activity,
  Sparkles,
  User,
  X
} from 'lucide-react';
import { API_URL } from '@/lib/api';

export interface Hospital {
  hospital_id: string;
  id: string;
  hospital_name: string;
  name: string;
  location: string;
  hospital_type: string;
  type: string;
  contact: string;
  bed_count: number;
  status: string;
  created_at: string;
}

export default function AdminHospitals() {
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'General' | 'Ayush'>('all');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    hospital_name: '',
    location: '',
    hospital_type: 'General',
    contact: '',
    bed_count: 100
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchHospitals = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/hospitals`);
      const data = await res.json();
      if (data.data) {
        setHospitals(data.data);
      }
    } catch (err) {
      console.error('Failed to load hospitals:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    fetchHospitals();
  }, [fetchHospitals]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast('Hospital ID copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenAdd = () => {
    setFormData({
      hospital_name: '',
      location: '',
      hospital_type: 'General',
      contact: '',
      bed_count: 100
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (h: Hospital) => {
    setSelectedHospital(h);
    setFormData({
      hospital_name: h.hospital_name || h.name,
      location: h.location,
      hospital_type: h.hospital_type || h.type || 'General',
      contact: h.contact,
      bed_count: h.bed_count || 100
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (h: Hospital) => {
    setSelectedHospital(h);
    setIsDeleteModalOpen(true);
  };

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hospital_name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/hospitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to register hospital');

      showToast(`Successfully registered "${formData.hospital_name}"!`);
      setIsAddModalOpen(false);
      fetchHospitals(true);
    } catch (err: any) {
      alert(err.message || 'Error registering hospital');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospital) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/hospitals/${selectedHospital.id || selectedHospital.hospital_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update hospital');

      showToast(`Updated "${formData.hospital_name}"!`);
      setIsEditModalOpen(false);
      fetchHospitals(true);
    } catch (err: any) {
      alert(err.message || 'Error updating hospital');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHospital = async () => {
    if (!selectedHospital) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/hospitals/${selectedHospital.id || selectedHospital.hospital_id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove hospital');

      showToast(`Removed facility "${selectedHospital.hospital_name || selectedHospital.name}"`);
      setIsDeleteModalOpen(false);
      fetchHospitals(true);
    } catch (err: any) {
      alert(err.message || 'Error deleting hospital');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter and search
  const filteredHospitals = hospitals.filter(h => {
    const nameMatch = (h.hospital_name || h.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const locMatch = (h.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    const contactMatch = (h.contact || '').includes(searchTerm);

    if (!nameMatch && !locMatch && !contactMatch) return false;

    if (typeFilter === 'General') {
      return (h.hospital_type || h.type || '').toLowerCase() === 'general';
    }
    if (typeFilter === 'Ayush') {
      const t = (h.hospital_type || h.type || '').toLowerCase();
      return t.includes('ayush') || t.includes('ayurvedic') || t.includes('homeo');
    }
    return true;
  });

  const totalCount = hospitals.length;
  const ayushCount = hospitals.filter(h => {
    const t = (h.hospital_type || h.type || '').toLowerCase();
    return t.includes('ayush') || t.includes('ayurvedic');
  }).length;
  const generalCount = totalCount - ayushCount;
  const totalBeds = hospitals.reduce((acc, h) => acc + (h.bed_count || 100), 0);

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-charcoal text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border border-warmgray/20">
          <Sparkles className="w-5 h-5 text-turmeric" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-warmgray px-6 py-4 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-xs">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-bold text-charcoal">MediKiosk Admin Portal</h1>
                <span className="bg-primary/15 text-primary font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Facility Registry
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">Manage registered hospitals, kiosks, and healthcare facilities</p>
            </div>
          </div>

          {/* Quick Nav & Action */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="border-warmgray rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold text-charcoal hover:bg-sand"
              onClick={() => navigate('/doctor')}
            >
              <Stethoscope className="w-4 h-4 text-primary" />
              Doctor Queue
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-semibold text-muted hover:text-charcoal"
              onClick={() => navigate('/doctor/login')}
            >
              Doctor Login →
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-warmgray rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold text-charcoal hover:bg-sand"
              onClick={() => navigate('/welcome')}
            >
              <Activity className="w-4 h-4 text-terracotta" />
              Patient Kiosk
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-warmgray rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold text-charcoal hover:bg-sand"
              onClick={() => navigate('/patient/login')}
            >
              <User className="w-4 h-4 text-emerald-600" />
              Patient Portal
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white rounded-xl h-10 px-4 gap-2 text-sm font-semibold shadow-xs transition-colors"
              onClick={handleOpenAdd}
            >
              <Plus className="w-4 h-4" />
              Register Hospital
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        
        {/* Hackathon Demo Notice */}
        <div className="mb-6 bg-blue-50/80 border border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900">Welcome to the Admin Demo</h3>
              <p className="text-sm text-blue-800/80 mt-1 max-w-2xl">
                This portal manages the multi-tenant architecture. You can create a facility, grab its Doctor Portal URL, and log in to see the AI triage queue for that specific hospital.
              </p>
            </div>
          </div>
          <Button 
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm"
            onClick={() => navigate('/doctor/dashboard')}
          >
            <Stethoscope className="w-4 h-4 mr-2" />
            Global Doctor Login
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-warmgray shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wider">Registered Facilities</p>
              <h3 className="text-3xl font-display font-bold text-charcoal mt-1">{totalCount}</h3>
              <p className="text-xs text-success font-medium mt-0.5">Active across network</p>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-terracotta/30 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs text-terracotta font-semibold uppercase tracking-wider">AYUSH Centers</p>
              <h3 className="text-3xl font-display font-bold text-terracotta mt-1">{ayushCount}</h3>
              <p className="text-xs text-muted font-medium mt-0.5">Traditional medicine</p>
            </div>
            <div className="p-3 bg-terracotta/10 text-terracotta rounded-2xl">
              <Flower2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-warmgray shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wider">General Hospitals</p>
              <h3 className="text-3xl font-display font-bold text-charcoal mt-1">{generalCount}</h3>
              <p className="text-xs text-muted font-medium mt-0.5">Allopathic facilities</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Stethoscope className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-warmgray shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wider">Total Triage Capacity</p>
              <h3 className="text-3xl font-display font-bold text-charcoal mt-1">{totalBeds}</h3>
              <p className="text-xs text-success font-medium mt-0.5">Active beds / kiosks</p>
            </div>
            <div className="p-3 bg-success/10 text-success rounded-2xl">
              <Bed className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Filter tabs, Refresh */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-warmgray shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by facility name, city, contact..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-sand/60 border border-warmgray rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex bg-sand/60 p-1 rounded-xl border border-warmgray text-xs font-semibold">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'all' ? 'bg-white text-charcoal shadow-xs' : 'text-muted hover:text-charcoal'}`}
              >
                All Facilities ({totalCount})
              </button>
              <button
                onClick={() => setTypeFilter('General')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'General' ? 'bg-white text-primary shadow-xs' : 'text-muted hover:text-primary'}`}
              >
                General ({generalCount})
              </button>
              <button
                onClick={() => setTypeFilter('Ayush')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'Ayush' ? 'bg-terracotta text-white shadow-xs' : 'text-muted hover:text-terracotta'}`}
              >
                AYUSH ({ayushCount})
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="border-warmgray hover:bg-sand rounded-xl h-9 px-3 gap-1.5 text-xs font-medium"
              onClick={() => fetchHospitals()}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Facilities Grid */}
        {isLoading && hospitals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-warmgray">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-muted font-medium">Loading registered facilities...</p>
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-warmgray text-center p-6">
            <div className="w-16 h-16 bg-sand rounded-full flex items-center justify-center mb-4 text-muted">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-display font-semibold text-charcoal mb-1">No facilities found</h3>
            <p className="text-muted text-sm max-w-sm mb-6">
              {hospitals.length === 0
                ? 'No hospitals have been registered yet. Click below to add your first facility.'
                : 'No registered hospitals matched your search and filter criteria.'}
            </p>
            <Button onClick={handleOpenAdd} className="bg-primary text-white rounded-xl gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              Register Hospital
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHospitals.map(h => {
              const isAyush = (h.hospital_type || h.type || '').toLowerCase().includes('ayush') || (h.hospital_type || h.type || '').toLowerCase().includes('ayurvedic');
              const hospitalId = h.hospital_id || h.id;

              return (
                <div
                  key={hospitalId}
                  className={`bg-white rounded-2xl border-2 transition-all duration-300 shadow-xs hover:shadow-md p-6 flex flex-col justify-between ${
                    isAyush ? 'border-terracotta/30 hover:border-terracotta' : 'border-warmgray hover:border-primary/40'
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
                          isAyush ? 'bg-terracotta/10 text-terracotta' : 'bg-primary/10 text-primary'
                        }`}>
                          {isAyush ? <Flower2 className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="font-display text-lg font-bold text-charcoal leading-tight">
                            {h.hospital_name || h.name}
                          </h4>
                          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                            isAyush ? 'bg-terracotta/15 text-terracotta' : 'bg-primary/15 text-primary'
                          }`}>
                            {h.hospital_type || h.type || 'General'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-success/10 text-success px-2 py-0.5 rounded-full text-[11px] font-semibold">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        Active
                      </div>
                    </div>

                    {/* Details Box */}
                    <div className="space-y-2.5 text-sm my-4 bg-sand/40 p-3.5 rounded-xl border border-warmgray/50">
                      <div className="flex items-center gap-2 text-muted">
                        <MapPin className="w-4 h-4 shrink-0 text-charcoal" />
                        <span className="font-medium text-charcoal text-xs truncate">{h.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted">
                        <Phone className="w-4 h-4 shrink-0 text-charcoal" />
                        <span className="font-medium text-charcoal text-xs">{h.contact || '+91 1800 123 456'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-warmgray/40">
                        <span className="text-xs text-muted flex items-center gap-1.5">
                          <Bed className="w-3.5 h-3.5" /> Bed / Kiosk Capacity
                        </span>
                        <span className="font-bold text-xs text-charcoal">{h.bed_count || 100}</span>
                      </div>
                    </div>

                    {/* UUID Copy Box */}
                    <div className="flex items-center justify-between bg-sand/80 px-3 py-2 rounded-xl border border-warmgray/60 mb-2">
                      <div className="text-[11px] font-mono text-muted truncate max-w-[200px]">
                        ID: <span className="text-charcoal font-semibold">{hospitalId.slice(0, 18)}...</span>
                      </div>
                      <button
                        onClick={() => handleCopyId(hospitalId)}
                        className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 p-1 hover:bg-white rounded-lg transition"
                        title="Copy Facility UUID"
                      >
                        {copiedId === hospitalId ? (
                          <span className="text-success flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Copied</span>
                        ) : (
                          <span className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</span>
                        )}
                      </button>
                    </div>

                    {/* Portals Links */}
                    <div className="space-y-2 mb-4">
                      {/* Patient Kiosk URL */}
                      <div className="flex items-center justify-between bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-blue-800">Patient Kiosk URL</span>
                          <a
                            href={`${window.location.origin}/hospital/${hospitalId}/kiosk`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 truncate max-w-[180px] hover:underline hover:text-blue-800 transition-colors"
                          >
                            {window.location.origin}/hospital/{hospitalId}/kiosk
                          </a>
                        </div>
                        <button
                          onClick={() => handleCopyId(`${window.location.origin}/hospital/${hospitalId}/kiosk`)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 p-1 hover:bg-blue-100 rounded-lg transition"
                          title="Copy Kiosk URL"
                          aria-label="Copy Kiosk URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {/* Doctor Portal URL */}
                      <div className="flex items-center justify-between bg-terracotta/5 px-3 py-2 rounded-xl border border-terracotta/10">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-terracotta">Doctor Portal URL</span>
                          <a
                            href={`${window.location.origin}/hospital/${hospitalId}/doctor`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-terracotta/80 truncate max-w-[180px] hover:underline hover:text-terracotta transition-colors"
                          >
                            {window.location.origin}/hospital/{hospitalId}/doctor
                          </a>
                        </div>
                        <button
                          onClick={() => handleCopyId(`${window.location.origin}/hospital/${hospitalId}/doctor`)}
                          className="text-xs font-semibold text-terracotta hover:text-terracotta/80 flex items-center gap-1 p-1 hover:bg-terracotta/10 rounded-lg transition"
                          title="Copy Doctor URL"
                          aria-label="Copy Doctor URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-warmgray/40">
                    <Button
                      style={{ backgroundColor: '#1B5E4A', minHeight: '64px' }}
                      className="w-full text-white hover:opacity-90 rounded-xl text-lg font-bold gap-2 transition-opacity"
                      onClick={() => navigate(`/hospital/${hospitalId}/kiosk`)}
                    >
                      Launch Kiosk →
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-primary text-primary hover:bg-primary hover:text-white rounded-xl h-10 text-xs font-bold gap-2 transition-colors"
                      onClick={() => window.open(`/hospital/${hospitalId}/doctor`, '_blank')}
                    >
                      <Activity className="w-4 h-4" />
                      View Triage Queue
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-warmgray text-charcoal hover:bg-sand rounded-xl h-10 text-xs font-semibold gap-1.5"
                        onClick={() => handleOpenEdit(h)}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-muted" />
                        Edit Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-danger/30 text-danger hover:bg-danger/10 hover:border-danger rounded-xl h-10 px-3 text-xs font-semibold"
                        onClick={() => handleOpenDelete(h)}
                        title="Remove Facility"
                        aria-label="Remove Facility"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}

      {/* 1. Add Hospital Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-warmgray animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-charcoal">Register New Hospital</h3>
                  <p className="text-xs text-muted">Enter facility details for patient triage and kiosk matching</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-charcoal p-1.5 rounded-xl hover:bg-sand"
                aria-label="Close Add Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                  Hospital / Facility Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo District Hospital"
                  value={formData.hospital_name}
                  onChange={e => setFormData({ ...formData, hospital_name: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                    Facility Type
                  </label>
                  <select
                    value={formData.hospital_type}
                    onChange={e => setFormData({ ...formData, hospital_type: e.target.value })}
                    className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body cursor-pointer"
                  >
                    <option value="General">General / Allopathic</option>
                    <option value="Ayush">AYUSH / Traditional</option>
                    <option value="Ayurvedic">Ayurvedic Hospital</option>
                    <option value="Homeopathic">Homeopathic Center</option>
                    <option value="Multi-Specialty">Multi-Specialty</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                    Bed / Kiosk Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 150"
                    value={formData.bed_count}
                    onChange={e => setFormData({ ...formData, bed_count: Number(e.target.value) })}
                    className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                  Location / Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Civil Lines, Jaipur, Rajasthan"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                  Helpline / Contact Phone
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 141 2345678"
                  value={formData.contact}
                  onChange={e => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-warmgray/50">
                <Button
                  type="button"
                  variant="outline"
                  className="border-warmgray rounded-xl h-11 px-5 font-semibold"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.hospital_name.trim()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Registering...' : 'Register Facility'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Hospital Modal */}
      {isEditModalOpen && selectedHospital && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-warmgray animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-charcoal">Edit Facility Details</h3>
                  <p className="text-xs text-muted">Update details for {selectedHospital.hospital_name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted hover:text-charcoal p-1.5 rounded-xl hover:bg-sand"
                aria-label="Close Edit Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateHospital} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                  Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.hospital_name}
                  onChange={e => setFormData({ ...formData, hospital_name: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                    Facility Type
                  </label>
                  <select
                    value={formData.hospital_type}
                    onChange={e => setFormData({ ...formData, hospital_type: e.target.value })}
                    className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body cursor-pointer"
                  >
                    <option value="General">General / Allopathic</option>
                    <option value="Ayush">AYUSH / Traditional</option>
                    <option value="Ayurvedic">Ayurvedic Hospital</option>
                    <option value="Homeopathic">Homeopathic Center</option>
                    <option value="Multi-Specialty">Multi-Specialty</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                    Bed Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.bed_count}
                    onChange={e => setFormData({ ...formData, bed_count: Number(e.target.value) })}
                    className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                  Location / Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 block">
                  Helpline / Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={e => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-warmgray/50">
                <Button
                  type="button"
                  variant="outline"
                  className="border-warmgray rounded-xl h-11 px-5 font-semibold"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.hospital_name.trim()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedHospital && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-danger/20 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="font-display text-2xl font-bold text-charcoal mb-2">Remove Facility?</h3>
            <p className="text-sm text-muted mb-6">
              Are you sure you want to remove <span className="font-bold text-charcoal">"{selectedHospital.hospital_name || selectedHospital.name}"</span> from the registered network?
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                className="border-warmgray rounded-xl h-11 px-5 font-semibold flex-1"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={isSubmitting}
                className="bg-danger hover:bg-danger/90 text-white rounded-xl h-11 px-5 font-semibold flex-1 shadow-xs"
                onClick={handleDeleteHospital}
              >
                {isSubmitting ? 'Removing...' : 'Yes, Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
