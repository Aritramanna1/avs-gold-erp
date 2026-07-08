-- Migration: Setup all storage buckets and RLS policies on storage.objects
-- Created at 2026-06-25

-- Create all private buckets with size limits + allowed types
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('firm-assets',        'firm-assets',        false,  5242880, array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']),
  ('customer-documents', 'customer-documents', false, 10485760, array['image/png','image/jpeg','image/jpg','image/webp','application/pdf']),
  ('worker-kyc',         'worker-kyc',         false, 10485760, array['image/png','image/jpeg','image/jpg','image/webp','application/pdf']),
  ('order-attachments',  'order-attachments',  false, 10485760, array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','application/pdf']),
  ('repair-attachments', 'repair-attachments', false, 10485760, array['image/png','image/jpeg','image/jpg','image/webp']),
  ('expense-receipts',   'expense-receipts',   false, 10485760, array['image/png','image/jpeg','image/jpg','image/webp','application/pdf']),
  ('catalog-designs',    'catalog-designs',    false, 10485760, array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','application/pdf'])
on conflict (id) do nothing;

-- Ensure RLS is enabled on the objects table
alter table storage.objects enable row level security;

-- Replace any old policies (re-runnable)
drop policy if exists "app_files_select" on storage.objects;
drop policy if exists "app_files_insert" on storage.objects;
drop policy if exists "app_files_update" on storage.objects;
drop policy if exists "app_files_delete" on storage.objects;

-- Allow authenticated users to read/upload/update/delete in these buckets.
-- NOTE: INSERT uses WITH CHECK, SELECT/DELETE use USING, UPDATE uses both.
create policy "app_files_select" on storage.objects
  for select to authenticated
  using (bucket_id in ('firm-assets','customer-documents','worker-kyc','order-attachments','repair-attachments','expense-receipts','catalog-designs'));

create policy "app_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('firm-assets','customer-documents','worker-kyc','order-attachments','repair-attachments','expense-receipts','catalog-designs'));

create policy "app_files_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('firm-assets','customer-documents','worker-kyc','order-attachments','repair-attachments','expense-receipts','catalog-designs'))
  with check (bucket_id in ('firm-assets','customer-documents','worker-kyc','order-attachments','repair-attachments','expense-receipts','catalog-designs'));

create policy "app_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('firm-assets','customer-documents','worker-kyc','order-attachments','repair-attachments','expense-receipts','catalog-designs'));
