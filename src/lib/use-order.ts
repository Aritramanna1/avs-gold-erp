import { useEffect, useState } from "react";
import { fetchOrderById } from "@/lib/orders-query";
import { useOrders, type Order } from "@/lib/orders-store";

export function useOrderById(id: string): {
  order: Order | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [order, setOrder] = useState<Order | null>(() => {
    return useOrders.getState().orders.find((row) => row.id === id || row.orderNo === id) ?? null;
  });
  const [loading, setLoading] = useState<boolean>(!order);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const existing = useOrders.getState().orders.find((row) => row.id === id || row.orderNo === id);
    if (existing) {
      setOrder(existing);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOrderById(id)
      .then((fetched) => {
        if (cancelled) return;
        setOrder(fetched);
        if (fetched) {
          useOrders.setState((state) => {
            const exists = state.orders.some((row) => row.id === fetched.id);
            if (exists) return state;
            return { orders: [fetched, ...state.orders] };
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setOrder(null);
        setError(err instanceof Error ? err.message : "Could not load order.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  return {
    order,
    loading,
    error,
    retry: () => setReloadKey((v) => v + 1),
  };
}

