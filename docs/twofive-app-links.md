# Shared-run link landing (GitHub Pages)

Link format: `https://ybs1164.github.io/25/?c=<character id>&m=<mode>&s=<seed>`

App Links need `/.well-known/assetlinks.json` at the **domain root**, so this
folder must be published from the user-site repo `ybs1164/ybs1164.github.io`
(not the `twoFive` project site, which would live under `/twoFive/`).

1. (Done) The repo `ybs1164.github.io` already exists with Pages enabled.
2. (Done) Files live at the repo root: `25/`, `.well-known/`, `.nojekyll`.
3. Fill the fingerprints in `.well-known/assetlinks.json`:
   - Upload key:
     `keytool -list -v -keystore twofive-keystore.jks` -> "SHA256:" line
   - Play App Signing key: Play Console -> Test and release -> App signing ->
     "App signing key certificate" SHA-256.
   Keep the `AA:BB:..` colon format.
4. Check `https://ybs1164.github.io/.well-known/assetlinks.json` serves the JSON
   (no redirect), then after installing a build:
   `adb shell pm get-app-links com.numberer.twofive` should say `verified`.

`25/index.html` runs only when the app didn't intercept the link (app missing,
or an in-app browser such as KakaoTalk): it tries `intent://` and falls back to
the Play Store.

Host/path are also in `addons/DeepLink/deep_link_plugin.gd` and
`Scripts/deep_link_manager.gd` - keep all three in sync.

## Link preview / landing design

- `25/index.html` carries the OG/Twitter tags; the preview image is
  `assets/25/og.png` (1200x630), rendered from `scripts/og-25.html`:
  `msedge --headless --screenshot=assets/25/og.png --window-size=1200,630 file:///<repo>/scripts/og-25.html`
- Previews are static: every shared link shows the same image.
- Messengers cache previews. After changing `og.png`, refresh them with the
  Kakao link debugger / Facebook Sharing Debugger.

- Font: Galmuri11 (SIL OFL) Latin subset at assets/25/fonts/Galmuri11-latin.woff. Keep sizes at multiples of 11px to stay crisp. Re-subset with: python -m fontTools.subset Galmuri11.ttf --unicodes=U+0020-007E,U+00B7,U+00D7,U+2013,U+2014,U+2019 --flavor=woff --output-file=...
