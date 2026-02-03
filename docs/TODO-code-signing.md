# TODO: Apple Code Signing

## What

macOS builds are currently unsigned. To distribute outside GitHub Releases (e.g. Homebrew cask, direct download) and avoid Gatekeeper warnings, the app needs to be signed and notarized with an Apple Developer certificate.

## Requirements

- Apple Developer Program membership ($99/year)
- Developer ID Application certificate
- App-specific password for notarization

## Steps

1. Enroll in Apple Developer Program
2. Create a Developer ID Application certificate in Xcode or Apple Developer portal
3. Export the certificate as a `.p12` file
4. Add GitHub secrets:
   - `APPLE_CERTIFICATE` — base64-encoded `.p12` file
   - `APPLE_CERTIFICATE_PASSWORD` — the `.p12` password
   - `APPLE_SIGNING_IDENTITY` — e.g. `Developer ID Application: Your Name (TEAMID)`
   - `APPLE_ID` — Apple ID email
   - `APPLE_PASSWORD` — app-specific password
   - `APPLE_TEAM_ID` — 10-character team ID
5. Update `publish.yml` to pass these env vars to `tauri-action`

## References

- https://tauri.app/distribute/sign/macos/
- https://developer.apple.com/developer-id/
