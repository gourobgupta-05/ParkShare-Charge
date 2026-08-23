'use client';
/**
 * SPACE PROVISIONING — OWNER: S. Moontaha Rahman [SMR]
 * Creates a listing, then publishes it once the host is verified and their
 * calendar is open. Both gates are enforced server-side; this surfaces them.
 */
import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { CONNECTOR_TYPE, PLATFORM } from '@/lib/constants';
import { provisionSpace } from '../api/hostVerification.api';

const CONNECTORS = [
  { value: '', label: 'Select connector' },
  ...Object.values(CONNECTOR_TYPE).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
];

const EMPTY = {
  title: '', description: '', line1: '', area: '', city: 'Dhaka',
  latitude: PLATFORM.DHAKA_CENTER.lat, longitude: PLATFORM.DHAKA_CENTER.lng,
  entranceLatitude: '', entranceLongitude: '', entranceInstructions: '',
  priceTaka: '80', totalSlots: '1',
  hasCharger: false, kw: '', connectorType: '', overheadTaka: '1.50',
};

export default function SpaceProvisionForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => setError('Could not read your location. Enter the coordinates manually.')
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const property = await provisionSpace({
        title: form.title,
        description: form.description,
        address: { line1: form.line1, area: form.area, city: form.city },
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        ...(form.entranceLatitude && form.entranceLongitude
          ? {
              entranceLatitude: Number(form.entranceLatitude),
              entranceLongitude: Number(form.entranceLongitude),
              entranceInstructions: form.entranceInstructions,
            }
          : {}),
        pricePerHourPoisha: Math.round(Number(form.priceTaka) * 100),
        totalSlots: Number(form.totalSlots) || 1,
        hasCharger: form.hasCharger,
        chargerSpec: form.hasCharger
          ? {
              kw: Number(form.kw) || null,
              connectorType: form.connectorType || null,
              overheadPoishaPerKwh: Math.round(Number(form.overheadTaka || 0) * 100),
            }
          : {},
      });
      setMessage(`"${property.title}" created — open its calendar, then publish it`);
      setForm(EMPTY);
      onCreated?.(property);
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Add a space" subtitle="You can publish it once you are verified" />
      <CardBody className="grid gap-3 sm:grid-cols-2">
        {message && (
          <div className="sm:col-span-2">
            <Alert tone="success">
              {message}{' '}
              <Link href="/host/availability" className="font-medium underline">
                Open the calendar
              </Link>
            </Alert>
          </div>
        )}
        {error && <div className="sm:col-span-2"><Alert tone="danger">{error}</Alert></div>}

        <Input label="Name" name="title" value={form.title} onChange={change} placeholder="Dhanmondi 27 covered garage" />
        <Input label="Price per hour (BDT)" name="priceTaka" type="number" value={form.priceTaka} onChange={change} />
        <Input label="Street address" name="line1" value={form.line1} onChange={change} className="sm:col-span-2" />
        <Input label="Area" name="area" value={form.area} onChange={change} placeholder="Dhanmondi" />
        <Input label="City" name="city" value={form.city} onChange={change} />
        <Input label="Latitude" name="latitude" value={form.latitude} onChange={change} />
        <Input label="Longitude" name="longitude" value={form.longitude} onChange={change} />

        <div className="sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
            Use my current location
          </Button>
        </div>

        <div className="sm:col-span-2 border-t border-line pt-3">
          <p className="text-caption font-medium text-ink">Gate coordinates (optional)</p>
          <p className="text-caption text-ink-muted">
            Drivers are routed here rather than to the map pin — worth setting for basements and gated compounds.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Input label="Gate latitude" name="entranceLatitude" value={form.entranceLatitude} onChange={change} />
            <Input label="Gate longitude" name="entranceLongitude" value={form.entranceLongitude} onChange={change} />
            <Input
              label="Entrance note"
              name="entranceInstructions"
              value={form.entranceInstructions}
              onChange={change}
              placeholder="Blue gate beside the pharmacy"
              className="sm:col-span-2"
            />
          </div>
        </div>

        <div className="sm:col-span-2 border-t border-line pt-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-primary"
              checked={form.hasCharger}
              onChange={(e) => setForm((f) => ({ ...f, hasCharger: e.target.checked }))}
            />
            <span className="text-body text-ink">This space has an EV charger</span>
          </label>

          {form.hasCharger && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input label="Power (kW)" name="kw" type="number" value={form.kw} onChange={change} />
              <Select
                label="Connector"
                name="connectorType"
                value={form.connectorType}
                onChange={change}
                options={CONNECTORS}
              />
              <Input
                label="Overhead (৳/kWh)"
                name="overheadTaka"
                type="number"
                step="0.10"
                value={form.overheadTaka}
                onChange={change}
              />
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <Button onClick={create} isLoading={busy} disabled={!form.title.trim() || !form.line1.trim()}>
            Create space
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
