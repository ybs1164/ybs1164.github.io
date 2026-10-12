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
