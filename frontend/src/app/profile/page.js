'use client';
/** 🔒 Profile & access management — Common Feature 2. Every role uses this. */
import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { ROLES } from '@/lib/constants';

function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [prefs, setPrefs] = useState(user.notificationPrefs);
  const [payment, setPayment] = useState({
    preferredPaymentMethod: user.preferredPaymentMethod || 'WALLET',
    payoutType: user.payoutChannel?.type || '',
    accountRef: '',
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const flash = (text) => { setMessage(text); setError(null); setTimeout(() => setMessage(null), 3000); };

  async function saveProfile(e) {
    e.preventDefault(); setBusy('profile'); setError(null);
    try {
      const data = await api.patch('/profile', profile);
      setUser(data.user); flash('Profile updated');
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  }

  async function savePassword(e) {
    e.preventDefault(); setBusy('password'); setError(null);
    try {
      await api.patch('/profile/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' }); flash('Password changed');
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  }

  async function savePayment() {
    setBusy('payment'); setError(null);
    try {
      // Preferred method lives on preferences; payout channel on the profile.
      const prefsData = await api.patch('/profile/preferences', {
        preferredPaymentMethod: payment.preferredPaymentMethod,
      });
      let latest = prefsData.user;

      if (user.role === ROLES.HOST && payment.payoutType) {
        const profileData = await api.patch('/profile', {
          payoutChannel: { type: payment.payoutType, accountRef: payment.accountRef },
        });
        latest = profileData.user;
      }

      setUser(latest);
      setPayment((p) => ({ ...p, accountRef: '' }));
      flash('Payment settings saved');
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally { setBusy(null); }
  }

  async function savePrefs(next) {
    setPrefs(next);
    try {
      const data = await api.patch('/profile/preferences', { notificationPrefs: next });
      setUser(data.user);
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1">Your profile</h1>
          <p className="mt-1 text-body text-ink-muted">
            Signed in as {user.email} · {user.role === ROLES.HOST ? 'Host' : user.role === ROLES.ADMIN ? 'Admin' : 'Driver'}
          </p>
        </div>
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </div>

      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <Input label="Full name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Mobile number" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            <Button type="submit" isLoading={busy === 'profile'} className="self-start">Save changes</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Password" />
        <CardBody>
          <form onSubmit={savePassword} className="flex flex-col gap-4">
            <Input label="Current password" type="password" value={passwords.currentPassword} onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))} required />
            <Input label="New password" type="password" value={passwords.newPassword} onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} hint="At least 8 characters with a letter and a number" required />
            <Button type="submit" isLoading={busy === 'password'} className="self-start">Change password</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Payment channel"
          subtitle={
            user.role === ROLES.HOST
              ? 'How you pay, and where your earnings are sent'
              : 'How you top up your wallet'
          }
        />
        <CardBody className="flex flex-col gap-4">
          <Select
            label="Preferred payment method"
            value={payment.preferredPaymentMethod}
            onChange={(e) => setPayment((p) => ({ ...p, preferredPaymentMethod: e.target.value }))}
            options={[
              { value: 'WALLET', label: 'ParkShare wallet' },
              { value: 'SSLCZ_SANDBOX', label: 'Card / SSLCommerz' },
              { value: 'BKASH_SANDBOX', label: 'bKash' },
            ]}
          />

          {user.role === ROLES.HOST && (
            <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <Select
                label="Payout method"
                value={payment.payoutType}
                onChange={(e) => setPayment((p) => ({ ...p, payoutType: e.target.value }))}
                options={[
                  { value: '', label: 'Not set' },
                  { value: 'BKASH', label: 'bKash' },
                  { value: 'NAGAD', label: 'Nagad' },
                  { value: 'BANK', label: 'Bank account' },
                ]}
              />
              <Input
                label="Account number"
                value={payment.accountRef}
                onChange={(e) => setPayment((p) => ({ ...p, accountRef: e.target.value }))}
                placeholder={user.payoutChannel?.accountRef || '01XXXXXXXXX'}
                hint="Only the last 4 digits are stored"
              />
            </div>
          )}

          <Button onClick={savePayment} isLoading={busy === 'payment'} className="self-start">
            Save payment settings
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" subtitle="Choose how we reach you" />
        <CardBody className="flex flex-col gap-3">
          {[
            { key: 'push', label: 'Push notifications', hint: 'Booking updates and penalty warnings' },
            { key: 'sms', label: 'SMS', hint: 'Entry codes and two-factor sign-in' },
            { key: 'email', label: 'Email', hint: 'Invoices and receipts' },
          ].map((row) => (
            <label key={row.key} className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block text-body text-ink">{row.label}</span>
                <span className="block text-caption text-ink-muted">{row.hint}</span>
              </span>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-primary"
                checked={Boolean(prefs[row.key])}
                onChange={(e) => savePrefs({ ...prefs, [row.key]: e.target.checked })}
              />
            </label>
          ))}
        </CardBody>
      </Card>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileScreen />
    </ProtectedRoute>
  );
}
