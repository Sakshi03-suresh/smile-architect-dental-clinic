import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AvailabilityRule,
  ClinicSettings,
  Doctor,
  GalleryItem,
  Service,
  Testimonial,
} from '../types/clinic.ts';

export interface ClinicPayload {
  settings: ClinicSettings;
  doctors: Doctor[];
  services: Service[];
  availability: AvailabilityRule[];
  gallery: GalleryItem[];
  testimonials: Testimonial[];
}

interface ClinicContextValue {
  clinic: ClinicPayload | null;
  loading: boolean;
  error: string | null;
  refreshClinic: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextValue>({
  clinic: null,
  loading: true,
  error: null,
  refreshClinic: async () => {},
});

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [clinic, setClinic] = useState<ClinicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshClinic = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/clinic');
      if (!res.ok) throw new Error('Unable to load clinic details.');
      const data = (await res.json()) as ClinicPayload;
      setClinic(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading clinic details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshClinic();
  }, [refreshClinic]);

  return (
    <ClinicContext.Provider value={{ clinic, loading, error, refreshClinic }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  return useContext(ClinicContext);
}
