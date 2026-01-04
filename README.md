# Spotify Timestamp Share

Adds a Share menu item in the Spotify web player to copy a podcast episode link at the current playback time.

## Usage

1. Open a podcast episode on https://open.spotify.com.
2. Open the episode context menu, then open Share.
3. Click "Copy link to Episode at current time".

The copied URL includes a `?t=` query parameter (seconds).

## Build

Build a zip that works for both Chrome and Firefox stores:

```sh
./scripts/build.sh
```

The output zip is written to `dist/` and includes the manifest, content script,
and icon assets.

## Dev Setup

- Chrome: Load the folder as an unpacked extension.
- Firefox: Use `about:debugging#/runtime/this-firefox` to load a temporary
  add-on.

## Permissions

- Runs only on `https://open.spotify.com/*` to read playback state and inject the
  Share menu entry.
- No user data is collected or transmitted.

## Icons

Icons are generated from `assets/logo.svg` into `assets/icons/`.
