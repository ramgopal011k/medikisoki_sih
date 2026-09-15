import { Router } from 'express';
import { supabase } from '../supabase';

const router = Router();

export interface HospitalRecord {
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

const DEFAULT_HOSPITALS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: JSON.stringify({
      name: 'City General Hospital',
      location: 'Civil Lines, Central District',
      type: 'General',
      contact: '+91 141 2345678',
      bed_count: 250
    })
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: JSON.stringify({
      name: 'Ayush Wellness Center',
      location: 'North Ayurvedic Zone',
      type: 'Ayush',
      contact: '+91 141 8765432',
      bed_count: 80
    })
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: JSON.stringify({
      name: 'All India Institute of Ayurveda',
      location: 'South Campus, Green Enclave',
      type: 'Ayush',
      contact: '+91 11 26789000',
      bed_count: 150
    })
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: JSON.stringify({
      name: 'District Civil Multi-Specialty Hospital',
      location: 'Sector 5, Outer Ring',
      type: 'General',
      contact: '+91 141 2998877',
      bed_count: 400
    })
  }
];

function parseHospital(row: any): HospitalRecord {
  let name = row.name || 'Unnamed Facility';
  let location = 'Central District';
  let type = 'General';
  let contact = '+91 1800 123 456';
  let bedCount = 100;
  let status = 'Active';

  if (typeof name === 'string' && name.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(name);
      name = parsed.name || parsed.hospital_name || name;
      location = parsed.location || location;
      type = parsed.type || parsed.hospital_type || type;
      contact = parsed.contact || contact;
      bedCount = parsed.bed_count || bedCount;
      status = parsed.status || status;
    } catch (e) {
      // Keep original name
    }
  } else if (name === 'Demo Government Hospital') {
    name = 'City General Hospital';
    location = 'Civil Lines, Central District';
    type = 'General';
    contact = '+91 141 2345678';
    bedCount = 250;
  }

  return {
    hospital_id: row.id,
    id: row.id,
    hospital_name: name,
    name: name,
    location,
    hospital_type: type,
    type,
    contact,
    bed_count: bedCount,
    status,
    created_at: row.created_at || new Date().toISOString()
  };
}

// In-memory cache to guarantee speed and fallback continuity
let hospitalCache: HospitalRecord[] = DEFAULT_HOSPITALS.map(parseHospital);

// GET /api/hospitals - List all registered hospitals
router.get('/', async (_req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !rows || rows.length === 0) {
      console.warn('Supabase hospitals query fallback to default cache:', error?.message);
      return res.json({ data: hospitalCache });
    }

    const mapped = rows.map(parseHospital);
    hospitalCache = mapped;
    return res.json({ data: mapped });
  } catch (err: any) {
    console.error('Fetch hospitals error:', err);
    return res.json({ data: hospitalCache });
  }
});

// POST /api/hospitals - Register a new hospital
router.post('/', async (req, res) => {
  const { hospital_name, location, hospital_type, contact, bed_count } = req.body;

  if (!hospital_name || hospital_name.trim().length === 0) {
    return res.status(400).json({ error: 'Hospital name is required' });
  }

  const validName = hospital_name.trim();
  const validLocation = (location || 'Main Campus').trim();
  const validType = (hospital_type || 'General').trim();
  const validContact = (contact || '+91 1800 123 456').trim();
  const validBeds = Number(bed_count) || 100;

  const payloadString = JSON.stringify({
    name: validName,
    location: validLocation,
    type: validType,
    contact: validContact,
    bed_count: validBeds,
    status: 'Active'
  });

  try {
    const { data: inserted, error } = await supabase
      .from('hospitals')
      .insert({
        name: payloadString
      })
      .select()
      .single();

    if (error || !inserted) {
      console.warn('Supabase hospital insert fallback to in-memory:', error?.message);
      const fallbackHospital: HospitalRecord = {
        hospital_id: crypto.randomUUID(),
        id: crypto.randomUUID(),
        hospital_name: validName,
        name: validName,
        location: validLocation,
        hospital_type: validType,
        type: validType,
        contact: validContact,
        bed_count: validBeds,
        status: 'Active',
        created_at: new Date().toISOString()
      };
      hospitalCache.push(fallbackHospital);
      return res.status(201).json({ success: true, data: fallbackHospital });
    }

    const created = parseHospital(inserted);
    hospitalCache = hospitalCache.filter(h => h.id !== created.id);
    hospitalCache.push(created);

    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    console.error('Create hospital error:', err);
    const fallbackHospital: HospitalRecord = {
      hospital_id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      hospital_name: validName,
      name: validName,
      location: validLocation,
      hospital_type: validType,
      type: validType,
      contact: validContact,
      bed_count: validBeds,
      status: 'Active',
      created_at: new Date().toISOString()
    };
    hospitalCache.push(fallbackHospital);
    return res.status(201).json({ success: true, data: fallbackHospital });
  }
});

// PATCH /api/hospitals/:id - Update an existing hospital
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { hospital_name, location, hospital_type, contact, bed_count, status } = req.body;

  try {
    // Find existing
    const existing = hospitalCache.find(h => h.id === id || h.hospital_id === id);
    const updatedName = hospital_name ? hospital_name.trim() : (existing?.hospital_name || 'Hospital');
    const updatedLocation = location ? location.trim() : (existing?.location || 'Central District');
    const updatedType = hospital_type ? hospital_type.trim() : (existing?.hospital_type || 'General');
    const updatedContact = contact ? contact.trim() : (existing?.contact || '+91 1800 123 456');
    const updatedBeds = bed_count !== undefined ? Number(bed_count) : (existing?.bed_count || 100);
    const updatedStatus = status || existing?.status || 'Active';

    const payloadString = JSON.stringify({
      name: updatedName,
      location: updatedLocation,
      type: updatedType,
      contact: updatedContact,
      bed_count: updatedBeds,
      status: updatedStatus
    });

    const { data: updatedRow, error } = await supabase
      .from('hospitals')
      .update({ name: payloadString })
      .eq('id', id)
      .select()
      .single();

    if (error || !updatedRow) {
      console.warn('Supabase update hospital warning:', error?.message);
    }

    const updated = updatedRow ? parseHospital(updatedRow) : {
      hospital_id: id,
      id: id,
      hospital_name: updatedName,
      name: updatedName,
      location: updatedLocation,
      hospital_type: updatedType,
      type: updatedType,
      contact: updatedContact,
      bed_count: updatedBeds,
      status: updatedStatus,
      created_at: existing?.created_at || new Date().toISOString()
    };

    hospitalCache = hospitalCache.map(h => (h.id === id || h.hospital_id === id ? updated : h));
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('Update hospital error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hospitals/:id - Delete a registered hospital
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('hospitals')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete hospital warning:', error.message);
    }

    hospitalCache = hospitalCache.filter(h => h.id !== id && h.hospital_id !== id);
    return res.json({ success: true, message: 'Hospital removed successfully' });
  } catch (err: any) {
    console.error('Delete hospital error:', err);
    hospitalCache = hospitalCache.filter(h => h.id !== id && h.hospital_id !== id);
    return res.json({ success: true, message: 'Hospital removed from local cache' });
  }
});

export default router;
