# Android APK Build

Keyword Memory mobile is a uni-app App-Plus project. The repository can build
the App-Plus resource bundle locally, and the final APK is produced with
HBuilderX cloud packaging or HBuilderX CLI.

## Current Strategy

Use uni-app App-Plus first:

- Lowest migration cost because `apps/mobile` is already a uni-app project.
- Android package config lives in `apps/mobile/src/manifest.json`.
- Local CLI build generates App resources under `apps/mobile/dist/build/app`.
- HBuilderX packages those resources into a signed Android APK.

Official references:

- [uni-app CLI notes](https://en.uniapp.dcloud.io/worktile/CLI.html)
- [Release native app with HBuilderX](https://en.uniapp.dcloud.io/quickstart-hx.html)
- [manifest.json Android packaging fields](https://uniapp.dcloud.net.cn/tutorial/app-manifest)

## Local Resource Build

Run from the repository root:

```bash
npm run build:mobile:app
```

Expected output:

```text
apps/mobile/dist/build/app
```

This directory is the App-Plus resource bundle. It is not an APK by itself.

Check APK packaging readiness:

```bash
npm run check:android-apk
```

## APK Packaging

### Option A: HBuilderX UI

1. Install HBuilderX App development edition.
2. Open or import `apps/mobile`.
3. Open `apps/mobile/src/manifest.json`.
4. Confirm the DCloud appid is `__UNI__8D8B24B`.
5. Confirm Android settings:
   - Package name: `com.ncubobo.keywordmemory`
   - Version name: `0.2.1`
   - Version code: `3`
   - Permission: `android.permission.INTERNET`
6. Choose `Release -> Native App - Cloud Packaging`.
7. Use Android cloud certificate packaging for new apps.
8. Build Android APK.

### Option B: HBuilderX CLI

Use this when HBuilderX is installed and logged in on the build machine. DCloud
documents that App cloud packaging requires HBuilderX CLI rather than the npm
`uni` CLI.

The repository-side preparation remains the same:

```bash
npm run build:mobile:app
```

Then run the HBuilderX CLI packaging command for Android from the HBuilderX
installation directory according to the current HBuilderX CLI documentation.

On macOS, this repository provides a helper:

```bash
npm run package:android-apk
```

The helper opens HBuilderX, imports `apps/mobile`, and starts Android cloud
packaging with DCloud cloud certificate mode.

## Release Signing

For public release, create and keep a private Android keystore. For early test
packages, this project uses DCloud cloud certificate mode because public test
certificates are no longer available for new apps.

Do not commit keystore files or signing passwords. If signing config is added
later, store secrets outside git and inject them in the local packaging step.

## Known Blockers Before Producing A Final APK

- DCloud requires the logged-in app owner account to bind a mobile phone number
  before cloud packaging.
- A formal private keystore is recommended before publishing to an app store.
