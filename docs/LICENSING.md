# Licensing Guide

AVS Gold ERP never creates license keys. Arivahly issues and manages every key in one central licensing system that is separate from every customer ERP database.

## Runtime architecture

The desktop calls the replaceable `LicensingProvider`, whose production implementation calls the embedded Arivahly Licensing API over HTTPS. The API—not the ERP—reads the Central Licensing Database. Customer Supabase projects are never queried for licensing, and no central database credential or signing private key is shipped in Electron.

The API response includes validity, edition, expiry, enabled features, maximum devices, customer status, and a device-bound Ed25519-signed entitlement. Electron verifies the signature with its embedded public key and stores the verified entitlement using OS-protected credential storage. Expired and Suspended states block operational access and show branded support UI. There is no payment flow in Version 1.

The build must set:

- `VITE_LICENSE_ENDPOINT` to the Arivahly-owned HTTPS validation endpoint;
- `VITE_LICENSE_ED25519_PUBLIC_KEY` to the base64url raw Ed25519 verification key.

Customers can enter only the license key. The API endpoint and public verification key are build-time configuration and never appear as editable Settings.

## Setup and offline validation

Offline setup still requires one online activation: Full Name, Email, Password, Confirm Password, and License Key are collected before the permanent Super Owner is created. A later Offline startup validates the cached signed entitlement without contacting customer Supabase. Hybrid setup validates the same central license before accepting customer project configuration.

Offline validity is bounded by the signed `offlineValidUntil` value (or the configured grace policy). Clock rollback, device mismatch, malformed cache, invalid signature, Expired, or Suspended status fails closed. Renewals and lifetime licenses are new signed entitlements; lifetime removes subscription expiry but retains device/status/signature controls.

## Licensing API contract

`POST` receives `licenseKey`, `deviceId`, and `deploymentMode`. A successful response contains `valid`, `edition`, `expiry`, `enabledFeatures`, `maximumDevices`, `customerStatus`, `entitlement`, `signature`, and an optional `message`. The canonical entitlement must include the same edition/device-limit fields plus status, device binding, issued-at, not-before, expiry, offline-valid-until, enabled features, and signing-key id.

Example display key: `AVS1-7K4P9-X2NQ8-M6TR3-C9WD2`. It is a random lookup token with a checksum, not a secret signing key or entitlement.

Never ship the Central Licensing Database URL, service-role key, private signing key, a universal bypass, or an offline license generator in the ERP.
