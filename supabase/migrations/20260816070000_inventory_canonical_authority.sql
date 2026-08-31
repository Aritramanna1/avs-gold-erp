-- Inventory table is the canonical ready-stock authority (application writes only to `inventory`).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ready_stock_items'
  ) THEN
    COMMENT ON TABLE public.ready_stock_items IS
      'DEPRECATED legacy table. Canonical ready stock authority is public.inventory.';
  END IF;
END $$;
