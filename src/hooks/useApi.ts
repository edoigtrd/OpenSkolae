import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthError } from '../api/client';

export function useApi<T>(
  fetcher: (token: string) => Promise<T>,
  deps: any[] = []
) {
  const { token, signOut } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher(token);
      setData(result);
    } catch (e: any) {
      if (e instanceof AuthError) {
        await signOut();
      } else {
        setError(e.message || 'Une erreur est survenue');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refresh: load };
}
