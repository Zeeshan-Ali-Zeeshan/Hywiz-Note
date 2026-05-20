# Attachment Upload Bug Fix Summary

## Problem
Uploaded attachments to notes were not:
1. Being saved to `server/uploads` folder
2. Appearing in the Files page

## Changes Made

### 1. Fixed `server/routes/notes.js` (POST /:id/attachments)
**Changes:**
- Added duplicate check before creating File records
- Used consistent absolute path format
- Added comprehensive error logging
- Added file existence verification
- Improved error handling for duplicate scenarios

**Key fixes:**
```javascript
// Check if File record already exists
const existingFile = await File.findOne({ 
  url: attachment.url,
  uploadedBy: req.userId 
});

// Use consistent path format
const uploadsDir = path.join(__dirname, '../uploads');
const filePath = path.join(uploadsDir, attachment.filename);

// Create File record with correct description
const newFile = new File({
  name: attachment.originalName || attachment.filename,
  originalName: attachment.originalName || attachment.filename,
  mimetype: attachment.type,
  size: attachment.size,
  path: filePath,
  url: attachment.url,
  description: `Attachment from note: ${note.title}`,  // Important for Files page filtering
  tags: [],
  uploadedBy: req.userId,
  workspace: note.workspaceId || null,
  notebook: note.primaryNotebookId || null
});
```

### 2. Enhanced `server/routes/upload.js` (POST /)
**Changes:**
- Added file verification after saving
- Added detailed logging for debugging

**Key fixes:**
```javascript
// Verify file was saved correctly
await fs.access(uploadPath);
const stats = await fs.stat(uploadPath);
console.log('[UPLOAD DEBUG] File saved successfully');
```

### 3. Added Logging to `server/routes/files.js` (GET /)
**Changes:**
- Added comprehensive logging to track file queries
- Log user ID, query parameters, and results

## How It Works Now

1. **User uploads a file:**
   - File is saved to `server/uploads/` via `/api/upload`
   - Returns file info (filename, url, mimetype, size, etc.)

2. **Frontend adds attachment to note:**
   - Calls `/api/notes/:id/attachments` with attachment data
   
3. **Backend creates File record:**
   - Checks if File record already exists (prevents duplicates)
   - Verifies file exists on disk
   - Creates File record with description: `"Attachment from note: {note.title}"`
   - This description is crucial for Files page filtering

4. **Files page displays attachments:**
   - Queries files with `description: { $regex: '^Attachment from note:' }`
   - Shows all note attachments

## Testing Instructions

1. **Restart the server:**
   ```bash
   cd server
   node index.js
   ```

2. **Open your browser and navigate to a note**

3. **Upload an attachment:**
   - Click the attachment button
   - Select a file
   - Upload it

4. **Check the console logs for:**
   ```
   [UPLOAD DEBUG] Upload request received
   [UPLOAD DEBUG] File saved successfully
   [ATTACHMENT] Request to add attachment to note
   [ATTACHMENT] Attachment added to note successfully
   [ATTACHMENT] Creating new File record
   [ATTACHMENT] File record created successfully
   ```

5. **Navigate to the Files page**

6. **Check the console logs for:**
   ```
   [FILES GET] Request from user: {userId}
   [FILES GET] Base query: {...}
   [FILES GET] Found X files, total: X
   ```

7. **The uploaded file should appear in the Files page**

## Debugging

If files still don't appear:

1. **Check if file is on disk:**
   - Navigate to `server/uploads/` folder
   - Look for files with pattern: `{userId}_{timestamp}.{extension}`

2. **Check database:**
   - Look for File records in MongoDB
   - Verify they have `description` starting with "Attachment from note:"

3. **Check console logs:**
   - Look for any errors in `[ATTACHMENT]` or `[FILES GET]` logs
   - Check if File record creation is failing

4. **Common issues:**
   - File not being saved to disk (check upload route logs)
   - File record not being created (check attachment route logs)
   - Description not matching regex (check File record in database)
   - Wrong user ID (check auth middleware logs)

## Path Configuration

All routes now use consistent path format:
```javascript
const uploadsDir = path.join(__dirname, '../uploads');
const uploadPath = path.join(uploadsDir, filename);
```

This matches the static file serving in `server/index.js`:
```javascript
app.use('/uploads', express.static(path.join(process.cwd(), 'server/uploads')));
```

