'use client';
/** 🔒 Host signup — property specs, Residential|Mall, location (Common Feature 1). */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { PROPERTY_TYPE, PLATFORM } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Card, { CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/formatters';

export default function RegisterHostPage() {
  const { registerHost } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    propertyType: PROPERTY_TYPE.RESIDENTIAL, businessName: '',
    line1: '', area: '', city: 'Dhaka',
    latitude: PLATFORM.DHAKA_CENTER.lat,
    longitude: PLATFORM.DHAKA_CENTER.lng,
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const isMall = form.propertyType === PROPERTY_TYPE.MALL;

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => setError('Could not read your location. Enter the coordinates manually.')
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    try {
      await registerHost({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        propertyType: form.propertyType,
        businessName: isMall ? form.businessName : null,
        address: { line1: form.line1, area: form.area, city: form.city },
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      router.push('/host/verification');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="text-h1">List your space</h1>
      <p className="mt-1 text-body text-ink-muted">
        You&apos;ll complete document verification before your listing goes live.
      </p>

      <Card className="mt-6">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}

            {/* Category selection drives the whole host experience downstream */}
            <div>
              <p className="mb-2 text-caption font-medium text-ink">What are you listing?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: PROPERTY_TYPE.RESIDENTIAL, title: 'Residential', sub: 'A garage or driveway slot' },
                  { value: PROPERTY_TYPE.MALL, title: 'Commercial mall', sub: 'Basement or multi-bay parking' },
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setForm((f) => ({ ...f, propertyType: opt.value }))}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors duration-fast',
                      form.propertyType === opt.value
                        ? 'border-brand-primary bg-brand-primary-subtle'
                        : 'border-line hover:border-line-strong'
                    )}
                  >
                    <span className="block text-body font-medium text-ink">{opt.title}</span>
                    <span className="mt-0.5 block text-caption text-ink-muted">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input label="Full name" name="name" value={form.name} onChange={change} error={fieldErrors.name} required />
            {isMall && (
              <Input label="Business name" name="businessName" value={form.businessName} onChange={change} placeholder="Jamuna Future Park" />
            )}
            <Input label="Email" name="email" type="email" value={form.email} onChange={change} error={fieldErrors.email} required />
            <Input label="Mobile number" name="phone" value={form.phone} onChange={change} error={fieldErrors.phone} placeholder="01XXXXXXXXX" required />
            <Input label="Password" name="password" type="password" value={form.password} onChange={change} error={fieldErrors.password} hint="At least 8 characters with a letter and a number" required />

            <div className="mt-2 border-t border-line pt-4">
              <p className="text-overline uppercase text-ink-muted">Where is it?</p>
              <div className="mt-3 flex flex-col gap-3">
                <Input label="Street address" name="line1" value={form.line1} onChange={change} required />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Area" name="area" value={form.area} onChange={change} placeholder="Dhanmondi" />
                  <Input label="City" name="city" value={form.city} onChange={change} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Latitude" name="latitude" value={form.latitude} onChange={change} error={fieldErrors.latitude} />
                  <Input label="Longitude" name="longitude" value={form.longitude} onChange={change} error={fieldErrors.longitude} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
                  Use my current location
                </Button>
              </div>
            </div>

            <Button type="submit" isLoading={busy} fullWidth>Create host account</Button>
          </form>
        </CardBody>
      </Card>

      <p className="mt-5 text-caption text-ink-muted">
        Looking to park instead?{' '}
        <Link href="/register/driver" className="text-ink-brand underline">Register as a driver</Link>
      </p>
    </main>
  );
}
