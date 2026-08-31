-- Private buckets for the target project. Objects are authorized by the
-- tenant-scoped path policies in 20260730190000.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('customer-documents', 'customer-documents', false, 10485760, array['image/jpeg','image/png','application/pdf']::text[]),
  ('worker-kyc', 'worker-kyc', false, 10485760, array['image/jpeg','image/png','application/pdf']::text[]),
  ('supplier-documents', 'supplier-documents', false, 10485760, array['image/jpeg','image/png','application/pdf']::text[]),
  ('firm-assets', 'firm-assets', false, 5242880, array['image/jpeg','image/png','image/svg+xml']::text[]),
  ('catalog-designs', 'catalog-designs', false, 15728640, array['image/jpeg','image/png','image/webp']::text[]),
  ('order-attachments', 'order-attachments', false, 15728640, array['image/jpeg','image/png','application/pdf']::text[]),
  ('repair-attachments', 'repair-attachments', false, 15728640, array['image/jpeg','image/png','application/pdf']::text[]),
  ('expense-receipts', 'expense-receipts', false, 10485760, array['image/jpeg','image/png','application/pdf']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
commit;
