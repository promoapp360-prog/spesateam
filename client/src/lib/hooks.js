import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getSession } from './api.js';

export function useSession(area) {
  const [s, setS] = useState(() => getSession(area));
  useEffect(() => {
    const h = (e) => { if (!e.detail || e.detail.area === area) setS(getSession(area)); };
    window.addEventListener('st-session', h);
    return () => window.removeEventListener('st-session', h);
  }, [area]);
  return s;
}

/** Carica dati da un endpoint; con `interval` (ms) aggiorna periodicamente. */
export function useFetch(path, { interval = 0, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!!path && enabled);
  const alive = useRef(true);

  const reload = useCallback(async (silent = false) => {
    if (!path || !enabled) return;
    if (!silent) setLoading(true);
    try {
      const d = await api(path);
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => {
    alive.current = true;
    reload();
    let t;
    if (interval) t = setInterval(() => reload(true), interval);
    return () => { alive.current = false; if (t) clearInterval(t); };
  }, [reload, interval]);

  return { data, error, loading, reload, setData };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
