# Makeover by Nitu Sharma — Offline POS

This project packages the supplied salon POS interface for two offline native apps:

| Device | Shell | Local storage |
| --- | --- | --- |
| Mac | Electron | SQLite file in the app's private data folder |
| iPhone / iPad | Capacitor | SQLite via the Capacitor SQLite plugin |
| Browser development preview | Any modern browser | IndexedDB fallback |

The supplied salon logo is included locally as `web/assets/logo.png`, so the app has no external logo dependency.

## Features retained and strengthened

- POS billing, tax, discount, paid amount, and due amount
- service menu with custom-service creation and deletion
- customer auto-fill and manual customer creation
- sales history with reprint and WhatsApp sharing
- customer visits, spend, and dues calculated from invoices (rather than a mutable counter)
- CSV exports for services, customers, and sales
- 80 mm receipt print layout
- downloadable JSON backup and restore
- one-time import of the original `salon_services`, `salon_customers`, and `salon_sales` browser data when opening the browser version for the first time

## First setup

Install Node.js 20 or newer and Xcode (for iPhone/iPad). From this folder run:

```bash
npm install
```

`better-sqlite3` is a native dependency. If installation fails, install the current Xcode Command Line Tools and try again.

## Run the Mac app during development

```bash
npm start
```

Data is saved in a SQLite database named `makeover-pos.sqlite` inside Electron's private application-data folder. It is not stored beside the app and it is not shared automatically with the iPhone/iPad app.

Create a distributable Mac app:

```bash
npm run mac:package
```

The DMG and ZIP appear in `dist/`.

## Build for iPhone / iPad

The command below generates the native iOS Xcode project:

```bash
npm run ios:add
npm run ios:sync
npm run ios:open
```

In Xcode, choose your signing team, select an iPhone/iPad simulator or a connected device, then press Run. For App Store or TestFlight delivery, use Xcode's Archive workflow.

The Capacitor SQLite package requires the usual iOS native setup. After `ios:add`, run its documented native installation step if Capacitor reports that the SQLite plugin has not been registered; the JavaScript project is already written to use it through Capacitor at runtime.

## Important operating notes

- **Offline means per-device.** Mac and iPhone/iPad each have their own local database. Use Backup/Restore to move data manually. Automatic multi-device sync needs a separate encrypted cloud sync design and has intentionally not been added to this fully offline version.
- **WhatsApp needs WhatsApp and an internet connection to send.** The invoice is saved locally first. iPhone/iPad uses the system share sheet; Mac opens WhatsApp's web/app link.
- **Printing varies by printer.** Mac uses the native print dialog and works best with a printer driver configured for 80 mm paper. iPhone/iPad uses the iOS print sheet when available. Bluetooth thermal-printer integration is printer-model specific and is not included.
- **Keep backups safe.** The backup JSON contains customer contact and sales data. Store it in a protected location.

## Browser-specific problems fixed

The original single HTML file relied on `localStorage`, inline `onclick` handlers, template-string HTML insertion, `window.open`, and an externally hosted logo. This project replaces inline events with bound listeners, avoids injecting customer/service text with `innerHTML`, centralizes persistence behind an async store, provides a native-safe sharing route, and keeps every visual asset local.

## Project layout

```text
web/                 Shared HTML, CSS, JavaScript, and local assets
  db.js              SQLite/IndexedDB persistence abstraction
  app.js             POS logic and UI bindings
electron/            Mac-only secure shell and SQLite IPC bridge
capacitor.config.ts  iPhone/iPad wrapper configuration
```
