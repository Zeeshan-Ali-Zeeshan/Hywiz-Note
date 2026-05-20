import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import auth from '../middleware/auth.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Upload file
router.post('/', auth, async (req, res) => {
  console.log('████████████████████████████████████████████████████████');
  console.log('[SERVER UPLOAD DEBUG] POST /api/upload - Request received');
  console.log('[SERVER UPLOAD DEBUG] Timestamp:', new Date().toISOString());
  console.log('[SERVER UPLOAD DEBUG] User:', {
    userId: req.user?.userId,
    username: req.user?.username
  });
  console.log('[SERVER UPLOAD DEBUG] Files object:', req.files);
  console.log('[SERVER UPLOAD DEBUG] Files keys:', req.files ? Object.keys(req.files) : 'none');
  console.log('[SERVER UPLOAD DEBUG] Body:', req.body);
  
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log('[SERVER UPLOAD DEBUG] ✗ No files uploaded');
      return res.status(400).json({ message: 'No files were uploaded' });
    }

    const file = req.files.file;
    console.log('[SERVER UPLOAD DEBUG] ✓ File object received:', {
      name: file.name,
      mimetype: file.mimetype,
      size: file.size,
      truncated: file.truncated,
      md5: file.md5
    });
    
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
      // Videos
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv', 'video/m4v',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/wma',
      // Documents
      'application/pdf', 'text/plain', 'text/csv', 'text/rtf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar',
      // Code files
      'text/javascript', 'text/css', 'text/html', 'application/json', 'text/xml',
      // Other common types
      'application/octet-stream'
    ];

    console.log('[SERVER UPLOAD DEBUG] Checking file type:', file.mimetype);
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('[SERVER UPLOAD DEBUG] ✗ File type not allowed:', file.mimetype);
      return res.status(400).json({ message: 'File type not allowed' });
    }
    console.log('[SERVER UPLOAD DEBUG] ✓ File type allowed');

    // Create unique filename
    const timestamp = Date.now();
    const extension = path.extname(file.name);
    const filename = `${req.user.userId}_${timestamp}${extension}`;
    
    console.log('[SERVER UPLOAD DEBUG] Generated filename:', filename);

    // Use server/uploads relative to this file, so it's consistent with static serving
    const uploadsDir = path.join(__dirname, '../uploads');
    const uploadPath = path.join(uploadsDir, filename);
    
    console.log('[SERVER UPLOAD DEBUG] Upload directory:', uploadsDir);
    console.log('[SERVER UPLOAD DEBUG] Upload path:', uploadPath);

    // Ensure uploads directory exists
    console.log('[SERVER UPLOAD DEBUG] Checking if uploads directory exists...');
    try {
      await fs.access(uploadsDir);
      console.log('[SERVER UPLOAD DEBUG] ✓ Uploads directory exists');
    } catch {
      console.log('[SERVER UPLOAD DEBUG] Uploads directory does not exist, creating...');
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('[SERVER UPLOAD DEBUG] ✓ Uploads directory created');
    }

    // Move file to uploads directory
    console.log('[SERVER UPLOAD DEBUG] Moving file to:', uploadPath);
    await file.mv(uploadPath);
    console.log('[SERVER UPLOAD DEBUG] ✓ File.mv() completed');
    
    // Verify file was saved correctly
    console.log('[SERVER UPLOAD DEBUG] Verifying file was saved...');
    try {
      await fs.access(uploadPath);
      const stats = await fs.stat(uploadPath);
      console.log('[SERVER UPLOAD DEBUG] ✓✓✓ File saved successfully!');
      console.log('[SERVER UPLOAD DEBUG] File details:', {
        filename: filename,
        size: stats.size,
        path: uploadPath,
        exists: true
      });
    } catch (verifyError) {
      console.error('[SERVER UPLOAD DEBUG] ✗✗✗ File verification failed!');
      console.error('[SERVER UPLOAD DEBUG] Verify error:', verifyError);
      return res.status(500).json({ message: 'File was not saved correctly' });
    }

    const fileInfo = {
      filename,
      originalName: file.name,
      url: `/uploads/${filename}`,
      type: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    };

    console.log('[SERVER UPLOAD DEBUG] Preparing response:', fileInfo);
    console.log('[SERVER UPLOAD DEBUG] ✓ Sending success response');
    console.log('████████████████████████████████████████████████████████');
    res.json(fileInfo);
  } catch (error) {
    console.error('████████████████████████████████████████████████████████');
    console.error('[SERVER UPLOAD DEBUG] ✗✗✗ Upload error occurred!');
    console.error('[SERVER UPLOAD DEBUG] Error:', error);
    console.error('[SERVER UPLOAD DEBUG] Error message:', error?.message);
    console.error('[SERVER UPLOAD DEBUG] Error stack:', error?.stack);
    console.error('████████████████████████████████████████████████████████');
    res.status(500).json({ message: 'Upload failed', error: error?.message });
  }
});

export default router;



