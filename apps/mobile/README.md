# RateCoaster for Android

This is the native Expo/React Native app—not a website embedded in a WebView.
It has native navigation and screens for trip totals and flights, live waits
and attraction history, hotel rates, tickets, Express Pass, crowd planning,
guides, and account watches. It shares the API schemas and typed client with
the website, so a server response change is checked in both clients at once.

Attraction details use a native map. Foreground location is requested only
after the visitor taps **Start walking directions**; RateCoaster does not store
that location. The current walking handoff opens Google Maps with the user's
origin and the selected attraction. Precise attraction coordinates can later
drive an entirely in-app route without replacing the screen or permission flow.

## Run it locally

```bash
npm install
npm run android
```

The checked-in API target is `https://ratecoaster.net/api`. For an Android
emulator talking to the local API, run:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787 npm run android
```

Use a LAN-reachable HTTPS staging API for a physical phone; `localhost` on the
phone is the phone, not this computer.

## Build an installable Android package

```bash
npx eas build --platform android --profile preview
```

Use the `production` profile for the Play Store build. EAS will guide the first
signing-key setup.

## Finish the production sign-in setup

The app uses a verified Android App Link at
`https://ratecoaster.net/app/auth`. After creating the production signing key,
serve this file from the website's public root:

`https://ratecoaster.net/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "net.ratecoaster.app",
      "sha256_cert_fingerprints": ["YOUR_PLAY_OR_EAS_SIGNING_SHA256"]
    }
  }
]
```

Get the certificate fingerprint from EAS or Play Console, substitute it once,
then deploy the file with `application/json`. Keep
`MOBILE_AUTH_REDIRECT_URI=https://ratecoaster.net/app/auth` in the API
environment. Until domain verification is live, email sign-in cannot safely
hand off to a release build; all public browsing still works.
