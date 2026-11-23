'use client';
/**
 * Student "Discover nearby" screen: Google Map + filterable list.
 *  – Detect current location (permission aware) OR search a place OR drag/click to pin a vacation location.
 *  – Server does the radius filtering (Haversine in SQL); markers open a quick vacancy preview.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, APIProvider, InfoWindow, Map, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { api } from '@/lib/client';

type Vacancy = {
  id: string; title: string; departmentName: string; companyName: string; address: string; digitalAddress: string;
  lat: number; lng: number; slotsLeft: number; requiredSkills: string[]; distanceKm: number | null;
};
type LatLng = { lat: number; lng: number };

const ACCRA: LatLng = { lat: 5.6037, lng: -0.187 }; // neutral starting view until the user pins a location
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function Recenter({ to }: { to: LatLng }) {
  const map = useMap();
  useEffect(() => { map?.panTo(to); }, [map, to]);
  return null;
}

/** Fallback when geolocation is denied/unavailable: geocode a typed place. */
function PlaceSearch({ onFound, onError }: { onFound: (p: LatLng) => void; onError: (m: string) => void }) {
  const geocoding = useMapsLibrary('geocoding');
  const [text, setText] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!geocoding || text.trim().length < 3) return;
    try {
      const { results } = await new geocoding.Geocoder().geocode({ address: text.trim() });
      const loc = results[0]?.geometry.location;
      if (loc) onFound({ lat: loc.lat(), lng: loc.lng() });
      else onError('We could not find that place. Try a town or landmark name.');
    } catch {
      onError('Place search failed. You can also drag the blue pin on the map.');
    }
  }
  return (
    <form onSubmit={go} className="row" role="search" aria-label="Search for a place">
      <label htmlFor="place" className="sr-only">Search a town or address</label>
      <input id="place" className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search a town or address" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} />
      <button className="btn" disabled={!geocoding}>Search</button>
    </form>
  );
}

export function VacancyExplorer() {
  const [center, setCenter] = useState<LatLng>(ACCRA);
  const [pinned, setPinned] = useState(false);
  const [radius, setRadius] = useState(50);
  const [q, setQ] = useState('');
  const [skills, setSkills] = useState('');
  const [items, setItems] = useState<Vacancy[] | null>(null);
  const [error, setError] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'map' | 'list'>('map');

  const selectedItem = useMemo(() => items?.find((i) => i.id === selected) ?? null, [items, selected]);

  const load = useCallback(async () => {
    setItems(null); setError('');
    const p = new URLSearchParams({ radiusKm: String(radius), limit: '50' });
    if (pinned) { p.set('lat', String(center.lat)); p.set('lng', String(center.lng)); }
    if (q.trim()) p.set('q', q.trim());
    if (skills.trim()) p.set('skills', skills.trim());
    try {
      setItems((await api<{ vacancies: Vacancy[] }>(`/api/vacancies?${p}`)).vacancies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load vacancies');
      setItems([]);
    }
  }, [center, pinned, radius, q, skills]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce typing / dragging
    return () => clearTimeout(t);
  }, [load]);

  function detect() {
    setGeoMsg('');
    if (!('geolocation' in navigator)) return setGeoMsg('Location is not supported on this device. Search a place or drop a pin instead.');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPinned(true); setGeoMsg('Using your current location.'); },
      (err) =>
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Search for your vacation town below or tap the map to drop a pin.'
            : 'We could not get your location. Search for a place or tap the map to drop a pin.',
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const pin = (p: LatLng) => { setCenter(p); setPinned(true); };

  const list = (
    <section aria-label="Vacancies" aria-live="polite" className="stack">
      {items === null && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} aria-hidden />)}
      {error && <div className="alert error" role="alert">{error}</div>}
      {items?.length === 0 && !error && (
        <div className="empty card">
          <h3>No open slots here yet</h3>
          <p>Try a larger radius, fewer filters, or pin a different town.</p>
          <button className="btn" onClick={() => { setRadius(200); setQ(''); setSkills(''); }}>Widen search</button>
        </div>
      )}
      {items?.map((v) => (
        <article key={v.id} className="vac" aria-selected={v.id === selected} onClick={() => setSelected(v.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{v.title}</h3>
            {v.distanceKm !== null && <span className="badge">{v.distanceKm} km</span>}
          </div>
          <p className="muted small" style={{ margin: '.25rem 0' }}>{v.companyName} · {v.departmentName}</p>
          <p className="small" style={{ margin: '0 0 .5rem' }}>{v.address} · <span className="mono">{v.digitalAddress}</span></p>
          <div className="row" style={{ gap: '.35rem', marginBottom: '.75rem' }}>
            {v.requiredSkills.slice(0, 5).map((s) => <span key={s} className="chip">{s}</span>)}
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={`badge ${v.slotsLeft <= 1 ? 'warn' : 'ok'}`}>{v.slotsLeft} slot{v.slotsLeft === 1 ? '' : 's'} left</span>
            <Link href={`/student/apply/${v.id}`} className="btn btn-primary">View &amp; apply</Link>
          </div>
        </article>
      ))}
    </section>
  );

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row">
          <button className="btn btn-primary" onClick={detect}>📍 Use my current location</button>
          <label className="row small">Within
            <select className="input" style={{ width: 'auto' }} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius">
              {[10, 25, 50, 100, 200].map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
          </label>
          <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Search role, department or company" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search vacancies" maxLength={80} />
          <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Skills, comma separated" value={skills} onChange={(e) => setSkills(e.target.value)} aria-label="Filter by skills" maxLength={200} />
        </div>
        {geoMsg && <div className="alert info" role="status">{geoMsg}</div>}
        {!pinned && <p className="hint" style={{ margin: 0 }}>Showing all open vacancies. Pin a location to sort and filter by distance.</p>}
      </div>

      {!MAPS_KEY ? (
        <div className="alert warn">Google Maps is not configured (set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>). Listing still works.</div>
      ) : null}

      <div className="tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={tab === 'map'} className="btn" onClick={() => setTab('map')}>Map</button>
        <button role="tab" aria-selected={tab === 'list'} className="btn" onClick={() => setTab('list')}>List</button>
      </div>

      <div className="explorer">
        <div data-hidden={tab === 'map'} id="list-pane">{list}</div>
        <div className="stack" data-hidden={tab === 'list'} id="map-pane">
          {MAPS_KEY && (
            <APIProvider apiKey={MAPS_KEY} libraries={['marker', 'geocoding']}>
              <PlaceSearch onFound={pin} onError={setGeoMsg} />
              <div className="map-box">
                <Map
                  defaultCenter={ACCRA}
                  defaultZoom={11}
                  mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? 'DEMO_MAP_ID'}
                  gestureHandling="greedy"
                  onClick={(e) => e.detail.latLng && pin(e.detail.latLng)}
                >
                  <Recenter to={center} />
                  {pinned && (
                    <AdvancedMarker position={center} draggable title="Your location (drag to adjust)" onDragEnd={(e) => e.latLng && pin({ lat: e.latLng.lat(), lng: e.latLng.lng() })}>
                      <Pin background="#2563eb" borderColor="#1e3a8a" glyphColor="#fff" />
                    </AdvancedMarker>
                  )}
                  {items?.map((v) => (
                    <AdvancedMarker key={v.id} position={{ lat: v.lat, lng: v.lng }} title={`${v.title} — ${v.companyName}`} onClick={() => setSelected(v.id)}>
                      <Pin background="#d97706" borderColor="#78350f" glyphColor="#fff" />
                    </AdvancedMarker>
                  ))}
                  {selectedItem && (
                    <InfoWindow position={{ lat: selectedItem.lat, lng: selectedItem.lng }} pixelOffset={[0, -38]} onCloseClick={() => setSelected(null)}>
                      <div style={{ maxWidth: 220, color: '#0f172a' }}>
                        <strong>{selectedItem.title}</strong><br />
                        {selectedItem.companyName}<br />
                        <span style={{ fontSize: 12 }}>{selectedItem.slotsLeft} slots · {selectedItem.distanceKm ?? '—'} km</span><br />
                        <Link href={`/student/apply/${selectedItem.id}`}>View &amp; apply →</Link>
                      </div>
                    </InfoWindow>
                  )}
                </Map>
              </div>
            </APIProvider>
          )}
        </div>
      </div>
    </div>
  );
}
