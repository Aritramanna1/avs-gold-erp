# Installation Guide

This guide details the installation process for the production-ready **AVS Gold ERP** (Version 1.1.0) on Windows environments.

## Desktop Installer Setup

1. **Download the Installer**:
   Obtain the latest production installer file (`AVS-Gold-ERP-Setup-1.1.0.exe`) from the repository releases page.

2. **Run the Executable**:
   Double-click the `.exe` setup file. Follow the installation wizard prompts to choose the installation location and create desktop shortcuts.

3. **Launch the Application**:
   Once setup is complete, launch AVS Gold ERP. On the first startup:
   - The application automatically initializes the local SQLite database.
   - If running in Online or Hybrid mode, it connects to the central cloud synchronization API.
   - Enter your issued **License Key** to unlock all features.

## Developer Setup

If you wish to run the project from source or compile the package manually, follow these steps:

### Prerequisites

- Node.js (v20 or higher recommended)
- npm (v10 or higher)

### Setup Instructions

1. Clone the repository and install all dependencies:

   ```bash
   npm install
   ```

2. Start the local Vite development server:

   ```bash
   npm run dev
   ```

3. Build the production assets:

   ```bash
   npm run build
   npm run build:electron
   ```

4. Package the desktop app into the installer executable:
   ```bash
   npx electron-builder --win
   ```
   The compiled installer will be output to the `release-build/` or `dist/` directory.
