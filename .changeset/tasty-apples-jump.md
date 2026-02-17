"divergence": patch
---

Restore Claude usage visibility in the Usage Limits popover when Claude credentials are provided via the long-lived `claude setup-token` flow.

The app now forwards the saved Claude OAuth token to usage status/fetch commands, and the Tauri backend accepts that token (plus `CLAUDE_CODE_OAUTH_TOKEN`) as a valid credential source before falling back to legacy Keychain/file discovery.
