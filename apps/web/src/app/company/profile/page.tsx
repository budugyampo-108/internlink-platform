'use client';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client';

type Company = {
  id: string;
  name: string;
  overview: string | null;
  industry: string;
  culture: string | null;
  address: string | null;
  digitalAddress: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
};

export default function CompanyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [overview, setOverview] = useState('');
  const [culture, setCulture] = useState('');
  const [address, setAddress] = useState('');
  const [digitalAddress, setDigitalAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState<number | ''>('');
  const [lng, setLng] = useState<number | ''>('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    api<{ company: Company | null }>('/api/company')
      .then((r) => {
        if (r.company) {
          const c = r.company;
          setName(c.name || '');
          setIndustry(c.industry || '');
          setOverview(c.overview || '');
          setCulture(c.culture || '');
          setAddress(c.address || '');
          setDigitalAddress(c.digitalAddress || '');
          setPhone(c.phone || '');
          setLat(c.lat ?? '');
          setLng(c.lng ?? '');
          setWebsite(c.website || '');
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function detectLocation() {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setSuccess('Coordinates updated from your current device location.');
      },
      () => setError('Could not get current location. You can enter latitude and longitude manually.'),
    );
  }

  function setPreset(presetLat: number, presetLng: number, label: string) {
    setLat(presetLat);
    setLng(presetLng);
    setSuccess(`Location coordinates set to ${label}.`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');

    if (lat === '' || lng === '') {
      setError('Latitude and longitude coordinates are required so students can find you on the map.');
      setBusy(false);
      return;
    }

    try {
      await api('/api/company', {
        method: 'PUT',
        json: {
          name,
          industry,
          overview: overview || '',
          culture: culture || '',
          address,
          digitalAddress: digitalAddress.toUpperCase().trim(),
          phone: phone.trim(),
          lat: Number(lat),
          lng: Number(lng),
          website: website ? (website.startsWith('http') ? website : `https://${website}`) : undefined,
          photoDocIds: [],
        },
      });
      setSuccess('Company profile and location saved successfully! You can now publish vacancies.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.fields?.[0]?.message || err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Could not save profile');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="stack" aria-busy="true">
        <div className="skeleton" style={{ height: 40, width: 240 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  const isLocationConfigured = lat !== '' && lng !== '' && address && digitalAddress && phone;

  return (
    <div className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem' }}>Company Profile &amp; Location</h1>
        <p className="muted">
          Your location, digital address, and contact details are required so students can find your internships on the map.
        </p>
      </div>

      {!isLocationConfigured && (
        <div className="alert warn" role="alert">
          <strong>Location incomplete:</strong> Please fill in your address, GhanaPost GPS / digital address, phone, and GPS coordinates below so students can discover your vacancies.
        </div>
      )}

      {success && <div className="alert ok" role="alert">{success}</div>}
      {error && <div className="alert error" role="alert">{error}</div>}

      <form onSubmit={submit} className="card stack">
        <h2 style={{ fontSize: '1.2rem' }}>Basic Details</h2>
        <div className="field">
          <label htmlFor="name">Company Name</label>
          <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="industry">Industry / Sector</label>
          <input id="industry" className="input" required placeholder="e.g. Technology, Banking, Healthcare" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="phone">Official Phone Number</label>
          <input id="phone" className="input" required placeholder="e.g. +233 24 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="website">Website (optional)</label>
          <input id="website" className="input" type="url" placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <h2 style={{ fontSize: '1.2rem', marginTop: '1rem' }}>Location &amp; Map Coordinates</h2>
        <div className="field">
          <label htmlFor="address">Physical Street Address</label>
          <input id="address" className="input" required placeholder="e.g. 14 Independence Avenue, Ridge" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="digitalAddress">GhanaPost GPS Digital Address</label>
          <input
            id="digitalAddress"
            className="input"
            required
            placeholder="e.g. GA-543-1234"
            value={digitalAddress}
            onChange={(e) => setDigitalAddress(e.target.value)}
          />
          <span className="hint">Must match format like GA-123-4567 or AK-039-1234</span>
        </div>

        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="lat">Latitude</label>
            <input
              id="lat"
              className="input"
              type="number"
              step="0.000001"
              required
              placeholder="e.g. 5.6037"
              value={lat}
              onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="lng">Longitude</label>
            <input
              id="lng"
              className="input"
              type="number"
              step="0.000001"
              required
              placeholder="e.g. -0.1870"
              value={lng}
              onChange={(e) => setLng(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={detectLocation}>📍 Use My Current GPS Location</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPreset(5.6037, -0.187, 'Accra Central')}>Preset: Accra</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPreset(6.6885, -1.6244, 'Kumasi')}>Preset: Kumasi</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPreset(4.8987, -1.7583, 'Takoradi')}>Preset: Takoradi</button>
        </div>

        <h2 style={{ fontSize: '1.2rem', marginTop: '1rem' }}>About &amp; Work Culture (optional)</h2>
        <div className="field">
          <label htmlFor="overview">Company Overview</label>
          <textarea id="overview" className="input" rows={3} maxLength={2000} placeholder="Brief summary of what your company does" value={overview} onChange={(e) => setOverview(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="culture">Workplace Culture</label>
          <textarea id="culture" className="input" rows={2} maxLength={1500} placeholder="What should interns expect about your work environment?" value={culture} onChange={(e) => setCulture(e.target.value)} />
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }} disabled={busy}>
          {busy ? 'Saving...' : 'Save Profile & Location'}
        </button>
      </form>
    </div>
  );
}
