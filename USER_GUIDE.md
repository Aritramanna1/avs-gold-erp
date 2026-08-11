# User Guide

This guide provides basic operation workflows for AVS Gold ERP.

## Table of Contents

- [Setup Wizard](#setup-wizard)
- [Licensing](#licensing)
- [Local First & Hybrid Deployment](#local-first--hybrid-deployment)
- [User Management](#user-management)
- [Manufacturing Workflow](#manufacturing-workflow)
- [Billing & GST Calculations](#billing--gst-calculations)

## Setup Wizard

Upon first launching the ERP, you are presented with the Setup Wizard. This allows you to configure your business firm name, selected branches, and regional compliance settings (like HSN and Hallmark License Numbers).

## Licensing

You must enter a valid license key (format: `AVS1-XXXXX-XXXXX-XXXXX-XXXXX`) to activate the application.

- Local development hosts (`localhost`, `127.0.0.1`) bypass the validation automatically to prevent lockouts during development.
- Staging/Production environments connect to the Central Licensing server to validate seats and features.

## Local First & Hybrid Deployment

AVS Gold ERP runs with an offline-first architecture. All records are primary-written to a local SQLite database, allowing the application to work seamlessly without network connectivity. When internet access is restored in Hybrid mode, the local outbox automatically synchronizes changes back to Supabase.

## User Management

Only Super Owners and Administrators have permission to invite new users, manage roles, and review session security logs.

## Manufacturing Workflow

1. **Orders**: Create a new customer order with target weight and purity.
2. **Job Cards**: Issue raw gold to a designated Karigar to initiate a job.
3. **Receipt**: Receive finished ornaments and scrap from the Karigar, calculating wastage and fine weight.
4. **Stock**: Finished goods are tagged and automatically moved to retail stock.

## Billing & GST Calculations

In the billing section, you can issue sales invoices against retail stock. GST is calculated with exact rounding to avoid cgst+sgst drift:

- CGST + SGST: Split mode rounds the grand total once and splits it, guaranteeing both halves sum up exactly.
- IGST: Single pool tax calculations are applied cleanly in inter-state invoicing.
- TCS (Tax Collected at Source) is automatically applied when transaction values surpass configured limits.
