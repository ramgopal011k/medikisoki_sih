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
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  Layers,
  CheckCircle2,
  SlidersHorizontal,
  ShieldAlert,
  BarChart3,
  LogOut
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { loadHospitalsSWR, removeCachedHospital } from '@/lib/hospitalsCache';

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
  const [typeFilter, setTypeFilter] = useState<'all' | 'General' | 'Ayush' | 'Multi-Specialty'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'beds' | 'type'>('name');
  
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

  const fetchHospitals = useCallback(async (silent = false, forceFresh = false) => {
    if (!silent) setIsLoading(true);
    try {
      await loadHospitalsSWR((data, fromCache) => {
        setHospitals(data);
        if (fromCache || !silent) setIsLoading(false);
      }, forceFresh);
    } catch (err) {
      console.error('Failed to load hospitals:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const handleCopyId = (id: string, label = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast(label);
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
      fetchHospitals(true, true);
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
      fetchHospitals(true, true);
    } catch (err: any) {
      alert(err.message || 'Error updating hospital');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHospital = async () => {
    if (!selectedHospital) return;

    const targetId = selectedHospital.id || selectedHospital.hospital_id;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/hospitals/${targetId}`, {
        method: 'DELETE'
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to remove hospital');

      // Optimistically update local state immediately so item is removed instantly
      setHospitals(prev => prev.filter(h => h.id !== targetId && h.hospital_id !== targetId));
      removeCachedHospital(targetId);

      showToast(`Removed facility "${selectedHospital.hospital_name || selectedHospital.name}"`);
      setIsDeleteModalOpen(false);
      setSelectedHospital(null);
      fetchHospitals(true, true);
    } catch (err: any) {
      alert(err.message || 'Error deleting hospital');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter, Search, and Sort logic
  const filteredHospitals = hospitals
    .filter(h => {
      const nameMatch = (h.hospital_name || h.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const locMatch = (h.location || '').toLowerCase().includes(searchTerm.toLowerCase());
      const contactMatch = (h.contact || '').includes(searchTerm);

      if (!nameMatch && !locMatch && !contactMatch) return false;

      const t = (h.hospital_type || h.type || '').toLowerCase();
      if (typeFilter === 'General') {
        return t === 'general' || t.includes('allopathic');
      }
      if (typeFilter === 'Ayush') {
        return t.includes('ayush') || t.includes('ayurvedic') || t.includes('homeo') || t.includes('traditional');
      }
      if (typeFilter === 'Multi-Specialty') {
        return t.includes('multi') || t.includes('specialty');
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.hospital_name || a.name || '').localeCompare(b.hospital_name || b.name || '');
      }
      if (sortBy === 'beds') {
        return (b.bed_count || 0) - (a.bed_count || 0);
      }
      if (sortBy === 'type') {
        return (a.hospital_type || a.type || '').localeCompare(b.hospital_type || b.type || '');
      }
      return 0;
    });

  const totalCount = hospitals.length;
  const ayushCount = hospitals.filter(h => {
    const t = (h.hospital_type || h.type || '').toLowerCase();
    return t.includes('ayush') || t.includes('ayurvedic') || t.includes('homeo') || t.includes('traditional');
  }).length;
  const multiCount = hospitals.filter(h => {
    const t = (h.hospital_type || h.type || '').toLowerCase();
    return t.includes('multi') || t.includes('specialty');
  }).length;
  const generalCount = totalCount - ayushCount;
  const totalBeds = hospitals.reduce((acc, h) => acc + (h.bed_count || 100), 0);

  // AYUSH capacity percentage
  const ayushBeds = hospitals
    .filter(h => {
      const t = (h.hospital_type || h.type || '').toLowerCase();
      return t.includes('ayush') || t.includes('ayurvedic') || t.includes('homeo');
    })
    .reduce((acc, h) => acc + (h.bed_count || 100), 0);
  const ayushBedPercent = totalBeds > 0 ? Math.round((ayushBeds / totalBeds) * 100) : 0;
  const generalBedPercent = 100 - ayushBedPercent;

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-charcoal text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border border-warmgray/20">
          <div className="w-7 h-7 rounded-xl bg-turmeric/20 flex items-center justify-center text-turmeric">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-warmgray px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Brand & Title */}
          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-xs border border-primary/15">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-display font-bold text-charcoal tracking-tight">
                    MediKiosk <span className="text-primary">Admin</span>
                  </h1>
                  <span className="bg-primary/10 text-primary border border-primary/20 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Network Registry
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5 font-medium">
                  Multi-Tenant Healthcare Facility & Triage Kiosk Management
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              className="border-warmgray rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold text-charcoal hover:bg-sand hover:border-primary/30 transition-all"
              onClick={() => navigate('/doctor')}
            >
              <Stethoscope className="w-4 h-4 text-primary" />
              Doctor Queue
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-warmgray rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold text-charcoal hover:bg-sand hover:border-primary/30 transition-all"
              onClick={() => navigate('/welcome')}
            >
              <Activity className="w-4 h-4 text-terracotta" />
              Patient Kiosk
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-warmgray rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold text-charcoal hover:bg-sand hover:border-primary/30 transition-all"
              onClick={() => navigate('/patient/login')}
            >
              <User className="w-4 h-4 text-emerald-700" />
              Patient Portal
            </Button>

            <Button
              className="bg-primary hover:bg-primary/90 text-white rounded-xl h-10 px-4 gap-2 text-xs font-bold shadow-sm transition-all hover:shadow-md"
              onClick={handleOpenAdd}
            >
              <Plus className="w-4 h-4" />
              Register Hospital
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-danger/30 text-danger hover:bg-danger/10 hover:border-danger rounded-xl h-10 px-3.5 gap-2 text-xs font-semibold transition-all"
              onClick={() => {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_info');
                navigate('/admin/login');
              }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Sleek Theme-Aligned Operations Hero Deck */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sand via-white to-sand/80 border border-warmgray p-6 lg:p-7 shadow-xs">
          {/* Subtle Accent Background Watermark */}
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 pointer-events-none opacity-5">
            <Building2 className="w-72 h-72 text-primary" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Layers className="w-4 h-4 text-terracotta" />
                <span>Multi-Tenant Triage Command Center</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-charcoal leading-snug">
                Manage Health Facilities, Kiosks & Priority AI Queues
              </h2>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Register hospital nodes, obtain customized patient kiosk links, and dispatch real-time triage data directly into doctor queues across General and AYUSH facilities.
              </p>
              
              {/* Feature Tags */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-charcoal bg-sand px-3 py-1 rounded-full border border-warmgray">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Multi-Hospital Isolation
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-charcoal bg-sand px-3 py-1 rounded-full border border-warmgray">
                  <Flower2 className="w-3.5 h-3.5 text-terracotta" /> Integrated AYUSH Protocol
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-charcoal bg-sand px-3 py-1 rounded-full border border-warmgray">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Realtime Voice AI
                </span>
              </div>
            </div>

            {/* Quick Doctor Login Launcher */}
            <div className="shrink-0 w-full md:w-auto bg-white p-4 rounded-2xl border border-warmgray shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-charcoal uppercase tracking-wider">Doctor Portal Access</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Live
                </span>
              </div>
              <p className="text-xs text-muted max-w-xs">
                Launch the universal doctor dashboard to view triage queues for any active facility.
              </p>
              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-5 font-bold text-xs gap-2 shadow-xs transition-colors"
                onClick={() => navigate('/doctor/dashboard')}
              >
                <Stethoscope className="w-4 h-4" />
                Global Doctor Login →
              </Button>
            </div>
          </div>
        </div>

        {/* Network Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Registered Facilities */}
          <div className="bg-white p-5 rounded-2xl border border-warmgray shadow-xs hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">Registered Facilities</span>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <h3 className="text-3xl font-display font-bold text-charcoal">{totalCount}</h3>
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                100% Online
              </span>
            </div>
            <p className="text-xs text-muted mt-1">Active nodes connected to network</p>
          </div>

          {/* Card 2: AYUSH Centers */}
          <div className="bg-white p-5 rounded-2xl border border-terracotta/30 shadow-xs hover:border-terracotta transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs text-terracotta font-bold uppercase tracking-wider">AYUSH Centers</span>
              <div className="w-10 h-10 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center group-hover:scale-105 transition-transform">
                <Flower2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <h3 className="text-3xl font-display font-bold text-terracotta">{ayushCount}</h3>
              <span className="text-xs font-semibold text-terracotta bg-terracotta/15 px-2 py-0.5 rounded-full">
                Traditional Care
              </span>
            </div>
            <p className="text-xs text-muted mt-1">Ayurveda, Yoga, Homeopathy</p>
          </div>

          {/* Card 3: General Hospitals */}
          <div className="bg-white p-5 rounded-2xl border border-warmgray shadow-xs hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">General Hospitals</span>
              <div className="w-10 h-10 rounded-xl bg-turmeric/15 text-charcoal flex items-center justify-center group-hover:scale-105 transition-transform">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <h3 className="text-3xl font-display font-bold text-charcoal">{generalCount}</h3>
              <span className="text-xs font-semibold text-charcoal bg-sand px-2 py-0.5 rounded-full border border-warmgray">
                Allopathic / ER
              </span>
            </div>
            <p className="text-xs text-muted mt-1">Emergency & primary care units</p>
          </div>

          {/* Card 4: Total Triage Capacity */}
          <div className="bg-white p-5 rounded-2xl border border-warmgray shadow-xs hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">Network Capacity</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bed className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <h3 className="text-3xl font-display font-bold text-charcoal">{totalBeds}</h3>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                Beds / Kiosks
              </span>
            </div>
            <p className="text-xs text-muted mt-1">Combined patient intake load</p>
          </div>
        </div>

        {/* Capacity Distribution Bar */}
        <div className="bg-white p-4 rounded-2xl border border-warmgray shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2 text-muted">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span>Capacity Breakdown:</span>
          </div>
          <div className="flex-1 w-full max-w-lg bg-sand h-3 rounded-full overflow-hidden flex border border-warmgray">
            <div 
              style={{ width: `${generalBedPercent}%` }} 
              className="bg-primary h-full transition-all duration-500" 
              title={`General Care Beds: ${100 - ayushBedPercent}%`}
            />
            <div 
              style={{ width: `${ayushBedPercent}%` }} 
              className="bg-terracotta h-full transition-all duration-500" 
              title={`AYUSH Beds: ${ayushBedPercent}%`}
            />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              General ({100 - ayushBedPercent}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-terracotta" />
              AYUSH ({ayushBedPercent}%)
            </span>
          </div>
        </div>

        {/* Interactive Control & Search Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-warmgray shadow-xs">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facilities by name, city, address, or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-sand/50 border border-warmgray rounded-xl text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal p-1 rounded-full hover:bg-warmgray/50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips & Actions */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
            
            {/* Type Filter Pills */}
            <div className="flex bg-sand p-1 rounded-xl border border-warmgray text-xs font-semibold">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === 'all' ? 'bg-white text-charcoal shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setTypeFilter('General')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === 'General' ? 'bg-white text-primary shadow-xs font-bold' : 'text-muted hover:text-primary'
                }`}
              >
                General ({generalCount})
              </button>
              <button
                onClick={() => setTypeFilter('Ayush')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === 'Ayush' ? 'bg-terracotta text-white shadow-xs font-bold' : 'text-muted hover:text-terracotta'
                }`}
              >
                AYUSH ({ayushCount})
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-sand border border-warmgray rounded-xl px-2.5 py-1 text-xs font-semibold text-muted">
              <ArrowUpDown className="w-3.5 h-3.5 text-charcoal" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-charcoal text-xs font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="name">Sort by Name</option>
                <option value="beds">Sort by Capacity</option>
                <option value="type">Sort by Type</option>
              </select>
            </div>

            {/* View Mode Toggle (Grid vs Table) */}
            <div className="flex bg-sand p-1 rounded-xl border border-warmgray">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white text-primary shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-white text-primary shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              className="border-warmgray hover:bg-sand rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold"
              onClick={() => fetchHospitals()}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : 'text-muted'}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Facilities List / Grid */}
        {isLoading && hospitals.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-warmgray p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-sand rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-sand rounded w-3/4" />
                    <div className="h-3 bg-sand rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-sand rounded w-full" />
                <div className="h-8 bg-sand rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-warmgray text-center p-6 shadow-xs">
            <div className="w-16 h-16 bg-sand rounded-2xl flex items-center justify-center mb-4 text-muted border border-warmgray">
              <Building2 className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="text-xl font-display font-bold text-charcoal mb-1">No facilities found</h3>
            <p className="text-muted text-xs sm:text-sm max-w-sm mb-6">
              {hospitals.length === 0
                ? 'No hospitals have been registered yet. Click below to add your first facility.'
                : 'No registered hospitals matched your search query or type filter.'}
            </p>
            <Button onClick={handleOpenAdd} className="bg-primary text-white rounded-xl gap-2 text-xs font-bold px-5 h-10 shadow-xs">
              <Plus className="w-4 h-4" />
              Register Hospital
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHospitals.map(h => {
              const isAyush = (h.hospital_type || h.type || '').toLowerCase().includes('ayush') || 
                              (h.hospital_type || h.type || '').toLowerCase().includes('ayurvedic') ||
                              (h.hospital_type || h.type || '').toLowerCase().includes('homeo');
              const hospitalId = h.hospital_id || h.id;
              const kioskUrl = `${window.location.origin}/hospital/${hospitalId}/kiosk`;
              const doctorUrl = `${window.location.origin}/hospital/${hospitalId}/doctor`;
              const triageUrl = `${window.location.origin}/hospital/${hospitalId}/triage`;

              return (
                <div
                  key={hospitalId}
                  className={`bg-white rounded-2xl border-2 transition-all duration-300 shadow-xs hover:shadow-md p-6 flex flex-col justify-between relative overflow-hidden group ${
                    isAyush ? 'border-terracotta/30 hover:border-terracotta' : 'border-warmgray hover:border-primary/40'
                  }`}
                >
                  {/* Top Type Bar Indicator */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isAyush ? 'bg-terracotta' : 'bg-primary'
                  }`} />

                  <div>
                    {/* Card Top Title & Status */}
                    <div className="flex justify-between items-start mb-4 pt-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs border ${
                          isAyush 
                            ? 'bg-terracotta/10 border-terracotta/20 text-terracotta' 
                            : 'bg-primary/10 border-primary/20 text-primary'
                        }`}>
                          {isAyush ? <Flower2 className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="font-display text-lg font-bold text-charcoal leading-tight group-hover:text-primary transition-colors">
                            {h.hospital_name || h.name}
                          </h4>
                          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-1 ${
                            isAyush 
                              ? 'bg-terracotta/15 text-terracotta border border-terracotta/20' 
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {h.hospital_type || h.type || 'General'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </div>
                    </div>

                    {/* Details Container */}
                    <div className="space-y-2.5 text-xs my-4 bg-sand/50 p-3.5 rounded-xl border border-warmgray/60">
                      <div className="flex items-center gap-2 text-muted">
                        <MapPin className="w-4 h-4 shrink-0 text-charcoal" />
                        <span className="font-semibold text-charcoal truncate">{h.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted">
                        <Phone className="w-4 h-4 shrink-0 text-charcoal" />
                        <span className="font-semibold text-charcoal">{h.contact || '+91 1800 123 456'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-warmgray/60">
                        <span className="text-muted flex items-center gap-1.5 font-medium">
                          <Bed className="w-3.5 h-3.5 text-primary" /> Triage / Bed Capacity
                        </span>
                        <span className="font-bold text-charcoal bg-white px-2 py-0.5 rounded-md border border-warmgray">
                          {h.bed_count || 100} beds
                        </span>
                      </div>
                    </div>

                    {/* Facility UUID Badge */}
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-warmgray text-xs mb-3 shadow-2xs">
                      <div className="text-[11px] font-mono text-muted truncate max-w-[190px]">
                        ID: <span className="text-charcoal font-semibold">{hospitalId.slice(0, 18)}...</span>
                      </div>
                      <button
                        onClick={() => handleCopyId(hospitalId, 'Facility ID copied!')}
                        className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 p-1 hover:bg-sand rounded-lg transition"
                        title="Copy Facility UUID"
                      >
                        {copiedId === hospitalId ? (
                          <span className="text-emerald-700 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Copied</span>
                        ) : (
                          <span className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy ID</span>
                        )}
                      </button>
                    </div>

                    {/* Theme-Aligned URL Quick Cards */}
                    <div className="space-y-2 mb-4">
                      {/* Patient Kiosk Link */}
                      <div className="flex items-center justify-between bg-primary/5 p-2.5 rounded-xl border border-primary/15">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Patient Kiosk URL</span>
                          <a
                            href={kioskUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-primary hover:underline truncate transition-colors flex items-center gap-1"
                          >
                            {kioskUrl.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                        <button
                          onClick={() => handleCopyId(kioskUrl, 'Kiosk URL copied!')}
                          className="text-xs font-bold text-primary p-1.5 hover:bg-primary/10 rounded-lg transition shrink-0"
                          title="Copy Kiosk URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Doctor Portal Link */}
                      <div className="flex items-center justify-between bg-terracotta/5 p-2.5 rounded-xl border border-terracotta/15">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[10px] uppercase font-bold text-terracotta tracking-wider">Doctor Portal URL</span>
                          <a
                            href={doctorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-terracotta hover:underline truncate transition-colors flex items-center gap-1"
                          >
                            {doctorUrl.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                        <button
                          onClick={() => handleCopyId(doctorUrl, 'Doctor URL copied!')}
                          className="text-xs font-bold text-terracotta p-1.5 hover:bg-terracotta/10 rounded-lg transition shrink-0"
                          title="Copy Doctor URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Triage Portal Link */}
                      <div className="flex items-center justify-between bg-danger/5 p-2.5 rounded-xl border border-danger/15">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[10px] uppercase font-bold text-danger tracking-wider">Triage Portal URL</span>
                          <a
                            href={triageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-danger hover:underline truncate transition-colors flex items-center gap-1"
                          >
                            {triageUrl.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                        <button
                          onClick={() => handleCopyId(triageUrl, 'Triage URL copied!')}
                          className="text-xs font-bold text-danger p-1.5 hover:bg-danger/10 rounded-lg transition shrink-0"
                          title="Copy Triage URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Primary Action Buttons Bar */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-warmgray/60">
                    <Button
                      style={{ backgroundColor: '#1B5E4A', minHeight: '56px' }}
                      className="w-full text-white hover:opacity-95 rounded-xl text-base font-bold gap-2 shadow-xs transition-all hover:shadow-md"
                      onClick={() => navigate(`/hospital/${hospitalId}/kiosk`)}
                    >
                      <Activity className="w-5 h-5 text-turmeric" />
                      Launch Kiosk →
                    </Button>

                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        variant="outline"
                        className="border-primary/40 text-primary hover:bg-primary hover:text-white rounded-xl h-9 text-[11px] font-bold gap-1 transition-colors px-1.5"
                        onClick={() => window.open(`/hospital/${hospitalId}/doctor`, '_blank')}
                        title="Doctor Queue"
                      >
                        <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Doctor Queue</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="border-danger/30 text-danger hover:bg-danger hover:text-white rounded-xl h-9 text-[11px] font-bold gap-1 transition-colors px-1.5"
                        onClick={() => window.open(`/hospital/${hospitalId}/triage`, '_blank')}
                        title="Triage Portal"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Triage Portal</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="border-primary/40 text-primary hover:bg-primary hover:text-white rounded-xl h-9 text-[11px] font-bold gap-1 transition-colors px-1.5"
                        onClick={() => navigate(`/hospital/${hospitalId}/analytics`)}
                        title="Hospital Analytics"
                      >
                        <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Analytics</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-warmgray text-charcoal hover:bg-sand rounded-xl h-9 text-xs font-semibold gap-1"
                        onClick={() => handleOpenEdit(h)}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-muted" />
                        Edit Facility
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-danger/20 text-danger hover:bg-danger/10 hover:border-danger rounded-xl h-9 px-3 text-xs font-semibold gap-1"
                        onClick={() => handleOpenDelete(h)}
                        title="Remove Facility"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW (Dense Data View) */
          <div className="bg-white rounded-2xl border border-warmgray shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-sand/70 border-b border-warmgray text-charcoal font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Facility Name & Type</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4 text-center">Beds</th>
                    <th className="py-3.5 px-4">Portal URLs</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warmgray/60">
                  {filteredHospitals.map(h => {
                    const isAyush = (h.hospital_type || h.type || '').toLowerCase().includes('ayush') || 
                                    (h.hospital_type || h.type || '').toLowerCase().includes('ayurvedic');
                    const hospitalId = h.hospital_id || h.id;
                    const kioskUrl = `${window.location.origin}/hospital/${hospitalId}/kiosk`;
                    const doctorUrl = `${window.location.origin}/hospital/${hospitalId}/doctor`;
                    const triageUrl = `${window.location.origin}/hospital/${hospitalId}/triage`;

                    return (
                      <tr key={hospitalId} className="hover:bg-sand/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-charcoal">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isAyush ? 'bg-terracotta/10 text-terracotta' : 'bg-primary/10 text-primary'
                            }`}>
                              {isAyush ? <Flower2 className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-display font-bold text-sm text-charcoal">{h.hospital_name || h.name}</p>
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.2 rounded-md ${
                                isAyush ? 'bg-terracotta/10 text-terracotta' : 'bg-primary/10 text-primary'
                              }`}>
                                {h.hospital_type || h.type || 'General'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-muted font-medium">
                          <span className="flex items-center gap-1 text-charcoal">
                            <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                            {h.location}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-muted font-medium">
                          <span className="flex items-center gap-1 text-charcoal">
                            <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                            {h.contact || '+91 1800 123 456'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-charcoal">
                          <span className="bg-sand px-2.5 py-1 rounded-md border border-warmgray">
                            {h.bed_count || 100}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-primary font-bold">Kiosk:</span>
                            <a href={kioskUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[140px]">
                              /hospital/{hospitalId.slice(0, 8)}...
                            </a>
                            <button onClick={() => handleCopyId(kioskUrl)} className="text-muted hover:text-primary">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-terracotta font-bold">Doctor:</span>
                            <a href={doctorUrl} target="_blank" rel="noopener noreferrer" className="text-terracotta underline truncate max-w-[140px]">
                              /hospital/{hospitalId.slice(0, 8)}...
                            </a>
                            <button onClick={() => handleCopyId(doctorUrl)} className="text-muted hover:text-terracotta">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-danger font-bold">Triage:</span>
                            <a href={triageUrl} target="_blank" rel="noopener noreferrer" className="text-danger underline truncate max-w-[140px]">
                              /hospital/{hospitalId.slice(0, 8)}...
                            </a>
                            <button onClick={() => handleCopyId(triageUrl, 'Triage URL copied!')} className="text-muted hover:text-danger">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-primary/40 text-primary hover:bg-primary hover:text-white rounded-lg h-8 px-2 text-xs font-bold gap-1"
                              onClick={() => navigate(`/hospital/${hospitalId}/analytics`)}
                              title="Hospital Analytics"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              Analytics
                            </Button>
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-white rounded-lg h-8 px-3 text-xs font-bold"
                              onClick={() => navigate(`/hospital/${hospitalId}/kiosk`)}
                            >
                              Launch
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-warmgray rounded-lg h-8 px-2"
                              onClick={() => handleOpenEdit(h)}
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-danger/20 text-danger hover:bg-danger/10 rounded-lg h-8 px-2"
                              onClick={() => handleOpenDelete(h)}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}

      {/* 1. Add Hospital Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-warmgray animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-charcoal">Register New Hospital</h3>
                  <p className="text-xs text-muted">Add a new facility node to the MediKiosk triage system</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-charcoal p-1.5 rounded-xl hover:bg-sand transition-colors"
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
                  placeholder="e.g. Max Healthcare Institute - Saket"
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
                  placeholder="e.g. Saket, South Delhi, Delhi"
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
                  placeholder="e.g. +91 11 98765432"
                  value={formData.contact}
                  onChange={e => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full p-3.5 bg-sand/40 border-2 border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary font-body"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-warmgray/60">
                <Button
                  type="button"
                  variant="outline"
                  className="border-warmgray rounded-xl h-11 px-5 font-semibold text-xs"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.hospital_name.trim()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 font-bold text-xs shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-warmgray animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-charcoal">Edit Facility Details</h3>
                  <p className="text-xs text-muted">Update information for {selectedHospital.hospital_name || selectedHospital.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted hover:text-charcoal p-1.5 rounded-xl hover:bg-sand transition-colors"
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-warmgray/60">
                <Button
                  type="button"
                  variant="outline"
                  className="border-warmgray rounded-xl h-11 px-5 font-semibold text-xs"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.hospital_name.trim()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 font-bold text-xs shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedHospital && (
        <div className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-danger/20 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mx-auto mb-4 border border-danger/20">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="font-display text-2xl font-bold text-charcoal mb-2">Remove Facility?</h3>
            <p className="text-xs sm:text-sm text-muted mb-6">
              Are you sure you want to remove <span className="font-bold text-charcoal">"{selectedHospital.hospital_name || selectedHospital.name}"</span> from the network?
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                className="border-warmgray rounded-xl h-11 px-5 font-semibold flex-1 text-xs"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={isSubmitting}
                className="bg-danger hover:bg-danger/90 text-white rounded-xl h-11 px-5 font-bold flex-1 text-xs shadow-xs"
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
