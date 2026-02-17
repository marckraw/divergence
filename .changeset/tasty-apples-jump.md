"divergence": patch
---

Restore Claude usage visibility in the Usage Limits popover when Claude credentials are provided via the long-lived `claude setup-token` flow.

The app now forwards the saved Claude OAuth token to usage status/fetch commands, and the Tauri backend accepts that token (plus `CLAUDE_CODE_OAUTH_TOKEN`) as a valid credential source before falling back to legacy Keychain/file discovery.

Terminal splitting now supports up to three panes per session. `Cmd+D` adds panes up to the three-pane cap, and `Cmd+W` closes the currently focused split pane before closing the full tab when only one pane remains.
