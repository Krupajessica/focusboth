"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { demoData } from "@/lib/demo-data";
import type { CompassData, Job, VisaProfile } from "@/lib/types";

function normalizeJob(job: Job): Job {
  return {
    ...job,
    workType: job.workType ?? "Full-time",
    applyUrl: job.applyUrl ?? "",
    openingsUrl: job.openingsUrl ?? "",
  };
}

function normalizeData(value: CompassData): CompassData {
  return {
    ...value,
    jobs: value.jobs.map(normalizeJob),
  };
}

type StoreValue = {
  data: CompassData;
  hydrated: boolean;
  updateProfile: (profile: VisaProfile) => void;
  addJob: (job: Job) => void;
  updateJob: (job: Job) => void;
  removeJob: (id: string) => void;
  resetDemo: () => void;
};

const STORAGE_KEY = "focusboth-data-v2"; // v2: demo uses real employers + DOL scores
const StoreContext = createContext<StoreValue | null>(null);

export function CompassStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CompassData>(demoData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let restored: CompassData | null = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) restored = normalizeData(JSON.parse(saved) as CompassData);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      if (restored) setData(restored);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      hydrated,
      updateProfile: (profile) => setData((current) => ({ ...current, profile })),
      addJob: (job) => setData((current) => ({ ...current, jobs: [normalizeJob(job), ...current.jobs] })),
      updateJob: (job) =>
        setData((current) => ({
          ...current,
          jobs: current.jobs.map((item) => (item.id === job.id ? normalizeJob(job) : item)),
        })),
      removeJob: (id) =>
        setData((current) => ({ ...current, jobs: current.jobs.filter((job) => job.id !== id) })),
      resetDemo: () => setData(structuredClone(demoData)),
    }),
    [data, hydrated],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCompassStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useCompassStore must be used inside CompassStoreProvider");
  return value;
}
