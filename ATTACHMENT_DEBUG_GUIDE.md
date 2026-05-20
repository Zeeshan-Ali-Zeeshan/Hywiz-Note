# Attachment Upload Debug Guide

## Debug Logs Added

I've added **comprehensive debug logging** to trace the entire attachment upload flow from client to server. This will help identify exactly where the upload process is failing.

## Debug Log Locations

### 1. Frontend - EditorToolbar (Client)
**File**: `src/components/editor/EditorToolbar.tsx`
**Logs**: 
```
═══════════════════════════════════════════════════════
[IMAGE UPLOAD DEBUG] ...
═══════════════════════════════════════════════════════
```

**What it logs**:
- When handleImageUpload is triggered
- Selected file details (name, type, size)
- Whether noteId exists
- Upload attempt status
- Success/failure details
- Error information

### 2. Frontend - Notes Store (Client)
**File**: `src/stores/useNotesStore.ts`
**Logs**:
```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
[STORE UPLOAD DEBUG] ...
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

**What it logs**:
- Step 1: FormData preparation
- Step 2: POST /api/upload call
- Step 3: POST /api/notes/:id/attachments call
- Step 4: Local state update
- Success/failure at each step
- Response data from server
- Detailed error information

### 3. Server - Upload Route
**File**: `server/routes/upload.js`
**Logs**:
```
████████████████████████████████████████████████████████
[SERVER UPLOAD DEBUG] ...
████████████████████████████████████████████████████████
```

**What it logs**:
- Request received with user details
- File object details
- File type validation
- Generated filename
- Upload directory path
- Directory existence check
- File move operation
- File verification
- Success/failure status

### 4. Server - Notes Attachments Route
**File**: `server/routes/notes.js`
**Logs**:
```
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
[SERVER ATTACHMENT DEBUG] ...
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

**What it logs**:
- Request details (noteId, userId)
- Note lookup status
- Attachment validation
- Adding attachment to note
- File record creation
- File existence verification on disk
- Success/failure status

## How to Use These Debug Logs

### Step 1: Restart Your Server
```bash
cd server
node index.js
```

### Step 2: Open Browser DevTools
1. Open your browser (F12)
2. Go to the **Console** tab
3. Clear the console (optional)

### Step 3: Upload an Image
1. Navigate to a note in the editor
2. Click **Insert** → **Insert Image**
3. Select an image file
4. Watch the console

### Step 4: Check Both Consoles

**Browser Console** will show:
```
═══════════════════════════════════════════════════════
[IMAGE UPLOAD DEBUG] handleImageUpload triggered
[IMAGE UPLOAD DEBUG] Selected file: {...}
[IMAGE UPLOAD DEBUG] ✓ File is an image, proceeding...
[IMAGE UPLOAD DEBUG] Current noteId: 67abc123...
[IMAGE UPLOAD DEBUG] ✓ noteId exists, attempting server upload...
...
```

**Server Console** will show:
```
████████████████████████████████████████████████████████
[SERVER UPLOAD DEBUG] POST /api/upload - Request received
[SERVER UPLOAD DEBUG] User: {...}
[SERVER UPLOAD DEBUG] ✓ File object received: {...}
...
```

## Diagnosing the Issue

### Scenario 1: No noteId (Client Issue)
**Browser Console shows**:
```
[IMAGE UPLOAD DEBUG] ✗ No noteId provided, using local preview only
```
**Problem**: The `noteId` prop is not being passed to `EditorToolbar`
**Solution**: Check how `EditorToolbar` is being called in parent components

### Scenario 2: Upload Fails at API Call (Network Issue)
**Browser Console shows**:
```
[STORE UPLOAD ERROR] ✗ Upload failed!
[STORE UPLOAD ERROR] Response status: 500
```
**Problem**: The API call to `/api/upload` failed
**Solution**: Check server console for errors

### Scenario 3: File Not Saving to Disk (Server Issue)
**Server Console shows**:
```
[SERVER UPLOAD DEBUG] ✗✗✗ File verification failed!
```
**Problem**: File.mv() succeeded but file doesn't exist
**Solution**: Check file permissions on `server/uploads` folder

### Scenario 4: File Saves but Doesn't Show in Files Page
**Server Console shows**:
```
[SERVER UPLOAD DEBUG] ✓✓✓ File saved successfully!
[SERVER ATTACHMENT DEBUG] ✓ File record created successfully
```
**But Files page is empty**
**Problem**: File record might have wrong description or query is incorrect
**Solution**: Check database File records and their `description` field

## Expected Successful Output

When everything works correctly, you should see:

**Browser Console**:
```
═══════════════════════════════════════════════════════
[IMAGE UPLOAD DEBUG] handleImageUpload triggered
[IMAGE UPLOAD DEBUG] ✓ File is an image, proceeding...
[IMAGE UPLOAD DEBUG] ✓ noteId exists, attempting server upload...
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
[STORE UPLOAD DEBUG] Step 1: Preparing FormData...
[STORE UPLOAD DEBUG] Step 2: Calling POST /api/upload...
[STORE UPLOAD DEBUG] ✓ Upload endpoint responded
[STORE UPLOAD DEBUG] Step 3: Adding attachment to note...
[STORE UPLOAD DEBUG] ✓ Attachment added to note
[STORE UPLOAD DEBUG] ✓✓✓ Upload complete!
[IMAGE UPLOAD DEBUG] ✓✓✓ Image inserted into editor
```

**Server Console**:
```
████████████████████████████████████████████████████████
[SERVER UPLOAD DEBUG] POST /api/upload - Request received
[SERVER UPLOAD DEBUG] ✓ File object received
[SERVER UPLOAD DEBUG] ✓ File type allowed
[SERVER UPLOAD DEBUG] ✓ File.mv() completed
[SERVER UPLOAD DEBUG] ✓✓✓ File saved successfully!
████████████████████████████████████████████████████████
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
[SERVER ATTACHMENT DEBUG] POST /api/notes/:id/attachments
[SERVER ATTACHMENT DEBUG] ✓ Note found
[SERVER ATTACHMENT DEBUG] ✓ Attachment data valid
[SERVER ATTACHMENT DEBUG] ✓ Note saved with new attachment
[SERVER ATTACHMENT DEBUG] ✓ File record created successfully
[SERVER ATTACHMENT DEBUG] ✓✓✓ All steps complete!
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

## Next Steps

1. **Try uploading an image** following the steps above
2. **Copy the console output** from both browser and server
3. **Look for any ✗ (error) symbols** in the logs
4. **Share the logs** with me so I can identify the exact failure point

The logs are color-coded with special characters to make it easy to see where each section starts and ends:
- `═` for client image upload
- `▓` for client store upload
- `█` for server upload
- `▒` for server attachment

This will pinpoint exactly where the upload is failing!

