import { useEffect, useState } from "react";
import { getCloudDataClient } from "@/lib/providers/data-provider";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import type { GoldSettlementRecord } from "@/lib/supabase-services";
import { usePeople, type Person } from "@/lib/people-store";

function pickData<T>(row: Record<string, any> | null): T | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return row as T;
    }
  }
  return row as T;
}

async function fetchGoldSettlementById(id: string): Promise<GoldSettlementRecord | null> {
  const db = getCloudDataClient();
  const { data, error } = await (db as any)
    .from("gold_settlements")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Could not load gold settlement.");
  return pickData<GoldSettlementRecord>(data as Record<string, any> | null);
}

async function fetchPersonById(id: string | null | undefined): Promise<Person | null> {
  if (!id) return null;
  const db = getCloudDataClient();
  const { data, error } = await (db as any)
    .from("people")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return pickData<Person>(data as Record<string, any> | null);
}

export function useGoldSettlementRecord(id: string): {
  settlement: GoldSettlementRecord | null;
  party: Person | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const cachedSettlement = useGoldSettlement((state) =>
    state.settlements.find((row) => row.id === id),
  );
  const [settlement, setSettlement] = useState<GoldSettlementRecord | null>(null);
  const [party, setParty] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGoldSettlementById(id)
      .then(async (record) => {
        if (cancelled) return;
        setSettlement(record);
        if (record) {
          useGoldSettlement.setState((state) => ({
            settlements: state.settlements.some((row) => row.id === record.id)
              ? state.settlements.map((row) => (row.id === record.id ? record : row))
              : [record, ...state.settlements],
          }));
          const person = await fetchPersonById(record.party_id);
          if (cancelled) return;
          setParty(person);
          if (person) {
            usePeople.setState((state) => ({
              people: state.people.some((row) => row.id === person.id)
                ? state.people.map((row) => (row.id === person.id ? person : row))
                : [person, ...state.people],
            }));
          }
        } else {
          setParty(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSettlement(null);
        setParty(null);
        setError(err instanceof Error ? err.message : "Could not load gold settlement.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  return {
    settlement: cachedSettlement ?? settlement,
    party,
    loading,
    error,
    retry: () => setReloadKey((value) => value + 1),
  };
}
