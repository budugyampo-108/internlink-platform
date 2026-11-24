'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { api } from '@/lib/client';

type Opportunity = {
  id: string;
  title: string;
  departmentName: string;
  slotsLeft: number;
  requiredSkills: string[];
  availableFrom: string;
  availableTo: string;
};

type Organization = {
  id: string;
  name: string;
  overview: string;
  industry: string;
  address: string;
  digitalAddress: string;
  phone: string;
  website: string | null;
  lat: number;
  lng: number;
  verificationStatus: string;
  distanceKm: number | null;
  totalSlotsAvailable: number;
  vacancies: Opportunity[];
};

type LatLng = { lat: number; lng: number };

const DEFAULT_GHANA_CENTER: LatLng = { lat: 5.6037, lng: -0.187 }; // Accra, Ghana
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function RecenterController({ to }: { to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo(to);
  }, [map, to]);
  return null;
}

function PlaceSearchBox({ onFound, onError }: { onFound: (p: LatLng) => void; onError: (m: string) => void }) {
  const geocoding = useMapsLibrary('geocoding');
  const [text, setText] = useState('');
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 2) return;
    setSearching(true);
    try {
      if (!geocoding) {
        // Fallback to nominatim if geocoding library not loaded
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text.trim() + ', Ghana')}`,
        );
        const data = await res.json();
        if (data && data[0]) {
          onFound({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        } else {
          onError('Could not find that location. Try another town, region, or landmark in Ghana.');
        }
        return;
      }

      const geocoder = new geocoding.Geocoder();
      const { results } = await geocoder.geocode({ address: text.trim() + ', Ghana' });
      const loc = results[0]?.geometry.location;
      if (loc) {
        onFound({ lat: loc.lat(), lng: loc.lng() });
      } else {
        onError('Could not find that town or place. Try searching with a landmark name.');
      }
    } catch {
      onError('Place search failed. You can also drag the pin on the map.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <form onSubmit={handleSearch} className="row" role="search" aria-label="Search town or landmark in Ghana">
      <input
        className="input"
        style={{ flex: 1, minWidth: 180 }}
        placeholder="🔍 Search town, region or landmark (e.g. Kumasi, Osu, Takoradi)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={120}
      />
      <button className="btn" disabled={searching}>
        {searching ? 'Searching…' : 'Locate on Map'}
      </button>
    </form>
  );
}

export function VacancyExplorer() {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [center, setCenter] = useState<LatLng>(DEFAULT_GHANA_CENTER);
  const [pinned, setPinned] = useState(false);
  const [radius, setRadius] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('ALL');
  const [categories, setCategories] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [error, setError] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<'map' | 'list'>('map');

  // Request browser geolocation automatically on component mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setCenter(loc);
          setPinned(true);
          setGeoMsg('📍 Centered on your current location.');
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGeoMsg('Location access was denied. You can search for your town or click the map to set your position.');
          } else {
            setGeoMsg('Unable to retrieve your current location. Tap the map or search a town to position yourself.');
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    }
  }, []);

  const selectedOrg = useMemo(
    () => organizations?.find((o) => o.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId],
  );

  const fetchOrganizations = useCallback(async () => {
    setOrganizations(null);
    setError('');
    const params = new URLSearchParams({ radiusKm: String(radius) });
    if (pinned) {
      params.set('lat', String(center.lat));
      params.set('lng', String(center.lng));
    }
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    if (selectedIndustry && selectedIndustry !== 'ALL') {
      params.set('industry', selectedIndustry);
    }

    try {
      const data = await api<{ organizations: Organization[]; categories: string[] }>(
        `/api/organizations?${params.toString()}`,
      );
      setOrganizations(data.organizations);
      if (data.categories?.length) {
        setCategories(data.categories);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load organizations');
      setOrganizations([]);
    }
  }, [center, pinned, radius, searchQuery, selectedIndustry]);

  useEffect(() => {
    const timer = setTimeout(fetchOrganizations, 300);
    return () => clearTimeout(timer);
  }, [fetchOrganizations]);

  function returnToMyLocation() {
    setGeoMsg('');
    if (userLocation) {
      setCenter(userLocation);
      setPinned(true);
      setGeoMsg('📍 Centered back on your current location.');
      return;
    }

    if (!('geolocation' in navigator)) {
      setGeoMsg('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setCenter(loc);
        setPinned(true);
        setGeoMsg('📍 Centered on your current location.');
      },
      (err) => {
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied in your browser.'
            : 'Unable to get location. Search a town or click the map.',
        );
      },
    );
  }

  function getDirectionsUrl(org: Organization) {
    const origin = pinned ? `${center.lat},${center.lng}` : '';
    const destination = `${org.lat},${org.lng}`;
    return origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }

  const listPane = (
    <section aria-label="Organizations and Industries" aria-live="polite" className="stack">
      {organizations === null &&
        [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 160 }} aria-hidden />)}
      {error && <div className="alert error" role="alert">{error}</div>}
      {organizations?.length === 0 && !error && (
        <div className="empty card">
          <h3>No organizations found in this area</h3>
          <p>Try widening the search radius, clearing industry filters, or searching another town.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setRadius(200);
              setSearchQuery('');
              setSelectedIndustry('ALL');
            }}
          >
            Widen Search Area (200 km)
          </button>
        </div>
      )}

      {organizations?.map((org) => {
        const isSelected = org.id === selectedOrgId;
        return (
          <article
            key={org.id}
            className="vac card"
            style={{
              cursor: 'pointer',
              border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
              background: isSelected ? 'var(--brand-soft, #f0fdf4)' : 'inherit',
            }}
            onClick={() => {
              setSelectedOrgId(org.id);
              setCenter({ lat: org.lat, lng: org.lng });
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="row" style={{ gap: '.5rem', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{org.name}</h3>
                  <span className="badge ok" style={{ fontSize: '.75rem' }}>✓ Verified</span>
                </div>
                <div className="muted small" style={{ margin: '.2rem 0' }}>
                  Industry: <strong>{org.industry}</strong>
                </div>
              </div>
              {org.distanceKm !== null && (
                <span className="badge" style={{ fontWeight: 600 }}>
                  📍 {org.distanceKm} km away
                </span>
              )}
            </div>

            <p className="small" style={{ margin: '.4rem 0' }}>
              <strong>Address:</strong> {org.address} · <span className="mono">{org.digitalAddress}</span>
              {org.phone && (
                <> · <strong>Tel:</strong> <a href={`tel:${org.phone}`}>{org.phone}</a></>
              )}
            </p>

            {org.overview && (
              <p className="small muted" style={{ margin: '.2rem 0 .5rem', lineClamp: 2 }}>
                {org.overview}
              </p>
            )}

            {/* Opportunities section */}
            <div style={{ marginTop: '.5rem', borderTop: '1px solid var(--border)', paddingTop: '.5rem' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small">
                  <strong>Available Opportunities:</strong> {org.vacancies.length} role(s) ({org.totalSlotsAvailable} total slots)
                </span>
                <a
                  className="btn btn-ghost small"
                  href={getDirectionsUrl(org)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  🗺 Get Directions ↗
                </a>
              </div>

              {org.vacancies.length > 0 && (
                <div className="stack" style={{ gap: '.4rem', marginTop: '.4rem' }}>
                  {org.vacancies.map((v) => (
                    <div
                      key={v.id}
                      className="row"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--card-bg, #fff)',
                        padding: '.4rem .6rem',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <strong>{v.title}</strong>
                        <div className="muted small">{v.departmentName} · {v.slotsLeft} slot(s) left</div>
                      </div>
                      <Link
                        href={`/student/apply/${v.id}`}
                        className="btn btn-primary small"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Apply (Upload Letter) →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );

  return (
    <div className="stack">
      {/* Search and Filter Control Bar */}
      <div className="card stack">
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={returnToMyLocation}>
            📍 Return to My Location
          </button>

          <label className="row small" style={{ alignItems: 'center' }}>
            Radius:
            <select
              className="input"
              style={{ width: 'auto' }}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label="Search radius"
            >
              {[10, 25, 50, 100, 200, 500].map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
          </label>

          <label className="row small" style={{ alignItems: 'center' }}>
            Industry:
            <select
              className="input"
              style={{ width: 'auto', minWidth: 140 }}
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              aria-label="Filter by industry"
            >
              <option value="ALL">All Industries</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <input
            className="input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Search by organization name, town, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search organizations"
            maxLength={100}
          />
        </div>

        {geoMsg && <div className="alert info" role="status">{geoMsg}</div>}
        {!pinned && (
          <p className="hint" style={{ margin: 0 }}>
            Showing verified internship providers across Ghana. Click on the map or use the search box to locate your town and sort by distance.
          </p>
        )}
      </div>

      {!MAPS_KEY && (
        <div className="alert warn">
          <strong>Google Maps API key not detected:</strong> Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your environment variables to enable the interactive map. The nearby organizations list and directions links below continue to work in full.
        </div>
      )}

      {/* Tabs for Mobile View */}
      <div className="tabs" role="tablist" aria-label="View toggle">
        <button
          role="tab"
          aria-selected={tab === 'map'}
          className={`btn ${tab === 'map' ? 'btn-primary' : ''}`}
          onClick={() => setTab('map')}
        >
          🗺 Interactive Map
        </button>
        <button
          role="tab"
          aria-selected={tab === 'list'}
          className={`btn ${tab === 'list' ? 'btn-primary' : ''}`}
          onClick={() => setTab('list')}
        >
          🏢 Nearby Industries ({organizations?.length ?? '…'})
        </button>
      </div>

      {/* Main Explorer View */}
      <div className="explorer">
        {/* Organizations List Pane */}
        <div data-hidden={tab === 'map'} id="list-pane">
          {listPane}
        </div>

        {/* Map Pane */}
        <div className="stack" data-hidden={tab === 'list'} id="map-pane">
          {MAPS_KEY ? (
            <APIProvider apiKey={MAPS_KEY} libraries={['marker', 'geocoding', 'places']}>
              <PlaceSearchBox
                onFound={(p) => {
                  setCenter(p);
                  setPinned(true);
                }}
                onError={setGeoMsg}
              />

              <div className="map-box" style={{ minHeight: 460, borderRadius: 12, overflow: 'hidden' }}>
                <Map
                  defaultCenter={DEFAULT_GHANA_CENTER}
                  defaultZoom={11}
                  mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? 'DEMO_MAP_ID'}
                  gestureHandling="greedy"
                  onClick={(e) => {
                    if (e.detail.latLng) {
                      setCenter(e.detail.latLng);
                      setPinned(true);
                    }
                  }}
                >
                  <RecenterController to={center} />

                  {/* Student's Current Location Marker */}
                  {pinned && (
                    <AdvancedMarker
                      position={center}
                      draggable
                      title="Your Position (drag to adjust search center)"
                      onDragEnd={(e) => {
                        if (e.latLng) {
                          setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                        }
                      }}
                    >
                      <Pin background="#2563eb" borderColor="#1e3a8a" glyphColor="#ffffff" scale={1.2} />
                    </AdvancedMarker>
                  )}

                  {/* Registered Organization Markers */}
                  {organizations?.map((org) => {
                    const isSelected = org.id === selectedOrgId;
                    return (
                      <AdvancedMarker
                        key={org.id}
                        position={{ lat: org.lat, lng: org.lng }}
                        title={`${org.name} (${org.industry})`}
                        onClick={() => setSelectedOrgId(org.id)}
                      >
                        <Pin
                          background={isSelected ? '#16a34a' : '#d97706'}
                          borderColor={isSelected ? '#14532d' : '#78350f'}
                          glyphColor="#ffffff"
                          scale={isSelected ? 1.3 : 1.0}
                        />
                      </AdvancedMarker>
                    );
                  })}

                  {/* InfoWindow for selected organization */}
                  {selectedOrg && (
                    <InfoWindow
                      position={{ lat: selectedOrg.lat, lng: selectedOrg.lng }}
                      pixelOffset={[0, -38]}
                      onCloseClick={() => setSelectedOrgId(null)}
                    >
                      <div style={{ maxWidth: 280, color: '#0f172a', padding: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                          <strong style={{ fontSize: '14px' }}>{selectedOrg.name}</strong>
                          <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 600 }}>✓ Verified</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                          {selectedOrg.industry}
                        </div>
                        <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                          📍 {selectedOrg.address}
                        </div>
                        {selectedOrg.distanceKm !== null && (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', marginBottom: '6px' }}>
                            {selectedOrg.distanceKm} km away
                          </div>
                        )}
                        <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                          Slots: <strong>{selectedOrg.totalSlotsAvailable} available</strong> ({selectedOrg.vacancies.length} role(s))
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <a
                            href={getDirectionsUrl(selectedOrg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              background: '#f1f5f9',
                              borderRadius: '4px',
                              fontSize: '11px',
                              textDecoration: 'none',
                              color: '#1e293b',
                              fontWeight: 500,
                            }}
                          >
                            🗺 Get Directions
                          </a>
                          {selectedOrg.vacancies[0] && (
                            <Link
                              href={`/student/apply/${selectedOrg.vacancies[0].id}`}
                              style={{
                                display: 'inline-block',
                                padding: '4px 8px',
                                background: '#16a34a',
                                borderRadius: '4px',
                                fontSize: '11px',
                                textDecoration: 'none',
                                color: '#ffffff',
                                fontWeight: 500,
                              }}
                            >
                              Apply Now →
                            </Link>
                          )}
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Map>
              </div>
            </APIProvider>
          ) : (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <h3>Interactive Map Ready</h3>
              <p className="muted">
                Add your Google Maps API key (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>) to display the live Google Map.
              </p>
              <div style={{ marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={() => setTab('list')}>
                  View Nearby Organizations List ({organizations?.length ?? 0})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
