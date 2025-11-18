# Agent Configuration Repair Guide

## Problem
Your ElevenLabs agent configuration got corrupted with duplicate fields and invalid tool structures. The ElevenLabs website is showing errors like:
- Duplicate `max_tokens` fields
- Duplicate `tool_ids` fields  
- Duplicate `built_in_tools` fields
- Mixed null and config objects in tools
- Cannot save the agent due to validation errors

## Root Cause
The previous implementation of the Tools tab sent incorrect API payloads that created duplicate fields and corrupted the agent configuration in ElevenLabs' database.

## Solution: Emergency Repair Feature

I've added an **Emergency Repair** button to the Tools tab that will:

✅ Remove all duplicate fields
✅ Clear corrupted tool configurations
✅ Reset tools to a clean state
✅ Preserve your agent prompt and knowledge base
✅ Preserve your voice settings and other configurations

## How to Use the Repair Feature

### Step 1: Navigate to Tools Tab
1. Log into your account
2. Go to Conversational AI Studio
3. Open the agent that has errors
4. Click on the **Tools** tab

### Step 2: Click Repair Agent
1. You'll see a red warning box at the top with "Agent Configuration Issues?"
2. Click the **🔧 Repair Agent** button
3. A confirmation dialog will appear explaining what will happen
4. Click OK to proceed

### Step 3: Wait for Repair
- The repair process will take a few seconds
- You'll see "Repairing..." on the button
- When complete, you'll see "✅ Agent repaired successfully!"

### Step 4: Verify on ElevenLabs
1. Go to elevenlabs.io and log in
2. Open your agent
3. You should now be able to save without errors
4. The duplicate fields should be gone
5. Tools will be empty/clean

### Step 5: Add Tools Back
Now you can add your tools back one at a time:
1. Toggle on the tools you want (e.g., End Call, Detect Language)
2. Configure settings if needed
3. Click **💾 Save to ElevenLabs**
4. Verify on elevenlabs.io that the tools saved correctly

## What Gets Preserved
- ✅ Agent prompt/instructions
- ✅ Knowledge base documents
- ✅ Voice settings
- ✅ Language settings
- ✅ First message
- ✅ All other non-tool configurations

## What Gets Reset
- ❌ Tools (will be empty - you need to add them back)
- ❌ Tool configurations (you need to reconfigure them)

## Technical Details

The repair endpoint sends a clean configuration that:
1. Removes the corrupted `built_in_tools` object entirely
2. Sets `tools` array to empty `[]`
3. Sets `tool_ids` array to empty `[]`
4. Removes all duplicate fields
5. Sends only clean, valid data to ElevenLabs

**Backend Endpoint**: `POST /api/conversational-ai/agents/{agent_id}/repair`

## Troubleshooting

### If repair fails:
1. Check that your ElevenLabs API key is configured
2. Check that the agent is properly synced (has elevenlabs_agent_id)
3. Check the browser console for error messages
4. Check backend logs: `tail -f /var/log/supervisor/backend.err.log | grep REPAIR`

### If you still see errors on ElevenLabs:
1. Try refreshing the ElevenLabs page (hard refresh: Ctrl+Shift+R)
2. Try logging out and back in to ElevenLabs
3. Contact ElevenLabs support if the issue persists

## Prevention

The new simplified implementation should prevent this from happening again. The fix ensures:
- Only sends valid tool configurations
- Uses the correct 2025 ElevenLabs API structure
- No more duplicate fields
- No more null/undefined values mixed with configs

## Support

If you need help:
1. Check the browser console (F12) for error messages
2. Check backend logs for detailed error information
3. The repair button is safe to use multiple times if needed
