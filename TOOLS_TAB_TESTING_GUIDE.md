# Tools Tab Fix - Testing Guide

## What Was Fixed

### Backend Changes
1. **GET /api/conversational-ai/agents/{agent_id}/tools** - Now correctly reads from `conversation_config.agent.prompt.built_in_tools`
2. **PATCH /api/conversational-ai/agents/{agent_id}/tools** - Now correctly writes to `conversation_config.agent.prompt.built_in_tools` and `tool_ids`
3. **NEW: GET /api/conversational-ai/workspace-tools** - Fetches workspace server and client tools
4. Added detailed logging with `[TOOLS]` prefix for debugging

### Frontend Changes
1. Removed duplicate Tools tab code (there were TWO implementations!)
2. Kept the correct implementation that uses string arrays: `["end_call"]`
3. Updated `loadAgentTools()` to use `built_in_tools` field
4. Fixed `updateAgentTools()` to send correct payload structure

### The Root Cause
- Tools were being read/written from wrong location in ElevenLabs API
- **OLD (Wrong)**: `agent_config.system_tools`
- **NEW (Correct)**: `conversation_config.agent.prompt.built_in_tools`

## How to Test

### Prerequisites
1. You must be logged into your account
2. You must have an ElevenLabs API key configured (go to Integrations page)
3. You must have synced agents from ElevenLabs (use "Sync from ElevenLabs" button)

### Step-by-Step Testing

#### Step 1: Verify Backend is Running
```bash
curl http://localhost:8001/health
# Should return: {"status":"healthy"}
```

#### Step 2: Open the App
1. Navigate to: http://localhost:3000/conversational-ai
2. Log in with your credentials
3. You should see your conversational agents list

#### Step 3: Check ElevenLabs Integration
1. Click on sidebar menu
2. Go to "Integrations"
3. Verify your ElevenLabs API key is saved
4. If not, add it and save

#### Step 4: Sync Agents from ElevenLabs
1. Go back to Conversational AI page
2. Click "Sync from ElevenLabs" button
3. Your agents should appear in the list
4. **Important**: Only synced agents (with `elevenlabs_agent_id`) will have Tools tab functionality

#### Step 5: Open Tools Tab
1. Click "Edit" on any synced agent
2. Click the "🔧 Tools" tab
3. You should see:
   - **System Tools** section with "End Call" toggle
   - **Server Tools (Webhooks)** section

#### Step 6: Test End Call Toggle
1. Toggle "End Call" ON
2. Check browser console (F12) - you should see: `🔧 Tools loaded:`
3. Toggle should turn cyan/blue when ON
4. **Critical Test**: Close the modal and reopen it
5. The "End Call" toggle should STILL be ON (this was the main bug!)

#### Step 7: Verify with Backend Logs
```bash
# Watch backend logs in real-time
tail -f /var/log/supervisor/backend.err.log | grep TOOLS

# You should see lines like:
# [TOOLS] ============ AGENT STRUCTURE DEBUG ============
# [TOOLS] ✅ Loaded tools for agent ...
# [TOOLS] Built-in tools: ['end_call']
# [TOOLS] ============ UPDATE PAYLOAD DEBUG ============
# [TOOLS] ✅ Successfully updated tools for agent ...
```

### Expected Behavior

#### ✅ Working Correctly
- Tools tab is visible for synced agents
- End Call toggle can be turned ON/OFF
- Toggle state persists after closing and reopening modal
- Toggle state persists after page refresh
- No errors in browser console
- Backend logs show `[TOOLS]` entries with correct data structure

#### ❌ Not Working (Report These)
- Tools tab shows "Coming Soon" placeholder
- Toggle doesn't persist after modal close/reopen
- Toggle doesn't persist after page refresh
- Errors in browser console
- Backend returns 404 or 500 errors

## Troubleshooting

### Issue: "Tools Not Available" Message
**Cause**: Agent is not synced with ElevenLabs
**Solution**: 
1. Use "Sync from ElevenLabs" button on main page
2. Make sure agent has `elevenlabs_agent_id` field

### Issue: "ElevenLabs API key not configured"
**Cause**: No API key in user integrations
**Solution**: 
1. Go to Integrations page
2. Add your ElevenLabs API key
3. Save and try again

### Issue: Toggle doesn't persist
**Cause**: API call failing or wrong structure
**Solution**: 
1. Check browser console for errors
2. Check backend logs: `tail -f /var/log/supervisor/backend.err.log | grep TOOLS`
3. Verify ElevenLabs API key is valid

### Issue: 404 or 500 errors
**Cause**: Backend endpoints not properly registered
**Solution**: 
1. Restart backend: `sudo supervisorctl restart backend`
2. Check for Python syntax errors in server.py
3. Verify backend is running: `sudo supervisorctl status backend`

## API Endpoint Details

### GET /api/conversational-ai/agents/{agent_id}/tools
**Returns:**
```json
{
  "built_in_tools": ["end_call"],
  "tool_ids": []
}
```

### PATCH /api/conversational-ai/agents/{agent_id}/tools
**Expects:**
```json
{
  "built_in_tools": ["end_call"],
  "tool_ids": []
}
```

**Returns:**
```json
{
  "message": "Tools updated successfully",
  "built_in_tools": ["end_call"],
  "tool_ids": []
}
```

### GET /api/conversational-ai/workspace-tools
**Returns:**
```json
{
  "server_tools": [],
  "client_tools": []
}
```

## Summary

The Tools tab now correctly:
1. ✅ Reads tools from `conversation_config.agent.prompt.built_in_tools`
2. ✅ Writes tools to `conversation_config.agent.prompt.built_in_tools`
3. ✅ Persists tool configuration after save
4. ✅ Integrates with ElevenLabs API using your account's API key
5. ✅ Shows proper UI for system tools with toggle switches

The main bug (tools disappearing after save) is **FIXED**.
