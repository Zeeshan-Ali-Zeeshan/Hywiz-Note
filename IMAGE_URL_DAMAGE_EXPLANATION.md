# Why Image URLs Get Damaged After Restarts

## Overview
Images uploaded in the note editor sometimes show placeholders instead of the actual image after the frontend, backend, or both are restarted. This document explains the root causes and solutions.

## Root Causes

### 1. **Blob URLs Are Temporary (Primary Issue)**

**Problem:**
- Blob URLs (`blob:http://localhost:5173/...`) are **temporary** and only valid for the current browser session
- They are created using `URL.createObjectURL(file)` and point to in-memory blob objects
- These URLs become **invalid** when:
  - Page is reloaded
  - Browser tab is closed and reopened
  - Frontend server restarts
  - Browser is restarted

**Where it happens:**
Looking at `src/components/editor/EditorToolbar.tsx`:
- Line 308: Fallback when no server URL is available
- Line 316: When no noteId is provided
- Line 329: When upload fails (error fallback)

```typescript
// ❌ PROBLEMATIC CODE
const url = URL.createObjectURL(file);
editor.chain().focus().setImage({ src: url }).run();
```

**Why it breaks:**
1. User uploads image → Upload fails or noteId missing
2. Code creates blob URL as fallback → Image shows temporarily
3. User saves note → Blob URL is saved in YJS/database
4. Page reloads or server restarts → Blob URL becomes invalid
5. Image shows placeholder → `ERR_FILE_NOT_FOUND` error

---

### 2. **Server Restart - Static File Serving Issues**

**Problem:**
When the backend server restarts:
- Static file serving might not initialize properly
- File paths might change if using relative paths
- The `/uploads` route might not be mounted correctly

**Where it happens:**
In `server/index.js`:
```javascript
app.use('/uploads', express.static(path.join(process.cwd(), 'server/uploads'), {
  acceptRanges: true,
  cacheControl: false,
  etag: false,
  lastModified: false
}));
```

**Why it breaks:**
1. Images are saved with URLs like `/uploads/filename.png`
2. Server restarts → Static file middleware might not mount correctly
3. Request to `/uploads/filename.png` → 404 Not Found
4. Image shows placeholder

**Potential issues:**
- `process.cwd()` might change if server starts from different directory
- File permissions might be lost
- Files might be deleted if using temporary storage

---

### 3. **Frontend Restart - Blob URL Invalidation**

**Problem:**
When the frontend (Vite dev server) restarts:
- All blob URLs created in the previous session become invalid
- If images were saved with blob URLs in YJS, they break immediately

**Why it breaks:**
1. User uploads image → Blob URL created (fallback scenario)
2. Image saved in YJS with blob URL → `blob:http://localhost:5173/...`
3. Frontend restarts → New session, new origin
4. Old blob URLs no longer exist → `ERR_FILE_NOT_FOUND`
5. Image shows placeholder

---

### 4. **YJS Synchronization Issues**

**Problem:**
Images stored in YJS might contain blob URLs that get synchronized across sessions. When a new session loads:
- YJS applies the update with blob URL
- Blob URL is invalid in new session
- Image fails to load

**Where it happens:**
In `src/components/editor/RichTextEditor.tsx`:
- YJS updates are saved to backend with canonical state
- If blob URLs are in the YJS state, they get persisted
- On reload, invalid blob URLs are restored

**Why it breaks:**
1. Image inserted with blob URL → Saved to YJS
2. YJS update saved to backend → Contains blob URL
3. Page reloads → YJS update applied from backend
4. Blob URL restored → Invalid in new session
5. Image shows placeholder

---

### 5. **Upload Failure Fallback**

**Problem:**
When image upload fails, the code falls back to blob URLs instead of showing an error or retrying:

```typescript
// From EditorToolbar.tsx line 320-331
catch (err) {
  // On failure, fallback to local preview
  const url = URL.createObjectURL(file);
  editor.chain().focus().setImage({ src: url }).run();
}
```

**Why it breaks:**
1. Upload fails (network error, server down, etc.)
2. Code creates blob URL as "fallback"
3. User continues working → Image appears to work
4. User saves note → Blob URL saved
5. Page reloads → Blob URL invalid → Image breaks

---

### 6. **Missing noteId Scenario**

**Problem:**
When `noteId` is not available, the code uses blob URLs:

```typescript
// From EditorToolbar.tsx line 313-318
if (!noteId) {
  const url = URL.createObjectURL(file);
  editor.chain().focus().setImage({ src: url }).run();
}
```

**Why it breaks:**
1. Editor opens before note is fully loaded
2. User uploads image → No noteId available
3. Blob URL created → Image shows temporarily
4. Note loads → But image already has blob URL
5. Page reloads → Blob URL invalid → Image breaks

---

## Solutions

### ✅ Solution 1: Always Use Server URLs (Recommended)

**Fix the fallback logic to wait for server upload:**

```typescript
// Instead of immediate blob URL fallback, show error and retry
if (!serverUrl) {
  // Show error to user
  console.error('Upload failed - cannot use temporary blob URL');
  // Optionally: Retry upload or show error message
  return;
}
```

**Ensure upload always succeeds before inserting image:**
- Wait for upload to complete
- Only insert image if server URL is available
- Show error message if upload fails (don't use blob URL)

---

### ✅ Solution 2: Validate and Replace Blob URLs on Load

**Add validation when loading notes:**

```typescript
// In RichTextEditor.tsx or NoteEditor.tsx
useEffect(() => {
  if (!editor || !noteData) return;
  
  // Find all images with blob URLs
  const html = editor.getHTML();
  const blobUrlRegex = /blob:https?:\/\/[^\s"']+/g;
  const blobUrls = html.match(blobUrlRegex);
  
  if (blobUrls && blobUrls.length > 0) {
    console.warn('[IMAGE FIX] Found blob URLs in content:', blobUrls);
    // Try to replace with server URLs from attachments
    // Or show error to user
  }
}, [editor, noteData]);
```

---

### ✅ Solution 3: Ensure Static File Serving is Robust

**Fix server static file serving:**

```javascript
// In server/index.js - Use absolute path
const uploadsPath = path.resolve(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  acceptRanges: true,
  cacheControl: false,
  etag: false,
  lastModified: false,
  // Add error handling
  onError: (err, req, res) => {
    console.error('[STATIC FILE ERROR]', err);
    res.status(404).json({ error: 'File not found' });
  }
}));
```

---

### ✅ Solution 4: Clean Blob URLs from YJS on Save

**Before saving YJS update, replace blob URLs:**

```typescript
// In RichTextEditor.tsx - before saveCanonicalYjsUpdate
function cleanBlobUrlsFromYjs(ydoc: Y.Doc, attachments: any[]) {
  const yXml = ydoc.getXmlFragment('prosemirror');
  const json = yXml.toJSON();
  
  // Recursively find and replace blob URLs
  function replaceBlobUrls(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(replaceBlobUrls);
    }
    if (obj && typeof obj === 'object') {
      if (obj.type === 'image' && obj.attrs?.src?.startsWith('blob:')) {
        // Try to find matching attachment
        const filename = extractFilenameFromBlobUrl(obj.attrs.src);
        const attachment = attachments.find(a => 
          a.originalName === filename || a.filename === filename
        );
        if (attachment) {
          obj.attrs.src = `http://localhost:3001${attachment.url}`;
        }
      }
      return { ...obj, ...Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, replaceBlobUrls(v)])
      )};
    }
    return obj;
  }
  
  const cleaned = replaceBlobUrls(json);
  // Rebuild YJS from cleaned JSON
  // (This is complex - might need to clear and rebuild)
}
```

---

### ✅ Solution 5: Prevent Blob URL Usage Entirely

**Remove all blob URL fallbacks:**

1. **In EditorToolbar.tsx:**
   - Remove blob URL fallbacks
   - Show error message if upload fails
   - Retry upload instead of using blob URL

2. **Add validation:**
   ```typescript
   // Before inserting image, validate URL
   if (url.startsWith('blob:')) {
     console.error('Cannot use blob URL - upload must succeed first');
     throw new Error('Image upload failed');
   }
   ```

---

## Detection and Debugging

### How to Detect Blob URLs:

```javascript
// Check browser console for:
// GET blob:http://localhost:5173/... net::ERR_FILE_NOT_FOUND

// Or in code:
const hasBlobUrls = html.includes('blob:http://') || html.includes('blob:https://');
```

### Debug Steps:

1. **Check image URLs in editor:**
   ```javascript
   // In browser console
   document.querySelectorAll('img').forEach(img => {
     console.log('Image src:', img.src);
     if (img.src.startsWith('blob:')) {
       console.warn('⚠️ Blob URL found:', img.src);
     }
   });
   ```

2. **Check YJS content:**
   ```javascript
   // In RichTextEditor.tsx
   const yXml = ydoc.getXmlFragment('prosemirror');
   const json = yXml.toJSON();
   console.log('YJS content:', JSON.stringify(json));
   // Look for "blob:" in the output
   ```

3. **Check server uploads directory:**
   ```bash
   ls -la server/uploads/
   # Verify files exist
   ```

4. **Check network requests:**
   - Open browser DevTools → Network tab
   - Look for failed requests to `/uploads/...`
   - Check for `blob:` URL requests

---

## Prevention Checklist

- [ ] Remove all `URL.createObjectURL()` fallbacks
- [ ] Always wait for server upload before inserting image
- [ ] Show error message if upload fails (don't use blob URL)
- [ ] Validate image URLs before saving to YJS
- [ ] Use absolute paths for static file serving
- [ ] Add error handling for static file serving
- [ ] Clean blob URLs from YJS on save
- [ ] Add validation on note load to detect blob URLs
- [ ] Test image persistence after server restart
- [ ] Test image persistence after frontend restart
- [ ] Test image persistence after browser restart

---

## Summary

**Main Issue:** Blob URLs are temporary and become invalid after any restart.

**Root Causes:**
1. Blob URLs used as fallback when upload fails
2. Blob URLs used when noteId is missing
3. Blob URLs saved to YJS and persisted
4. Static file serving issues on server restart
5. No validation or cleanup of blob URLs

**Solution:** Always use server URLs (`http://localhost:3001/uploads/...`) and never use blob URLs as fallbacks. Show errors instead of silently failing with temporary URLs.

