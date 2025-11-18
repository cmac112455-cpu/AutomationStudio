# Transfer Tools Status - Coming Soon

## Current Status

The **Transfer to Agent** and **Transfer to Number** tools have been temporarily disabled with "Coming Soon" badges while we resolve API integration issues with ElevenLabs.

## What Works ✅

All other system tools are fully functional:
- ✅ End Call
- ✅ Detect Language  
- ✅ Skip Turn
- ✅ Play Keypad Touch Tone
- ✅ Voicemail Detection

## What's Disabled 🚧

- 🚧 Transfer to Agent - Coming Soon
- 🚧 Transfer to Number - Coming Soon

## UI Changes

Both transfer tools now show:
- **"🚧 COMING SOON"** badge in top-right corner
- Grayed out/disabled appearance
- Settings button disabled
- Toggle switch disabled and unchecked
- Message: "⚠️ Feature under development"

## Technical Issue

The transfer tools require a complex nested structure for ElevenLabs API that has proven difficult to implement correctly:
- Simple tools use: `tool.system.params.system_tool_type`
- Transfer tools need: `tool.system.params.transfer_to_agent.transfers` (plus other fields)
- Multiple structure attempts failed validation
- ElevenLabs API documentation lacks clear examples for these tools

## Next Steps

1. Contact ElevenLabs support for official API examples
2. Review their TypeScript SDK for correct structure
3. Test with a working template agent that has transfers configured
4. Once working, re-enable the tools

## Files Modified

- `/app/frontend/src/pages/ConversationalAgentsPage.js` - Added "Coming Soon" badges and disabled the transfer tools
- `/app/backend/server.py` - Backend structure is in place but needs validation fix

## User Experience

Users can:
- See that transfer tools exist
- Know they're coming soon
- Use all other 5 system tools without issues
- Not encounter errors when trying to use disabled features

## Resolution Timeline

This feature will be completed once:
1. Correct API structure is confirmed with ElevenLabs
2. Backend implementation is validated
3. Frontend integration is tested
4. Both tools save successfully to ElevenLabs

The rest of the Tools tab is fully functional and production-ready.
