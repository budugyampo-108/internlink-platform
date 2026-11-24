'use client';
import { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
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
  verificationStatus?: string;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
};

type LatLng = { lat: number; lng: number };
const DEFAULT_CENTER: LatLng = { lat: 5.6037, lng: -0.187 }; // Accra
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function RecenterController({ to }: { to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo(to);
  }, [map, to]);
  return null;
}

function MapSearchBox({ onFound }: { onFound: (loc: LatLng) => void }) {
  const geocoding = useMapsLibrary('geocoding');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      if (geocoding) {
        const geocoder = new geocoding.Geocoder();
        const { results } = await geocoder.geocode({ address: query.trim() + ', Ghana' });
        if (results[0]?.geometry.location) {
          onFound({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          });
        }
      } else {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim() + ', Ghana')}`,
        );
        const data = await res.json();
        if (data && data[0]) {
          onFound({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: '.4rem', marginBottom: '.5rem' }}>
      <input
        className="input"
        style={{ flex: 1 }}
        placeholder="🔍 Search area or landmark in Ghana to move map (e.g. Airport Residential, Spintex)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="button" className="btn" onClick={search} disabled={busy}>
        {busy ? 'Finding…' : 'Search Map'}
      </button>
    </div>
  );
}

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
  const [verificationStatus, setVerificationStatus] = useState('VERIFIED');
  const [website, setWebsite] = useState('');

  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);

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
          setVerificationStatus(c.verificationStatus || 'VERIFIED');
          setWebsite(c.website || '');
          if (c.lat && c.lng) {
            setMapCenter({ lat: c.lat, lng: c.lng });
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setCoordinates(newLat: number, newLng: number) {
    const roundedLat = Number(newLat.toFixed(6));
    const roundedLng = Number(newLng.toFixed(6));
    setLat(roundedLat);
    setLng(roundedLng);
    setMapCenter({ lat: roundedLat, lng: roundedLng });
  }

  function detectLocation() {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates(pos.coords.latitude, pos.coords.longitude);
        setSuccess('Coordinates updated from your current device GPS location.');
      },
      () => setError('Could not get current location. You can drag the pin on the map instead.'),
    );
  }

  function setPreset(presetLat: number, presetLng: number, label: string) {
    setCoordinates(presetLat, presetLng);
    setSuccess(`Location coordinates set to ${label}.`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');

    if (lat === '' || lng === '') {
      setError('Latitude and longitude coordinates are required so students can locate you on the map.');
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
      setSuccess('Organization profile and geographical location saved to database successfully!');
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
  const currentPin: LatLng = lat !== '' && lng !== '' ? { lat: Number(lat), lng: Number(lng) } : mapCenter;

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Organization Profile &amp; Location</h1>
          <p className="muted" style={{ margin: '.2rem 0' }}>
            Set your exact address and geographical coordinates so students can find and navigate to your organization.
          </p>
        </div>
        <span className="badge ok">
          ✓ {verificationStatus} Provider
        </span>
      </div>

      {!isLocationConfigured && (
        <div className="alert warn" role="alert">
          <strong>Location required:</strong> Please fill in your address, GhanaPost GPS / digital address, and set your location on the map below.
        </div>
      )}

      {success && <div className="alert ok" role="alert">{success}</div>}
      {error && <div className="alert error" role="alert">{error}</div>}

      <form onSubmit={submit} className="card stack">
        <h2 style={{ fontSize: '1.2rem' }}>Organization Details</h2>
        <div className="field">
          <label htmlFor="name">Organization Name</label>
          <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="industry">Industry Category</label>
            <input
              id="industry"
              className="input"
              required
              placeholder="e.g. Technology, Banking & Finance, Healthcare, Engineering"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="phone">Contact Phone Number</label>
            <input
              id="phone"
              className="input"
              required
              placeholder="e.g. +233 24 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="website">Website (optional)</label>
          <input id="website" className="input" type="url" placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <h2 style={{ fontSize: '1.2rem', marginTop: '1rem' }}>Location Management</h2>
        <div className="field">
          <label htmlFor="address">Physical Street Address</label>
          <input
            id="address"
            className="input"
            required
            placeholder="e.g. 14 Independence Avenue, Ridge, Accra"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
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

        {/* Interactive Map Picker */}
        <div style={{ marginTop: '.5rem' }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '.3rem' }}>
            Pin Location on Map (Drag marker or click map to position exact office)
          </label>

          {MAPS_KEY ? (
            <APIProvider apiKey={MAPS_KEY} libraries={['marker', 'geocoding', 'places']}>
              <MapSearchBox onFound={(loc) => setCoordinates(loc.lat, loc.lng)} />
              <div style={{ height: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <Map
                  defaultCenter={currentPin}
                  defaultZoom={13}
                  mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? 'DEMO_MAP_ID'}
                  gestureHandling="greedy"
                  onClick={(e) => {
                    if (e.detail.latLng) {
                      setCoordinates(e.detail.latLng.lat, e.detail.latLng.lng);
                    }
                  }}
                >
                  <RecenterController to={currentPin} />
                  <AdvancedMarker
                    position={currentPin}
                    draggable
                    title="Drag to your exact organization building"
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        setCoordinates(e.latLng.lat(), e.latLng.lng());
                      }
                    }}
                  >
                    <Pin background="#16a34a" borderColor="#14532d" glyphColor="#ffffff" scale={1.2} />
                  </AdvancedMarker>
                </Map>
              </div>
            </APIProvider>
          ) : (
            <p className="hint">Google Maps key not configured. You can use current GPS location or presets below.</p>
          )}
        </div>

        <div className="row" style={{ alignItems: 'flex-start', marginTop: '.5rem' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="lat">Latitude (Auto-obtained)</label>
            <input
              id="lat"
              className="input"
              type="number"
              step="0.000001"
              required
              placeholder="e.g. 5.603700"
              value={lat}
              onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="lng">Longitude (Auto-obtained)</label>
            <input
              id="lng"
              className="input"
              type="number"
              step="0.000001"
              required
              placeholder="e.g. -0.187000"
              value={lng}
              onChange={(e) => setLng(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={detectLocation}>📍 Use Current Device GPS</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPreset(5.6037, -0.187, 'Accra Central')}>Preset: Accra</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPreset(6.6885, -1.6244, 'Kumasi')}>Preset: Kumasi</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPreset(4.8987, -1.7583, 'Takoradi')}>Preset: Takoradi</button>
        </div>

        <h2 style={{ fontSize: '1.2rem', marginTop: '1rem' }}>Organization Profile &amp; Culture</h2>
        <div className="field">
          <label htmlFor="overview">Company Overview</label>
          <textarea id="overview" className="input" rows={3} maxLength={2000} placeholder="Brief summary of what your organization does" value={overview} onChange={(e) => setOverview(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="culture">Workplace Culture</label>
          <textarea id="culture" className="input" rows={2} maxLength={1500} placeholder="What should interns expect about your work environment?" value={culture} onChange={(e) => setCulture(e.target.value)} />
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }} disabled={busy}>
          {busy ? 'Saving...' : 'Save Profile & Location to Database'}
        </button>
      </form>
    </div>
  );
}
