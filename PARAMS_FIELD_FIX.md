# Fix: "Field required" Error for Tools Params

## The Error You Saw

```
Failed to save: ElevenLabs API error: 
{
  'status': 'input_invalid',
  'message': '[{"type":"missing","loc":["agent","prompt","tools",4,"system","params"],"msg":"Field required",...}]'
}
```

This error appeared when saving tools, especially **Transfer to Agent** and **Transfer to Number**.

## Root Cause

ElevenLabs **requires** a `params` field in every system tool configuration. My initial simplified implementation removed this field to make it "simpler", but ElevenLabs validation rejected it.

**What was being sent (WRONG):**
```json
{
  "type": "system",
  "name": "transfer_to_agent",
  "description": "Transfer to agent when the customer is ready to buy"
  // ❌ Missing params field!
}
```

**What ElevenLabs expects (CORRECT):**
```json
{
  "type": "system",
  "name": "transfer_to_agent",
  "description": "Transfer to agent when the customer is ready to buy",
  "params": {                                    // ✅ Required field!
    "system_tool_type": "transfer_to_agent",
    "transfer_to_agent": {
      "transfers": []                            // ✅ Transfer-specific config
    }
  }
}
```

## The Fix

I've updated the PATCH tools endpoint to include the required `params` field for all tools:

### For All Tools:
```json
"params": {
  "system_tool_type": "<tool_name>"
}
```

### For Transfer to Agent:
```json
"params": {
  "system_tool_type": "transfer_to_agent",
  "transfer_to_agent": {
    "transfers": [...]
  }
}
```

### For Transfer to Number:
```json
"params": {
  "system_tool_type": "transfer_to_number",
  "transfer_to_number": {
    "transfers": [...]
  }
}
```

### For Voicemail Detection:
```json
"params": {
  "system_tool_type": "voicemail_detection",
  "voicemail_message": "..."
}
```

## How to Test

1. **Refresh your browser** (Ctrl+Shift+R)
2. **Go to the Tools tab** of your agent
3. **Enable "Transfer to Agent"** tool
4. **Add a description** (optional)
5. **Click "💾 Save to ElevenLabs"**
6. **Should save successfully** without the "Field required" error!

## What Changed in the Code

**Location:** `/app/backend/server.py` - PATCH tools endpoint

**Before:**
```python
tool_obj = {
    "type": "system",
    "name": backend_name,
    "description": custom_config.get("description", "")
}
```

**After:**
```python
tool_obj = {
    "type": "system",
    "name": backend_name,
    "description": custom_config.get("description", ""),
    "params": {
        "system_tool_type": backend_name
    }
}

# Add tool-specific params
if backend_name == "transfer_to_agent":
    tool_obj["params"]["transfer_to_agent"] = {
        "transfers": [...]
    }
# etc.
```

## Testing Checklist

Try saving these tools one at a time:

- [ ] ✅ End Call - Should work
- [ ] ✅ Detect Language - Should work
- [ ] ✅ Skip Turn - Should work
- [ ] ✅ Transfer to Agent - **Should now work** (was failing before)
- [ ] ✅ Transfer to Number - **Should now work** (was failing before)
- [ ] ✅ Play Keypad Touch Tone - Should work
- [ ] ✅ Voicemail Detection - Should work

## Expected Behavior Now

1. **Enable any tool** (including transfer tools)
2. **Add description** if you want
3. **Click Save**
4. **See success message**: "✅ Tools saved successfully!"
5. **Check ElevenLabs website** - tools should be saved
6. **No more "Field required" errors!**

## Technical Notes

The `params` field structure:
- **Always required**: `system_tool_type` key with the tool name
- **Transfer tools**: Need nested `transfer_to_agent` or `transfer_to_number` object with `transfers` array
- **Voicemail**: Needs `voicemail_message` string
- **Other tools**: Just need the `system_tool_type`

This matches the ElevenLabs API v1 specification for system tools as of 2025.
