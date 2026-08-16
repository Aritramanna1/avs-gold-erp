# User Guide

This guide describes the current Supabase-backed Ornexa workflow. All business records and operational data are managed through the approved cloud ERP, not through a local-first or hybrid database runtime.

## Getting started

1. Sign in through the approved Supabase-authenticated tenant flow.
2. Validate the active firm, branch, and role assignment.
3. Configure business settings, branch policies, print profile, communication defaults, and operational preferences from the authorized Settings and Customization workspaces.
4. Use the standard ERP workflows for people, catalog, orders, manufacturing, stock, billing, reporting, and portal access.

## Licensing and access

- License validation follows the approved licensing flow for the tenant and entitled devices.
- Local development and local test hosts may bypass certain development-only checks, but the production tenant path remains authenticated and network-backed.
- Access is governed by role, branch scope, and Supabase RLS rules.

## Manufacturing workflow

1. Create or review customer orders.
2. Issue raw material and create job cards as needed.
3. Record manufacturing progress through the approved workshop and ledger flows.
4. Verify finishing, stock movement, settlement, and final billing through the canonical ERP journals and reporting layers.

## Billing and GST

Use the standard billing engine for invoices, payments, and settlement flows. GST and accounting calculations remain authoritative in the approved ERP logic and must not be bypassed by local or disconnected data paths.

## Reporting and audit

Reports, ledgers, and audit evidence are generated from the live Supabase-backed record set. The ERP must always reflect the authorized tenant state, not a stale browser cache or local database copy.
