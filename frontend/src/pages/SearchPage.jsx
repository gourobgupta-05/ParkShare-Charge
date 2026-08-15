import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { searchNearbySlots } from '../utils/api';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

export default function SearchPage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [slots, setSlots] = useState([]);
  const [radiusKm, setRadiusKm] = useState(3);
  const [propertyType, setPropertyType] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords({ lat: 23.8103, lng: 90.4125 }) // fallback: Dhaka center
    );
  }, []);

  useEffect(() => {
    if (!coords || mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [coords.lng, coords.lat],
      zoom: 13,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Signature element: a pulsing radar ring at the driver's location,
    // visualizing "real-time radius search" concretely.
    const el = document.createElement('div');
    el.className = 'radar-pulse';
    new mapboxgl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(mapRef.current);
  }, [coords]);

  const runSearch = async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const res = await searchNearbySlots({ lat: coords.lat, lng: coords.lng, radiusKm, ...(propertyType && { propertyType }) });
      setSlots(res.data.data);
      renderMarkers(res.data.data);
    } catch (err) {
      console.error('Search failed:', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkers = (results) => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = results.map((slot) => {
      const [lng, lat] = slot.location.coordinates;
      const popup = new mapboxgl.Popup({ offset: 24 }).setHTML(
        `<strong>${slot.title}</strong><br/>৳${slot.pricePerHour}/hr · ${(slot.distanceMeters / 1000).toFixed(2)} km`
      );
      return new mapboxgl.Marker({ color: '#4FE3C1' }).setLngLat([lng, lat]).setPopup(popup).addTo(mapRef.current);
    });
  };

  useEffect(() => {
    if (coords) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  return (
    <div>
      <div className="page-eyebrow">Module 1 </div>
      <div className="page-header">
        <h1>Real-Time Geospatial Search</h1>
        <p>Find charging slots near you, ranked by live distance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <label>Property type</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="">All types</option>
              <option value="Residential">Residential</option>
              <option value="Mall">Mall</option>
            </select>
            <label>Search radius</label>
            <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={{ marginBottom: 16 }}>
              <option value={1}>1 km</option>
              <option value={3}>3 km</option>
              <option value={5}>5 km</option>
            </select>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={runSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Search nearby'}
            </button>
          </div>

          <div className="page-eyebrow" style={{ marginBottom: 10 }}>{slots.length} result{slots.length !== 1 ? 's' : ''}</div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {slots.map((s) => (
              <div key={s._id} className="result-card">
                <div className="title">{s.title}</div>
                <div className="meta">{s.address}</div>
                <div className="meta">
                  <span className="price">৳{s.pricePerHour}/hr</span> · {(s.distanceMeters / 1000).toFixed(2)} km away
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={mapContainer} style={{ borderRadius: 12, overflow: 'hidden', minHeight: 560, border: '1px solid var(--border)' }} />
      </div>
    </div>
  );
}
