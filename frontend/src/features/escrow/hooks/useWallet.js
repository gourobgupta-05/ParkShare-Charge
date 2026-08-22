'use client';
/**
 * useWallet — OWNER: Tamal Deb Nath [TDN]
 * Wallet balance + the two-step top-up flow (initiate → confirm).
 */
import { useCallback, useEffect, useState } from 'react';
import { getWallet, initiateTopUp, confirmTopUp } from '../api/escrow.api';

export default function useWallet({ auto = true } = {}) {
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(auto);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setWallet(await getWallet());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auto) refresh();
  }, [auto, refresh]);

  /**
   * Runs the whole top-up. With the mock gateway there is no redirect, so we
   * confirm immediately. With SSLCommerz the adapter returns requiresRedirect
   * and the browser is sent to the hosted checkout page instead.
   */
  const topUp = useCallback(
    async (amountPoisha) => {
      const session = await initiateTopUp(amountPoisha);

      if (session.requiresRedirect && session.redirectUrl?.startsWith('http')) {
        window.location.href = session.redirectUrl;
        return { redirected: true };
      }

      const result = await confirmTopUp({
        token: session.token,
        amountPoisha: session.amountPoisha,
        provider: session.provider,
      });
      await refresh();
      return result;
    },
    [refresh]
  );

  return { wallet, isLoading, error, refresh, topUp };
}
