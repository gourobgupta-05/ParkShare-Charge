'use client';
/** 🔒 Driver signup — personal info + EV specs (Common Feature 1). */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { CONNECTOR_TYPE } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Card, { CardBody } from '@/components/ui/Card';

const CONNECTOR_OPTIONS = [
  { value: '', label: 'Select connector' },
  ...Object.values(CONNECTOR_TYPE).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
];

export default function RegisterDriverPage() {
  const { registerDriver } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    make: '', model: '', batteryKwh: '', connectorType: '', plateNumber: '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    try {
      await registerDriver({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        ev: {
          make: form.make || null,
          model: form.model || null,
          batteryKwh: form.batteryKwh ? Number(form.batteryKwh) : null,
          connectorType: form.connectorType || null,
          plateNumber: form.plateNumber || null,
        },
      });
      router.push('/search');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="text-h1">Create a driver account</h1>
      <p className="mt-1 text-body text-ink-muted">
        EV details are optional — add them to see chargers that fit your car.
      </p>

      <Card className="mt-6">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}

            <Input label="Full name" name="name" value={form.name} onChange={change} error={fieldErrors.name} required />
            <Input label="Email" name="email" type="email" value={form.email} onChange={change} error={fieldErrors.email} required />
            <Input label="Mobile number" name="phone" value={form.phone} onChange={change} error={fieldErrors.phone} placeholder="01XXXXXXXXX" required />
            <Input label="Password" name="password" type="password" value={form.password} onChange={change} error={fieldErrors.password} hint="At least 8 characters with a letter and a number" required />

            <div className="mt-2 border-t border-line pt-4">
              <p className="text-overline uppercase text-ink-muted">Your vehicle</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input label="Make" name="make" value={form.make} onChange={change} placeholder="Tesla" />
                <Input label="Model" name="model" value={form.model} onChange={change} placeholder="Model 3" />
                <Input label="Battery (kWh)" name="batteryKwh" type="number" value={form.batteryKwh} onChange={change} placeholder="60" />
                <Select label="Connector" name="connectorType" value={form.connectorType} onChange={change} options={CONNECTOR_OPTIONS} />
                <Input label="Plate number" name="plateNumber" value={form.plateNumber} onChange={change} className="col-span-2" placeholder="DHAKA METRO GA 11-1111" />
              </div>
            </div>

            <Button type="submit" isLoading={busy} fullWidth>Create account</Button>
          </form>
        </CardBody>
      </Card>

      <p className="mt-5 text-caption text-ink-muted">
        Renting out a space instead?{' '}
        <Link href="/register/host" className="text-ink-brand underline">Register as a host</Link>
      </p>
    </main>
  );
}
