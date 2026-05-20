import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import File from '../models/File.js';
import auth from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get all files for the authenticated user (only note attachments)
router.get('/', auth, async (req, res) => {
  try {
    console.log('[FILES GET] Request from user:', req.user.userId);
    const { page = 1, limit = 20, search, mimetype, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Only show files that are note attachments (have description starting with "Attachment from note:")
    const query = { 
      uploadedBy: req.user.userId,
      description: { $regex: '^Attachment from note:', $options: 'i' }
    };
    
    console.log('[FILES GET] Base query:', JSON.stringify(query));
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { originalName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add mimetype filter
    if (mimetype) {
      if (mimetype === 'image') {
        query.mimetype = { $regex: '^image/', $options: 'i' };
      } else if (mimetype === 'video') {
        query.mimetype = { $regex: '^video/', $options: 'i' };
      } else if (mimetype === 'audio') {
        query.mimetype = { $regex: '^audio/', $options: 'i' };
      } else if (mimetype === 'document') {
        query.mimetype = { 
          $regex: '(pdf|doc|docx|txt|rtf|odt)', 
          $options: 'i' 
        };
      } else {
        query.mimetype = mimetype;
      }
    }
    
    console.log('[FILES GET] Final query:', JSON.stringify(query));
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const files = await File.find(query)
      .populate('tags', 'name color')
      .populate('uploadedBy', 'name email')
      .populate('workspace', 'name')
      .populate('notebook', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await File.countDocuments(query);
    
    console.log('[FILES GET] Found', files.length, 'files, total:', total);
    console.log('[FILES GET] Files:', files.map(f => ({ id: f._id, name: f.name, description: f.description })));
    
    res.json({
      files,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('[FILES GET] Error fetching files:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload new file
router.post('/upload', auth, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No files were uploaded' });
    }

    const file = req.files.file;
    const { description, tags, workspace, notebook } = req.body;
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${req.user.userId}_${timestamp}_${file.name}`;
    const uploadPath = path.join(__dirname, '../uploads', fileName);
    
    // Move file to uploads directory
    await file.mv(uploadPath);
    
    // Create file record
    const newFile = new File({
      name: file.name,
      originalName: file.name,
      mimetype: file.mimetype,
      size: file.size,
      path: uploadPath,
      url: `/uploads/${fileName}`,
      description: description || '',
      tags: tags ? JSON.parse(tags) : [],
      uploadedBy: req.user.userId,
      workspace: workspace || null,
      notebook: notebook || null
    });
    
    await newFile.save();
    
    // Populate related fields
    await newFile.populate(['tags', 'uploadedBy', 'workspace', 'notebook']);
    
    res.status(201).json({ message: 'File uploaded successfully', file: newFile });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get file by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate('tags', 'name color')
      .populate('uploadedBy', 'name email')
      .populate('workspace', 'name')
      .populate('notebook', 'name');
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user has access to the file
    if (file.uploadedBy._id.toString() !== req.user.userId && !file.isPublic) {
      const hasAccess = file.sharedWith.some(share => 
        share.user.toString() === req.user.userId
      );
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    res.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update file
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, tags, isPinned, isShortcut } = req.body;
    
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user owns the file
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update file
    if (name !== undefined) file.name = name;
    if (description !== undefined) file.description = description;
    if (tags !== undefined) file.tags = tags;
    if (isPinned !== undefined) file.isPinned = isPinned;
    if (isShortcut !== undefined) file.isShortcut = isShortcut;
    
    await file.save();
    await file.populate(['tags', 'uploadedBy', 'workspace', 'notebook']);
    
    res.json({ message: 'File updated successfully', file });
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user owns the file
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Delete physical file
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (fsError) {
      console.error('Error deleting physical file:', fsError);
    }
    
    // Delete file record
    await File.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stream file (for videos, audio, images - inline viewing)
// Note: We'll handle auth differently since video elements can't send custom headers
router.get('/:id/stream', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Handle authentication via token query parameter (since video elements can't send headers)
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    // Verify token
    let userId;
    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Check if user has access to the file
    if (file.uploadedBy.toString() !== userId && !file.isPublic) {
      const hasAccess = file.sharedWith.some(share => 
        share.user.toString() === userId
      );
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    // Check if file exists
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }
    
    // Set CORS headers for cross-origin requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Range, Content-Type');
    
    // Get file stats
    const stat = fs.statSync(file.path);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Set content type
    res.contentType(file.mimetype);
    
    if (range) {
      // Parse range header for partial content (important for video streaming)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }
      
      const chunksize = (end - start) + 1;
      const file_stream = fs.createReadStream(file.path, { start, end });
      
      res.status(206); // Partial Content
      res.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.header('Accept-Ranges', 'bytes');
      res.header('Content-Length', chunksize);
      
      file_stream.pipe(res);
    } else {
      // Send entire file
      res.header('Content-Length', fileSize);
      res.header('Accept-Ranges', 'bytes');
      fs.createReadStream(file.path).pipe(res);
    }
    
    // Update access stats (don't wait for this)
    file.lastAccessedAt = new Date();
    file.save().catch(err => console.error('Error updating file stats:', err));
    
  } catch (error) {
    console.error('Error streaming file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download file (force download)
router.get('/:id/download', auth, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user has access to the file
    if (file.uploadedBy.toString() !== req.user.userId && !file.isPublic) {
      const hasAccess = file.sharedWith.some(share => 
        share.user.toString() === req.user.userId
      );
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    // Update download count and last accessed
    file.downloadCount += 1;
    file.lastAccessedAt = new Date();
    await file.save();
    
    // Send file
    res.download(file.path, file.originalName);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Share file
router.post('/:id/share', auth, async (req, res) => {
  try {
    const { userIds, permissions = 'read' } = req.body;
    
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user owns the file
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Add users to shared list
    userIds.forEach(userId => {
      const existingShare = file.sharedWith.find(share => 
        share.user.toString() === userId
      );
      
      if (!existingShare) {
        file.sharedWith.push({ user: userId, permissions });
      } else {
        existingShare.permissions = permissions;
      }
    });
    
    file.isShared = file.sharedWith.length > 0;
    await file.save();
    
    res.json({ message: 'File shared successfully', file });
  } catch (error) {
    console.error('Error sharing file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create file record from attachment (for autosave)
router.post('/create-from-attachment', auth, async (req, res) => {
  try {
    const { name, originalName, mimetype, size, path, url, description, tags, workspace, notebook } = req.body;
    
    // Check if file already exists
    const existingFile = await File.findOne({ 
      url: url,
      uploadedBy: req.user.userId 
    });
    
    if (existingFile) {
      return res.json({ message: 'File already exists', file: existingFile });
    }
    
    // Create new file record
    const newFile = new File({
      name: name || originalName,
      originalName: originalName || name,
      mimetype: mimetype,
      size: size,
      path: path,
      url: url,
      description: description || '',
      tags: tags || [],
      uploadedBy: req.user.userId,
      workspace: workspace || null,
      notebook: notebook || null
    });
    
    await newFile.save();
    
    // Populate related fields
    await newFile.populate(['tags', 'uploadedBy', 'workspace', 'notebook']);
    
    res.status(201).json({ message: 'File record created successfully', file: newFile });
  } catch (error) {
    console.error('Error creating file from attachment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
