# Tools Object Structure Fix ✅

## Problem Identified

**Error:** `Request failed with status code 400`
```json
{
  "detail": {
    "status": "input_invalid",
    "message": "Input should be a valid dictionary or instance of BuiltInTools",
    "input": ["end_call"]
  }
}
```

**Root Cause:** ElevenLabs API expects `built_in_tools` as an **OBJECT/DICTIONARY**, not an array.

## ElevenLabs API Structure

### What We Were Sending (WRONG) ❌
```json
{
  "built_in_tools": ["end_call", "detect_language"]
}
```

### What ElevenLabs Expects (CORRECT) ✅
```json
{
  "built_in_tools": {
    "end_call": {
      "type": "system",
      "name": "end_call",
      "description": "",
      "response_timeout_secs": 20,
      "disable_interruptions": false,
      "force_pre_tool_speech": false,
      "assignments": [],
      "tool_call_sound": null,
      "tool_call_sound_behavior": "auto",
      "params": {
        "system_tool_type": "end_call"
      }
    },
    "language_detection": {
      "type": "system",
      "name": "language_detection",
      "description": "",
      "response_timeout_secs": 20,
      "disable_interruptions": false,
      "force_pre_tool_speech": false,
      "assignments": [],
      "tool_call_sound": null,
      "tool_call_sound_behavior": "auto",
      "params": {
        "system_tool_type": "language_detection"
      }
    },
    "transfer_to_agent": null,
    "transfer_to_number": null,
    "skip_turn": null,
    "play_keypad_touch_tone": null,
    "voicemail_detection": null
  }
}
```

**Key Points:**
- Enabled tools have a configuration object
- Disabled tools are set to `null`
- ALL tools must be present in the object

## Backend Name Mapping

Frontend and backend use different names for some tools:

| Frontend Name | Backend/API Name | Description |
|--------------|------------------|-------------|
| `end_call` | `end_call` | Same |
| `detect_language` | `language_detection` | **Different** |
| `transfer_to_agent` | `transfer_to_agent` | Same |
| `transfer_to_number` | `transfer_to_number` | Same |
| `skip_turn` | `skip_turn` | Same |
| `keypad` | `play_keypad_touch_tone` | **Different** |
| `voicemail` | `voicemail_detection` | **Different** |

## Solution Implemented

### Backend Changes (server.py)

#### GET /tools Endpoint
1. **Read** built_in_tools object from ElevenLabs
2. **Convert** object to array of enabled tool names
3. **Map** backend names to frontend names
4. **Return** array to frontend: `["end_call", "detect_language"]`

```python
# Extract enabled tools from object
enabled_tools = []
for tool_name, tool_config in built_in_tools_obj.items():
    if tool_config is not None:
        frontend_name = backend_to_frontend.get(tool_name, tool_name)
        enabled_tools.append(frontend_name)
```

#### PATCH /tools Endpoint
1. **Receive** array from frontend: `["end_call", "detect_language"]`
2. **Map** frontend names to backend names
3. **Build** complete object with ALL tools
4. **Enable** tools by adding config, disable by setting `null`
5. **Send** object to ElevenLabs
6. **Convert** response back to array for frontend

```python
# Build object structure
new_built_in_tools = {}
for tool_key in all_tool_keys:
    if should_enable:
        # Add config object
        new_built_in_tools[tool_key] = {
            "type": "system",
            "name": tool_key,
            # ... full config
        }
    else:
        # Disable by setting to None
        new_built_in_tools[tool_key] = None
```

### Data Flow

```
┌──────────────┐
│   Frontend   │
│              │
│ Toggle ON:   │
│ "end_call"   │
└──────┬───────┘
       │ PATCH with array: ["end_call"]
       ▼
┌──────────────┐
│   Backend    │
│              │
│ Convert:     │
│ Array → Obj  │
│              │
│ Map names:   │
│ end_call     │
│ → end_call   │
└──────┬───────┘
       │ PATCH with object
       ▼
┌──────────────┐
│  ElevenLabs  │
│    API       │
│              │
│ Save object: │
│ {            │
│   end_call:  │
│   {...},     │
│   others:    │
│   null       │
│ }            │
└──────┬───────┘
       │ Return updated object
       ▼
┌──────────────┐
│   Backend    │
│              │
│ Convert:     │
│ Obj → Array  │
└──────┬───────┘
       │ Return array: ["end_call"]
       ▼
┌──────────────┐
│   Frontend   │
│              │
│ Update UI:   │
│ Toggle ON ✓  │
└──────────────┘
```

## Default Tool Configuration

When enabling a tool, we use this default config:

```python
{
    "type": "system",
    "name": tool_key,
    "description": "",
    "response_timeout_secs": 20,
    "disable_interruptions": False,
    "force_pre_tool_speech": False,
    "assignments": [],
    "tool_call_sound": None,
    "tool_call_sound_behavior": "auto",
    "params": {"system_tool_type": tool_key}
}
```

**Special case for voicemail:**
```python
if tool_key == "voicemail_detection":
    config["params"]["voicemail_message"] = ""
```

## Testing

### Success Indicators

**Backend Logs:**
```
[TOOLS] Received tools to enable from frontend: ['end_call', 'detect_language']
[TOOLS] Built ElevenLabs object structure with 2 enabled tools
[TOOLS] ✅ Successfully updated tools for agent abc123
[TOOLS] Returning enabled tools to frontend: ['end_call', 'detect_language']
```

**Frontend:**
- No 400 errors
- Toggle switches work
- Tools persist after reload
- Toast shows "✅ Tools updated in ElevenLabs!"

### How to Test

1. Open Tools tab
2. Toggle any tool ON (e.g., "End Conversation")
3. Check browser console - no errors
4. Check backend logs - should see conversion messages
5. Close and reopen modal
6. Tool should stay ON ✅

## Summary

✅ **Problem:** ElevenLabs expects object, we sent array
✅ **Solution:** Backend converts array ↔ object
✅ **Mapping:** Frontend names ↔ Backend names
✅ **Structure:** All tools in object, enabled with config, disabled with null
✅ **Persistence:** Tools now save correctly to ElevenLabs

The Tools tab now communicates correctly with ElevenLabs API!
