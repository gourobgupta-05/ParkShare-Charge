'use client';

/** 🔒 Sign-in — Common Feature 1. One form for every role. */
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, HOME_BY_ROLE } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Card, { CardBody } from '@/components/ui/Card';

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password);
      router.push(params.get('next') || HOME_BY_ROLE[user.role] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="text-h1">Sign in</h1>
      <p className="mt-1 text-body text-ink-muted">Drivers, hosts and admins use the same form.</p>

      <Card className="mt-6">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Input label="Email" name="email" type="email" value={form.email} onChange={change} required autoComplete="email" />
            <Input label="Password" name="password" type="password" value={form.password} onChange={change} required autoComplete="current-password" />
            <Button type="submit" isLoading={busy} fullWidth>Sign in</Button>
          </form>
        </CardBody>
      </Card>

      <p className="mt-5 text-caption text-ink-muted">
        New here?{' '}
        <Link href="/register/driver" className="text-ink-brand underline">Create a driver account</Link>
        {' · '}
        <Link href="/register/host" className="text-ink-brand underline">List a space</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-6 text-body text-ink-muted">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}