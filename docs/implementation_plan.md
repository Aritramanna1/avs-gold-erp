# Priority 8 - 15: Remaining Features Implementation Plan

You have requested the completion of the remaining tasks from the master list. Here is the implementation plan for auditing and fixing the remaining priorities.

## Proposed Changes

### Priority 8: Dynamic Forms

Currently, the settings page allows you to define Form Templates (`formsMetadata`) but there is no interface to actually **fill out** and **save** these forms against a customer or order.

- **Action**: Create a `DynamicFormRenderer` component that dynamically renders input fields based on the chosen template's metadata.
- **Integration**: Add a "Forms" tab to the `People` and `Orders` views, allowing users to select a template, fill out the form, and save it to a new `customForms` property on the respective record.

### Priority 9: Reference Notes

The current implementation of Reference Notes is fragmented (an optional string in some stores, and unfinished UI elsewhere).

- **Action**: Replace the scattered reference strings with a unified `ReferenceNotes` component. It will allow timestamped, user-attributed notes to be attached to `People`, `Orders`, and `Workshop` jobs.

### Priority 11: Communications

- **Action**: Audit the WhatsApp and Email provider implementations. Ensure the templates map correctly to the database variables (e.g., `{{customer_name}}`), and write defensive checks against undefined data to prevent runtime crashes when generating messages.

### Priority 12: Camera & Scanner Integration

- **Action**: Verify the Electron `navigator.mediaDevices` permission settings in the desktop build to ensure the webcams and hardware barcode scanners can correctly input data without being blocked by Chromium's strict security policies.

### Priority 13: MTJ Genuine Verification

- **Action**: Audit the receipt verification flow (the QR code scanner and verification page) to ensure it correctly cross-references the internal database for genuine MTJ-issued items.

### Priority 14 & 15: CEO Dashboard & Settings

- **Action**: Conduct a full sweep of the CEO Dashboard KPIs to ensure they accurately reflect real-time store data. Verify that every toggle in the Settings panel persists correctly across application reloads via local storage syncing.

---

> [!IMPORTANT]
>
> ## User Review Required
>
> Because **Dynamic Forms** and **Reference Notes** require UI real estate, I plan to inject them directly into the **Customer Profile** (`people.$id.tsx`) and **Order Details** (`orders.$id.tsx`) pages as new tabs. Does this placement align with the approved workflow?
>
> Please approve this plan so I can begin executing these final tasks!
