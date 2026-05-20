 

import express from 'express';
import Note from '../models/Note.js';
import Notebook from '../models/Notebook.js';
import Workspace from '../models/Workspace.js';
import auth from '../middleware/auth.js';
import Tag from '../models/Tag.js';
import path from 'path';
import { promises as fs } from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import SharedNote from '../models/SharedNote.js';
import * as Y from 'yjs';
import { Buffer } from 'buffer';
import { htmlToProseMirrorJSON } from '../utils/htmlToProseMirrorJSON.js';
import { extractPlainTextFromYjs } from '../utils/yjsToPlainText.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const upload = multer({ dest: 'server/uploads/' });

// Helper function to map frontend permissions to backend permissions
const mapPermission = (frontendPermission) => {
  const mapping = {
    'view': 'read',
    'edit': 'write',
    'full': 'admin'
  };
  return mapping[frontendPermission] || 'read';
};

// Helper function to map backend permissions to frontend permissions
const mapPermissionBack = (backendPermission) => {
  const mapping = {
    'read': 'view',
    'write': 'edit',
    'admin': 'full'
  };
  return mapping[backendPermission] || 'view';
};

// Get all notes
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'updatedAt', 
      sortOrder = 'desc',
      notebook,
      tags,
      search,
      pinned,
      deleted = false
    } = req.query;

    const query = { 
      userId: req.userId,
      isDeleted: deleted === 'true'
    };

    if (notebook) query.primaryNotebookId = notebook;
    if (tags) query.tags = { $in: tags.split(',') };
    if (pinned !== undefined) query.isPinned = pinned === 'true';
    if (search) {
      query.$text = { $search: search };
    }
    // Additional filters
    if (req.query.createdFrom || req.query.createdTo) {
      query.createdAt = {};
      if (req.query.createdFrom) {
        query.createdAt.$gte = new Date(req.query.createdFrom);
      }
      if (req.query.createdTo) {
        query.createdAt.$lte = new Date(req.query.createdTo);
      }
    }

    if (req.query.hasAttachments) {
      query['attachments.0'] = { $exists: true };
    }

    const notes = await Note.find(query)
      .populate('primaryNotebookId', 'name color')
      .lean() // Use lean() to avoid validation errors with corrupted attachments
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Convert yjsUpdate to base64 string and fix attachments for each note
    const notesWithYjsUpdate = notes.map(note => {
      const noteObj = { ...note };
      
      // Fix attachments if corrupted
      if (noteObj.attachments && typeof noteObj.attachments === 'string') {
        noteObj.attachments = fixAttachments(noteObj.attachments);
      } else if (!Array.isArray(noteObj.attachments)) {
        noteObj.attachments = [];
      }
      
      // Convert yjsUpdate Buffer to base64
      if (noteObj.yjsUpdate) {
        if (Buffer.isBuffer(noteObj.yjsUpdate)) {
          noteObj.yjsUpdate = noteObj.yjsUpdate.toString('base64');
        } else if (noteObj.yjsUpdate.buffer) {
          noteObj.yjsUpdate = Buffer.from(noteObj.yjsUpdate.buffer).toString('base64');
        } else if (noteObj.yjsUpdate.data) {
          noteObj.yjsUpdate = Buffer.from(noteObj.yjsUpdate.data).toString('base64');
        }
      }
      
      return noteObj;
    });

    const total = await Note.countDocuments(query);

    res.json({
      notes: notesWithYjsUpdate,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to fix attachments from string to array
function fixAttachments(attachments) {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments !== 'string') return [];
  
  try {
    // Try to parse as JSON string
    const parsed = JSON.parse(attachments);
    if (Array.isArray(parsed)) {
      return parsed.map(att => ({
        ...att,
        uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date()
      }));
    }
  } catch (e) {
    // If parsing fails, try to parse as JavaScript object notation
    try {
      // Handle format like "[\n  {\n    filename: '...',\n    ...\n  }\n]"
      const cleaned = attachments
        .replace(/filename:\s*'([^']+)'/g, '"filename": "$1"')
        .replace(/originalName:\s*'([^']+)'/g, '"originalName": "$1"')
        .replace(/url:\s*'([^']+)'/g, '"url": "$1"')
        .replace(/type:\s*'([^']+)'/g, '"type": "$1"')
        .replace(/size:\s*(\d+)/g, '"size": $1')
        .replace(/uploadedAt:\s*([^\n}]+)/g, (match, dateStr) => {
          return `"uploadedAt": "${dateStr.trim()}"`;
        });
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.map(att => ({
          ...att,
          uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date()
        }));
      }
    } catch (e2) {
      console.error('[ATTACHMENTS FIX] Failed to parse attachments string:', e2.message);
      return [];
    }
  }
  
  return [];
}

// Get single note
router.get('/:id', auth, async (req, res) => {
  try {
    // Use lean() to get raw data without Mongoose validation
    // This avoids validation errors when attachments is stored as string
    const noteData = await Note.findById(req.params.id).lean().populate('primaryNotebookId', 'name color');
    
    if (!noteData) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    // CRITICAL: Preserve yjsUpdate BEFORE any modifications
    // lean() returns MongoDB Binary type which needs special handling
    let preservedYjsUpdate = null;
    if (noteData.yjsUpdate) {
      if (Buffer.isBuffer(noteData.yjsUpdate)) {
        preservedYjsUpdate = noteData.yjsUpdate;
      } else if (noteData.yjsUpdate.buffer) {
        preservedYjsUpdate = Buffer.from(noteData.yjsUpdate.buffer);
      } else if (noteData.yjsUpdate.data) {
        preservedYjsUpdate = Buffer.from(noteData.yjsUpdate.data);
      } else if (typeof noteData.yjsUpdate === 'string') {
        preservedYjsUpdate = noteData.yjsUpdate;
      }
    }
    
    // Fix attachments if needed
    if (noteData.attachments && typeof noteData.attachments === 'string') {
      const fixedAttachments = fixAttachments(noteData.attachments);
      // Save the fixed version back to database using MongoDB driver to bypass validation
      // Convert uploadedAt to Date objects for MongoDB
      const attachmentsForDB = fixedAttachments.map(att => ({
        ...att,
        uploadedAt: att.uploadedAt instanceof Date ? att.uploadedAt : new Date(att.uploadedAt || Date.now())
      }));
      
      await Note.collection.updateOne(
        { _id: noteData._id },
        { $set: { attachments: attachmentsForDB } }
      );
      noteData.attachments = fixedAttachments;
      console.log('[ATTACHMENTS FIX] Fixed and saved attachments for note:', req.params.id);
    } else if (!Array.isArray(noteData.attachments)) {
      noteData.attachments = [];
      await Note.collection.updateOne(
        { _id: noteData._id },
        { $set: { attachments: [] } }
      );
    }
    
    // Convert userId to string for comparison
    const noteUserId = noteData.userId ? (typeof noteData.userId === 'string' ? noteData.userId : noteData.userId.toString()) : null;
    const isOwner = noteUserId === req.userId;
    const isCollaborator = noteData.collaborators && noteData.collaborators.some(c => {
      if (!c.userId) return false;
      const collabUserId = typeof c.userId === 'string' ? c.userId : c.userId.toString();
      return collabUserId === req.userId;
    });
    const isPublicEditor = noteData.shareSettings?.isPublic && noteData.shareSettings?.allowEdit;
    // Check notebook-level collaboration
    const primaryNotebookId = noteData.primaryNotebookId?._id || noteData.primaryNotebookId;
    const notebookIdsToCheck = [primaryNotebookId, ...(noteData.notebookIds || [])].filter(Boolean);
    const isNotebookCollaborator = notebookIdsToCheck.length > 0
      ? !!(await Notebook.exists({ _id: { $in: notebookIdsToCheck }, 'collaborators.userId': req.userId }))
      : false;
    // Check workspace-level collaboration (with scope)
    let isWorkspaceCollaborator = false;
    if (noteData.workspaceId) {
      const ws = await Workspace.findById(noteData.workspaceId);
      if (ws && Array.isArray(ws.collaborators)) {
        const collab = ws.collaborators.find(c => c.userId && c.userId.toString() === req.userId);
        if (collab) {
          if (collab.scope === 'all') {
            isWorkspaceCollaborator = true;
          } else if (collab.scope === 'selected') {
            const scopeNotebookIds = (collab.notebookIds || []).map(id => id.toString());
            isWorkspaceCollaborator = notebookIdsToCheck.some(id => scopeNotebookIds.includes(id.toString()));
          }
        }
      }
    }
    if (!isOwner && !isCollaborator && !isPublicEditor && !isNotebookCollaborator && !isWorkspaceCollaborator) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    // Merge sharing/collaborator info from SharedNote
    const noteId = noteData._id ? (typeof noteData._id === 'string' ? noteData._id : noteData._id.toString()) : null;
    const sharedNote = noteId ? await SharedNote.findOne({ noteId: noteId }) : null;
    if (sharedNote) {
      noteData.sharedWith = sharedNote.sharedWith;
      noteData.isPublic = sharedNote.isPublic;
      noteData.publicUrl = sharedNote.publicUrl;
    }
    // Update last viewed
    await Note.findByIdAndUpdate(req.params.id, { lastViewedAt: new Date() }, { runValidators: false });
    
    // --- Return yjsUpdate as base64 string and fallback content ---
    // Prepare response object - preserve all original data
    const noteObj = { ...noteData };
    
    try {
      // Convert preserved yjsUpdate Buffer to base64
      if (preservedYjsUpdate) {
        if (Buffer.isBuffer(preservedYjsUpdate)) {
          noteObj.yjsUpdate = preservedYjsUpdate.toString('base64');
        } else if (typeof preservedYjsUpdate === 'string') {
          noteObj.yjsUpdate = preservedYjsUpdate;
        } else {
          noteObj.yjsUpdate = undefined;
        }
      } else {
        noteObj.yjsUpdate = undefined;
      }
    } catch (err) {
      console.error('[YJS ERROR] Failed to convert yjsUpdate:', err);
      noteObj.yjsUpdate = undefined;
      noteObj.yjsError = 'Corrupted Yjs data';
    }
    
    // Ensure attachments are properly formatted (array of objects)
    if (!Array.isArray(noteObj.attachments)) {
      noteObj.attachments = [];
    }
    
    // Convert Date objects to ISO strings for proper JSON serialization
    if (noteObj.attachments && Array.isArray(noteObj.attachments)) {
      noteObj.attachments = noteObj.attachments.map(att => ({
        ...att,
        uploadedAt: att.uploadedAt ? (att.uploadedAt instanceof Date ? att.uploadedAt.toISOString() : att.uploadedAt) : new Date().toISOString()
      }));
    }
    
    // Always include fallback content for editor initialization
    noteObj.fallbackContent = noteData.content || '';
    noteObj.fallbackPlainText = noteData.plainTextContent || '';
    
    res.json(noteObj);
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create note
router.post('/', auth, async (req, res) => {
  try {
    const { title, notebookId, primaryNotebookId, tags, workspaceId, content, yjsUpdate } = req.body;

    // Get default notebook if none specified
    let targetNotebookId = primaryNotebookId || notebookId;
    if (!targetNotebookId) {
      let defaultNotebook = await Notebook.findOne({
        userId: req.userId,
        isDefault: true
      });
      // If no default notebook exists, create one
      if (!defaultNotebook) {
        console.log('No default notebook found, creating one for user:', req.userId);
        defaultNotebook = new Notebook({
          name: 'My Notes',
          userId: req.userId,
          isDefault: true,
          color: '#3B82F6'
        });
        await defaultNotebook.save();
      }
      targetNotebookId = defaultNotebook._id;
    }

    // --- Yjs: Prefer client-provided update; otherwise generate from content ---
    let yjsUpdateBuffer = undefined;
    try {
      if (yjsUpdate && typeof yjsUpdate === 'string') {
        yjsUpdateBuffer = Buffer.from(yjsUpdate, 'base64');
      } else {
        const ydoc = new Y.Doc();
        // Title fragment
        if (title && title.trim()) {
          const yTitleFrag = ydoc.getXmlFragment('title');
          const yTitleText = new Y.XmlText();
          yTitleText.insert(0, title.trim());
          yTitleFrag.insert(0, [yTitleText]);
        }
        // Body -> prosemirror paragraphs
        const yXml = ydoc.getXmlFragment('prosemirror');
        const plainText = (content || '').replace(/<[^>]*>/g, '').replace(/\r/g, '').split("\n");
        const paras = (plainText.length ? plainText : ['']).map(line => {
          const p = new Y.XmlElement('paragraph');
          if (line && line.length > 0) {
            const t = new Y.XmlText();
            t.insert(0, line);
            p.insert(0, [t]);
          }
          return p;
        });
        yXml.insert(0, paras);
        yjsUpdateBuffer = Buffer.from(Y.encodeStateAsUpdate(ydoc));
      }
    } catch (e) {
      console.error('[YJS] Failed to generate initial Yjs update:', e);
    }

    const note = new Note({
      noteId: new mongoose.Types.ObjectId().toString(), // Ensure unique noteId
      title: typeof title === 'string' ? title : '',
      userId: req.userId,
      workspaceId: workspaceId || null,
      primaryNotebookId: targetNotebookId,
      notebookIds: [targetNotebookId],
      tags: tags || [],
      yjsUpdate: yjsUpdateBuffer
    });

    await note.save();
    await note.populate('primaryNotebookId', 'name color');

    // Update notebook note count
    await Notebook.findByIdAndUpdate(targetNotebookId, {
      $inc: { noteCount: 1 }
    });

    // Increment noteCount for each tag
    if (tags && tags.length > 0) {
      await Tag.updateMany({ _id: { $in: tags } }, { $inc: { noteCount: 1 } });
    }

    // Emit real-time update
    req.io.emit('note-created', { note, userId: req.userId });

    // Convert yjsUpdate to base64 in response for immediate client usage
    const noteObj = note.toObject();
    if (noteObj.yjsUpdate) {
      try {
        noteObj.yjsUpdate = noteObj.yjsUpdate.toString('base64');
      } catch {}
    }
    res.status(201).json(noteObj);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update note
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, notebookId, primaryNotebookId, tags, isPinned } = req.body;
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    const isOwner = note.userId.toString() === req.userId;
    const isCollaborator = note.collaborators && note.collaborators.some(c => c.userId.toString() === req.userId && (c.permission === 'admin' || c.permission === 'write'));
    const isPublicEditor = note.shareSettings?.isPublic && note.shareSettings?.allowEdit;
    // Notebook-level write access
    const notebookIdsToCheck = [note.primaryNotebookId, ...(note.notebookIds || [])].filter(Boolean);
    let hasNotebookWrite = false;
    if (notebookIdsToCheck.length > 0) {
      const nb = await Notebook.findOne({ _id: { $in: notebookIdsToCheck }, 'collaborators.userId': req.userId });
      if (nb && Array.isArray(nb.collaborators)) {
        const collab = nb.collaborators.find((c) => c.userId && c.userId.toString() === req.userId);
        if (collab && (collab.permission === 'admin' || collab.permission === 'write')) {
          hasNotebookWrite = true;
        }
      }
    }
    // Workspace-level write access with scope
    let hasWorkspaceWrite = false;
    if (note.workspaceId) {
      const ws = await Workspace.findById(note.workspaceId);
      if (ws && Array.isArray(ws.collaborators)) {
        const collab = ws.collaborators.find(c => c.userId && c.userId.toString() === req.userId);
        if (collab && (collab.permission === 'admin' || collab.permission === 'write')) {
          if (collab.scope === 'all') {
            hasWorkspaceWrite = true;
          } else if (collab.scope === 'selected') {
            const scopeNotebookIds = (collab.notebookIds || []).map(id => id.toString());
            hasWorkspaceWrite = notebookIdsToCheck.some(id => scopeNotebookIds.includes(id.toString()));
          }
        }
      }
    }
    if (!isOwner && !isCollaborator && !isPublicEditor && !hasNotebookWrite && !hasWorkspaceWrite) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const oldNotebookId = note.primaryNotebookId;
    const oldTags = note.tags.map(t => t.toString());

    
    // Handle notebook assignment (support both old and new field names)
    const newNotebookId = primaryNotebookId || notebookId;
    
    // Update note
    Object.assign(note, {
      title: title !== undefined ? title : note.title,
      primaryNotebookId: newNotebookId !== undefined ? newNotebookId : note.primaryNotebookId,
      tags: tags !== undefined ? tags : note.tags,
      isPinned: isPinned !== undefined ? isPinned : note.isPinned,

    });
    
    // Update notebookIds if primaryNotebookId changed
    if (newNotebookId && oldNotebookId && oldNotebookId.toString() !== newNotebookId) {
      note.notebookIds = [newNotebookId];
    }
    
    await note.save();
    await note.populate('primaryNotebookId', 'name color');
    // Update notebook counts if notebook changed
    if (newNotebookId && oldNotebookId && oldNotebookId.toString() !== newNotebookId) {
      await Notebook.findByIdAndUpdate(oldNotebookId, { $inc: { noteCount: -1 } });
      await Notebook.findByIdAndUpdate(newNotebookId, { $inc: { noteCount: 1 } });
    }
    // Update tag noteCounts
    if (tags) {
      const newTags = tags.map(t => t.toString());
      const addedTags = newTags.filter(t => !oldTags.includes(t));
      const removedTags = oldTags.filter(t => !newTags.includes(t));
      if (addedTags.length > 0) {
        await Tag.updateMany({ _id: { $in: addedTags } }, { $inc: { noteCount: 1 } });
      }
      if (removedTags.length > 0) {
        await Tag.updateMany({ _id: { $in: removedTags } }, { $inc: { noteCount: -1 } });
      }
    }
    // Emit real-time update with a lean payload to avoid sending buffers
    const broadcastPayload = {
      noteId: note._id.toString(),
      title: note.title,
      updatedAt: note.updatedAt,
      preview: note.preview
    };
    if (req.io) {
      req.io.emit('note-updated', broadcastPayload);
    }
    res.json(note);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete note (move to trash)
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    note.isDeleted = true;
    note.deletedAt = new Date();
    await note.save();

    // Update notebook note count (only if primaryNotebookId exists)
    if (note.primaryNotebookId) {
      await Notebook.findByIdAndUpdate(note.primaryNotebookId, {
        $inc: { noteCount: -1 }
      });
    }

    // Decrement noteCount for each tag
    if (note.tags && note.tags.length > 0) {
      await Tag.updateMany({ _id: { $in: note.tags } }, { $inc: { noteCount: -1 } });
    }

    // Emit real-time update
    req.io.emit('note-deleted', { noteId: req.params.id, userId: req.userId });

    res.json({ message: 'Note moved to trash' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Restore note from trash
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: true
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found in trash' });
    }

    note.isDeleted = false;
    note.deletedAt = undefined;
    await note.save();

    // Update notebook note count (only if primaryNotebookId exists)
    if (note.primaryNotebookId) {
      await Notebook.findByIdAndUpdate(note.primaryNotebookId, {
        $inc: { noteCount: 1 }
      });
    }

    // Emit real-time update
    req.io.emit('note-restored', { note, userId: req.userId });

    res.json({ message: 'Note restored' });
  } catch (error) {
    console.error('Restore note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Permanently delete note
router.delete('/:id/permanent', auth, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: true
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found in trash' });
    }

    // Emit real-time update
    req.io.emit('note-permanently-deleted', { noteId: req.params.id, userId: req.userId });

    res.json({ message: 'Note permanently deleted' });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Duplicate note
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const originalNote = await Note.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!originalNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const duplicatedNote = new Note({
      title: `${originalNote.title} (Copy)`,
      content: originalNote.content,
      plainTextContent: originalNote.plainTextContent,
      userId: req.userId,
      workspaceId: originalNote.workspaceId,
      primaryNotebookId: originalNote.primaryNotebookId,
      notebookIds: [originalNote.primaryNotebookId],
      tags: [...originalNote.tags],
      yjsUpdate: originalNote.yjsUpdate // Include YJS data if available
    });

    await duplicatedNote.save();
    await duplicatedNote.populate('primaryNotebookId', 'name color');

    // Update notebook note count
    await Notebook.findByIdAndUpdate(originalNote.primaryNotebookId, {
      $inc: { noteCount: 1 }
    });

    res.status(201).json(duplicatedNote);
  } catch (error) {
    console.error('Duplicate note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Copy note to specific destination
router.post('/:id/copy-to', auth, async (req, res) => {
  try {
    const { destinationType, destinationId } = req.body;
    
    if (!destinationType || !destinationId) {
      return res.status(400).json({ message: 'Destination type and ID are required' });
    }

    const originalNote = await Note.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!originalNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    let targetNotebookId = destinationId;
    let targetWorkspaceId = originalNote.workspaceId;

    if (destinationType === 'notebook') {
      // Verify the notebook exists and user has access
      const notebook = await Notebook.findOne({
        _id: destinationId,
        $or: [
          { userId: req.userId },
          { 'collaborators.userId': req.userId }
        ]
      });
      
      if (!notebook) {
        return res.status(404).json({ message: 'Notebook not found or access denied' });
      }
      
      targetNotebookId = notebook._id;
      targetWorkspaceId = notebook.workspaceId || originalNote.workspaceId;
    } else if (destinationType === 'workspace') {
      // For workspace, we'll use the default notebook of that workspace
      const Workspace = require('../models/Workspace');
      const workspace = await Workspace.findOne({
        _id: destinationId,
        $or: [
          { userId: req.userId },
          { 'collaborators.userId': req.userId }
        ]
      });
      
      if (!workspace) {
        return res.status(404).json({ message: 'Workspace not found or access denied' });
      }
      
      // Find the default notebook in this workspace
      const defaultNotebook = await Notebook.findOne({
        workspaceId: workspace._id,
        isDefault: true
      });
      
      if (!defaultNotebook) {
        return res.status(404).json({ message: 'Default notebook not found in workspace' });
      }
      
      targetNotebookId = defaultNotebook._id;
      targetWorkspaceId = workspace._id;
    }

    const copiedNote = new Note({
      title: `${originalNote.title} (Copy)`,
      content: originalNote.content,
      plainTextContent: originalNote.plainTextContent,
      userId: req.userId,
      primaryNotebookId: targetNotebookId,
      notebookIds: [targetNotebookId],
      workspaceId: targetWorkspaceId,
      tags: [...originalNote.tags],
      yjsUpdate: originalNote.yjsUpdate // Include YJS data if available
    });

    await copiedNote.save();
    await copiedNote.populate('primaryNotebookId', 'name color');

    // Update notebook note count
    await Notebook.findByIdAndUpdate(targetNotebookId, {
      $inc: { noteCount: 1 }
    });

    res.status(201).json(copiedNote);
  } catch (error) {
    console.error('Copy note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save shared note to user's account
router.post('/:id/save-shared', auth, async (req, res) => {
  try {
    // First try to get the note as a shared note
    const sharedNote = await Note.findById(req.params.id)
      .populate('userId', 'name email')
      .select('-__v');
    
    if (!sharedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if note is public or user is a collaborator
    const isPublic = sharedNote.shareSettings?.isPublic;
    let isCollaborator = false;
    let hasAdminAccess = false;
    
    if (sharedNote.collaborators) {
      const collaborator = sharedNote.collaborators.find(c => {
        if (!c.userId) return false;
        if (typeof c.userId.equals === 'function') {
          return c.userId.equals(req.userId);
        }
        return c.userId.toString() === req.userId;
      });
      
      if (collaborator) {
        isCollaborator = true;
        hasAdminAccess = collaborator.permission === 'admin';
      }
    }

    // Only allow saving if user is owner, has admin access, or note is public with edit access
    const canSave = sharedNote.userId.toString() === req.userId || 
                   hasAdminAccess || 
                   (isPublic && sharedNote.shareSettings?.allowEdit);

    if (!canSave) {
      return res.status(403).json({ message: 'You do not have permission to save this note' });
    }

    // Get user's default notebook
    let defaultNotebook = await Notebook.findOne({
      userId: req.userId,
      isDefault: true
    });
    
    if (!defaultNotebook) {
      defaultNotebook = new Notebook({
        name: 'My Notes',
        userId: req.userId,
        isDefault: true,
        color: '#3B82F6'
      });
      await defaultNotebook.save();
    }

    // Create new note in user's account
    const newNote = new Note({
      title: `${sharedNote.title} (Shared)`,
      content: sharedNote.content,
      plainTextContent: sharedNote.plainTextContent,
      userId: req.userId,
      primaryNotebookId: defaultNotebook._id,
      notebookIds: [defaultNotebook._id],
      tags: [...sharedNote.tags]
    });

    await newNote.save();
    await newNote.populate('primaryNotebookId', 'name color');

    // Update notebook note count
    await Notebook.findByIdAndUpdate(defaultNotebook._id, {
      $inc: { noteCount: 1 }
    });

    res.status(201).json(newNote);
  } catch (error) {
    console.error('Save shared note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk operations
router.post('/bulk', auth, async (req, res) => {
  try {
    const { action, noteIds, data } = req.body;

    const query = {
      _id: { $in: noteIds },
      userId: req.userId
    };

    let result;
    switch (action) {
      case 'delete':
        result = await Note.updateMany(query, {
          isDeleted: true,
          deletedAt: new Date()
        });
        break;
      case 'restore':
        result = await Note.updateMany(
          { ...query, isDeleted: true },
          { isDeleted: false, $unset: { deletedAt: 1 } }
        );
        break;
      case 'move':
        result = await Note.updateMany(query, {
          primaryNotebookId: data.primaryNotebookId
        });
        break;
      case 'tag':
        result = await Note.updateMany(query, {
          $addToSet: { tags: { $each: data.tags } }
        });
        break;
      case 'pin':
        result = await Note.updateMany(query, {
          isPinned: data.isPinned
        });
        break;
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    res.json({ message: `Bulk ${action} completed`, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Get share settings for a note
router.get('/:id/share', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const isOwner = note.userId.toString() === req.userId;
    const isCollaborator = note.collaborators && note.collaborators.some(c => c.userId.toString() === req.userId);
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json({
      settings: {
        isPublic: note.shareSettings?.isPublic || false,
        allowEdit: note.shareSettings?.allowEdit || false,
        allowComments: note.shareSettings?.allowComments || false,
        passwordProtected: note.shareSettings?.passwordProtected || false,
        password: note.shareSettings?.password || '',
        expiresAt: note.shareSettings?.expiresAt || ''
      },
      shareLink: `${req.protocol}://${req.get('host')}/note/${req.params.id}`
    });
  } catch (error) {
    console.error('Get share settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update share settings for a note
router.put('/:id/share', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const isOwner = note.userId.toString() === req.userId;
    const isCollaborator = note.collaborators && note.collaborators.some(c => c.userId.toString() === req.userId && (c.permission === 'admin' || c.permission === 'write'));
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { isPublic, allowEdit, allowComments, passwordProtected, password, expiresAt } = req.body;
    // Update share settings
    if (!note.shareSettings) {
      note.shareSettings = {};
    }
    note.shareSettings.isPublic = isPublic || false;
    note.shareSettings.allowEdit = allowEdit || false;
    note.shareSettings.allowComments = allowComments || false;
    note.shareSettings.passwordProtected = passwordProtected || false;
    note.shareSettings.password = password || '';
    note.shareSettings.expiresAt = expiresAt || '';
    await note.save();
    const updatedNote = await Note.findById(req.params.id);
    req.io.emit('note-shared', updatedNote);
    console.log('[SOCKET EMIT] note-shared', note._id, 'after share settings update');
    res.json({
      shareLink: `${req.protocol}://${req.get('host')}/note/${req.params.id}`,
      settings: note.shareSettings
    });
  } catch (error) {
    console.error('Update share settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get collaborators for a note
router.get('/:id/collaborators', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    
    // Populate collaborator details
    const populatedNote = await Note.findById(req.params.id)
      .populate('collaborators.userId', 'name email avatar');
    
    // Map permissions to frontend format
    const mappedCollaborators = (populatedNote.collaborators || []).map(collab => ({
      _id: collab._id,
      userId: collab.userId,
      email: collab.userId.email,
      permission: mapPermissionBack(collab.permission),
      status: 'pending',
      invitedAt: collab.addedAt
    }));
    
    res.json({
      collaborators: mappedCollaborators
    });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add collaborator to a note
router.post('/:id/collaborators', auth, async (req, res) => {
  console.log('[DEBUG] Entered POST /notes/:id/collaborators', req.body);
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) {
      console.log('[DEBUG] Note not found for collaborator add', req.params.id);
      return res.status(404).json({ message: 'Note not found' });
    }
    const { email, permission } = req.body;
    if (!email || !email.trim()) {
      console.log('[DEBUG] Email missing for collaborator add');
      return res.status(400).json({ message: 'Email is required' });
    }
    // Find user by email
    const User = mongoose.model('User');
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('[DEBUG] Collaborator user not found', email);
      return res.status(400).json({ message: 'User not found with this email address' });
    }
    // Prevent duplicate
    if (note.collaborators && note.collaborators.some(c => c.userId.toString() === user._id.toString())) {
      console.log('[DEBUG] Collaborator already exists', user._id);
      return res.status(400).json({ message: 'Collaborator already added' });
    }
    // Add collaborator
    note.collaborators = note.collaborators || [];
    note.collaborators.push({
      userId: user._id,
      permission: mapPermission(permission) || 'read',
      addedAt: new Date()
    });
    console.log('[DEBUG] Before save (add collaborator)', note.collaborators);
    await note.save();
    const updatedNoteWithCollab = await Note.findById(req.params.id);
    console.log('[DEBUG] After save (add collaborator)', note.collaborators);
    req.io.emit('collaborator-updated', updatedNoteWithCollab);
    console.log('[SOCKET EMIT] collaborator-updated', note._id, 'after DB update');
    res.json(note);
  } catch (err) {
    console.error('Add collaborator error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update collaborator permission
router.put('/:id/collaborators/:collaboratorId', auth, async (req, res) => {
  console.log('[DEBUG] Entered PUT /notes/:id/collaborators/:collaboratorId', req.body);
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) {
      console.log('[DEBUG] Note not found for collaborator update', req.params.id);
      return res.status(404).json({ message: 'Note not found' });
    }
    const { permission } = req.body;
    const collaborator = note.collaborators && note.collaborators.find(c => c._id.toString() === req.params.collaboratorId);
    if (!collaborator) {
      console.log('[DEBUG] Collaborator not found for update', req.params.collaboratorId);
      return res.status(404).json({ message: 'Collaborator not found' });
    }
    collaborator.permission = mapPermission(permission) || collaborator.permission;
    console.log('[DEBUG] Before save (update collaborator)', note.collaborators);
    await note.save();
    const updatedNoteWithCollab = await Note.findById(req.params.id);
    console.log('[DEBUG] After save (update collaborator)', note.collaborators);
    req.io.emit('collaborator-updated', updatedNoteWithCollab);
    console.log('[SOCKET EMIT] collaborator-updated', note._id, 'after DB update');
    res.json(note);
  } catch (err) {
    console.error('Update collaborator error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove collaborator from a note
router.delete('/:id/collaborators/:collaboratorId', auth, async (req, res) => {
  console.log('[DEBUG] Entered DELETE /notes/:id/collaborators/:collaboratorId');
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) {
      console.log('[DEBUG] Note not found for collaborator remove', req.params.id);
      return res.status(404).json({ message: 'Note not found' });
    }
    const beforeCount = note.collaborators ? note.collaborators.length : 0;
    note.collaborators = (note.collaborators || []).filter(c => c._id.toString() !== req.params.collaboratorId);
    const afterCount = note.collaborators.length;
    console.log(`[DEBUG] Collaborators before: ${beforeCount}, after: ${afterCount}`);
    await note.save();
    const updatedNoteAfterRemove = await Note.findById(req.params.id);
    console.log('[DEBUG] After save (remove collaborator)', note.collaborators);
    req.io.emit('collaborator-updated', updatedNoteAfterRemove);
    console.log('[SOCKET EMIT] collaborator-updated', note._id, 'after DB update');
    res.json(note);
  } catch (err) {
    console.error('Remove collaborator error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// List notes shared with the user
router.get('/shared/with-me', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      'collaborators.userId': req.userId,
      isDeleted: false
    }).populate('userId', 'name email');
    res.json(notes);
  } catch (error) {
    console.error('List shared with me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List notes shared by the user
router.get('/shared/by-me', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      userId: req.userId,
      'collaborators.0': { $exists: true },
      isDeleted: false
    }).populate('collaborators.userId', 'name email');
    res.json(notes);
  } catch (error) {
    console.error('List shared by me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk permanent delete
router.post('/bulk-permanent', auth, async (req, res) => {
  try {
    const { noteIds } = req.body;
    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ message: 'No noteIds provided' });
    }
    const result = await Note.deleteMany({
      _id: { $in: noteIds },
      userId: req.userId,
      isDeleted: true
    });
    res.json({ message: 'Notes permanently deleted', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Bulk permanent delete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add attachment to a note
router.post('/:id/attachments', auth, async (req, res) => {
  let note;
  try {
    console.log('▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒');
    console.log('[SERVER ATTACHMENT DEBUG] POST /api/notes/:id/attachments');
    console.log('[SERVER ATTACHMENT DEBUG] Timestamp:', new Date().toISOString());
    console.log('[SERVER ATTACHMENT DEBUG] Note ID:', req.params.id);
    console.log('[SERVER ATTACHMENT DEBUG] User ID:', req.userId);
    console.log('[SERVER ATTACHMENT DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[SERVER ATTACHMENT DEBUG] Attachment data:', req.body.attachment);
    
    console.log('[SERVER ATTACHMENT DEBUG] Finding note in database...');
    note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) {
      console.error('[SERVER ATTACHMENT DEBUG] ✗ Note not found:', req.params.id);
      return res.status(404).json({ message: 'Note not found' });
    }
    console.log('[SERVER ATTACHMENT DEBUG] ✓ Note found:', note.title);
    console.log('[SERVER ATTACHMENT DEBUG] Current attachments count:', Array.isArray(note.attachments) ? note.attachments.length : 0);
    
    const { attachment } = req.body; // expects { filename, originalName, url, type, size, uploadedAt }
    if (!attachment || !attachment.filename) {
      console.error('[SERVER ATTACHMENT DEBUG] ✗ Invalid attachment data');
      return res.status(400).json({ message: 'Invalid attachment data' });
    }
    console.log('[SERVER ATTACHMENT DEBUG] ✓ Attachment data valid:', {
      filename: attachment.filename,
      originalName: attachment.originalName,
      url: attachment.url,
      type: attachment.type,
      size: attachment.size
    });
    
    // Add attachment to note using findByIdAndUpdate to bypass schema caching issues
    console.log('[SERVER ATTACHMENT DEBUG] Adding attachment to note array...');
    // Convert uploadedAt to Date if it's a string
    const attachmentData = {
      filename: attachment.filename,
      originalName: attachment.originalName,
      url: attachment.url,
      type: attachment.type,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt ? new Date(attachment.uploadedAt) : new Date()
    };
    console.log('[SERVER ATTACHMENT DEBUG] Formatted attachment data:', attachmentData);
    
    // Use direct MongoDB update to completely bypass Mongoose validation
    console.log('[SERVER ATTACHMENT DEBUG] Using direct MongoDB $push operation...');
    try {
      // Use the native MongoDB driver to bypass all Mongoose validation
      const result = await Note.collection.updateOne(
        { _id: note._id },
        { 
          $push: { attachments: attachmentData }
        }
      );
      
      console.log('[SERVER ATTACHMENT DEBUG] MongoDB update result:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      });
      
      if (result.modifiedCount === 0) {
        console.error('[SERVER ATTACHMENT DEBUG] ✗ Failed to update note - no documents modified');
        return res.status(500).json({ message: 'Failed to update note with attachment' });
      }
      
      console.log('[SERVER ATTACHMENT DEBUG] ✓ Note updated with new attachment via direct MongoDB operation');
      
      // Fetch the updated note using lean() to avoid validation errors
      const updatedNote = await Note.findById(req.params.id).lean();
      console.log('[SERVER ATTACHMENT DEBUG] Fetched updated note, attachments count:', (updatedNote && Array.isArray(updatedNote.attachments)) ? updatedNote.attachments.length : 0);
      
      // Fix attachments if needed (in case they're corrupted)
      if (updatedNote && updatedNote.attachments && typeof updatedNote.attachments === 'string') {
        const fixedAttachments = fixAttachments(updatedNote.attachments);
        const attachmentsForDB = fixedAttachments.map(att => ({
          ...att,
          uploadedAt: att.uploadedAt instanceof Date ? att.uploadedAt : new Date(att.uploadedAt || Date.now())
        }));
        await Note.collection.updateOne(
          { _id: updatedNote._id },
          { $set: { attachments: attachmentsForDB } }
        );
        updatedNote.attachments = fixedAttachments;
      }
      
      // Convert to proper format for response
      const noteForResponse = {
        ...updatedNote,
        attachments: Array.isArray(updatedNote.attachments) ? updatedNote.attachments : []
      };
      
      // Update the note variable for the rest of the code
      note = noteForResponse;
    } catch (updateError) {
      console.error('[SERVER ATTACHMENT DEBUG] ✗ Direct MongoDB update failed:', updateError);
      throw updateError;
    }
    
    // Also create a File record so it appears in Files page
    console.log('[SERVER ATTACHMENT DEBUG] Step 2: Creating File record...');
    const File = (await import('../models/File.js')).default;
    
    // Check if File record already exists to prevent duplicates
    console.log('[SERVER ATTACHMENT DEBUG] Checking for existing File record...');
    const existingFile = await File.findOne({ 
      url: attachment.url,
      uploadedBy: req.userId 
    });
    
    if (!existingFile) {
      console.log('[SERVER ATTACHMENT DEBUG] No existing File record, creating new one...');
      // Use absolute path that matches the upload route
      const uploadsDir = path.join(__dirname, '../uploads');
      const filePath = path.join(uploadsDir, attachment.filename);
      
      console.log('[SERVER ATTACHMENT DEBUG] File path:', filePath);
      
      // Verify the file actually exists on disk
      console.log('[SERVER ATTACHMENT DEBUG] Verifying file exists on disk...');
      try {
        await fs.access(filePath);
        console.log('[SERVER ATTACHMENT DEBUG] ✓ File exists on disk at:', filePath);
      } catch (fsError) {
        console.error('[SERVER ATTACHMENT DEBUG] ✗ File does not exist at path:', filePath);
        console.error('[SERVER ATTACHMENT DEBUG] File system error:', fsError.message);
        // Don't fail the request, just log the error
        // The file should have been saved by the upload route
      }
      
      // Create new file record
      const fileRecordData = {
        name: attachment.originalName || attachment.filename,
        originalName: attachment.originalName || attachment.filename,
        mimetype: attachment.type,
        size: attachment.size,
        path: filePath,
        url: attachment.url,
        description: `Attachment from note: ${note.title}`,
        tags: [],
        uploadedBy: req.userId,
        workspace: note.workspaceId || null,
        notebook: note.primaryNotebookId || null
      };
      
      console.log('[SERVER ATTACHMENT DEBUG] File record data:', JSON.stringify(fileRecordData, null, 2));
      
      console.log('[SERVER ATTACHMENT DEBUG] Saving File record to database...');
      const newFile = new File(fileRecordData);
      await newFile.save();
      console.log('[SERVER ATTACHMENT DEBUG] ✓ File record created successfully:', newFile._id);
    } else {
      console.log('[SERVER ATTACHMENT DEBUG] File record already exists:', existingFile._id);
    }
    
    console.log('[SERVER ATTACHMENT DEBUG] ✓✓✓ All steps complete!');
    console.log('[SERVER ATTACHMENT DEBUG] Returning attachments array, length:', (note && Array.isArray(note.attachments)) ? note.attachments.length : 0);
    console.log('[SERVER ATTACHMENT DEBUG] Sending success response');
    console.log('▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒');
    // Return attachments array - ensure it's always an array
    const attachmentsToReturn = note && Array.isArray(note.attachments) 
      ? note.attachments 
      : (note && typeof note.attachments === 'string' 
          ? fixAttachments(note.attachments) 
          : []);
    
    res.json(attachmentsToReturn);
  } catch (error) {
    console.error('▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒');
    console.error('[SERVER ATTACHMENT DEBUG] ✗✗✗ Error occurred!');
    console.error('[SERVER ATTACHMENT DEBUG] Error:', error);
    console.error('[SERVER ATTACHMENT DEBUG] Error message:', error.message);
    console.error('[SERVER ATTACHMENT DEBUG] Error stack:', error.stack);
    console.error('[SERVER ATTACHMENT DEBUG] Error code:', error.code);
    
    // If it's a duplicate key error, that's okay - just return success
    if (error.code === 11000 || error.message?.includes('duplicate')) {
      console.log('[SERVER ATTACHMENT DEBUG] Duplicate file record detected, continuing...');
      if (note && note.attachments) {
        console.log('[SERVER ATTACHMENT DEBUG] Returning attachments despite duplicate');
        console.error('▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒');
        return res.json(note.attachments);
      }
    }
    
    console.error('[SERVER ATTACHMENT DEBUG] Sending error response');
    console.error('▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒');
    res.status(500).json({ message: 'Failed to add attachment', error: error.message });
  }
});

// Remove attachment from a note
router.delete('/:id/attachments/:filename', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    const filename = req.params.filename;
    console.log('[DELETE ATTACHMENT] Attempting to delete:', { noteId: req.params.id, filename, userId: req.userId });
    
    // Initialize attachments array if it doesn't exist
    if (!note.attachments || !Array.isArray(note.attachments)) {
      console.log('[DELETE ATTACHMENT] Note has no attachments array, initializing');
      note.attachments = [];
      await note.save();
      // Still try to delete the file from disk and File record
    } else {
      const attachmentIndex = note.attachments.findIndex(att => att.filename === filename);
      if (attachmentIndex === -1) {
        console.log('[DELETE ATTACHMENT] Attachment not found in note.attachments, but will still delete file');
        // Don't return 404 - still try to delete the file from disk and File record
      } else {
        // Remove from array
        note.attachments.splice(attachmentIndex, 1);
        await note.save();
        console.log('[DELETE ATTACHMENT] Removed attachment from note, remaining:', note.attachments.length);
      }
    }
    
    // Always try to delete the File record and physical file
    const File = (await import('../models/File.js')).default;
    
    // Try to find file record by multiple criteria (filename is most reliable)
    let fileRecord = null;
    
    // First try: exact filename match (most reliable)
    fileRecord = await File.findOneAndDelete({ 
      $or: [
        { url: `/uploads/${filename}` },
        { path: { $regex: filename, $options: 'i' } },
        { name: filename },
        { originalName: filename }
      ],
      uploadedBy: req.userId 
    });
    
    if (fileRecord) {
      console.log('[DELETE ATTACHMENT] ✓ Deleted File record by filename:', fileRecord._id, {
        url: fileRecord.url,
        path: fileRecord.path,
        name: fileRecord.name
      });
    } else {
      // Second try: without user constraint (in case of data inconsistency)
      fileRecord = await File.findOneAndDelete({ 
        $or: [
          { url: `/uploads/${filename}` },
          { path: { $regex: filename, $options: 'i' } },
          { name: filename },
          { originalName: filename }
        ]
      });
      
      if (fileRecord) {
        console.log('[DELETE ATTACHMENT] ✓ Deleted File record (without user constraint):', fileRecord._id);
      } else {
        console.log('[DELETE ATTACHMENT] ⚠️ No File record found to delete for filename:', filename);
        console.log('[DELETE ATTACHMENT] Searched for:', {
          url: `/uploads/${filename}`,
          filename: filename
        });
      }
    }
    
    // Delete file from disk
    const filePath = path.join(process.cwd(), 'server/uploads', filename);
    try {
      await fs.unlink(filePath);
      console.log('[DELETE ATTACHMENT] ✓ Deleted file from disk:', filename);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('[DELETE ATTACHMENT] File not found on disk (already deleted):', filename);
      } else {
        console.error('[DELETE ATTACHMENT] Error deleting file from disk:', err);
      }
    }
    
    res.json({ 
      message: 'Attachment deleted successfully',
      attachments: note.attachments || []
    });
  } catch (error) {
    console.error('[DELETE ATTACHMENT] Remove attachment error:', error);
    res.status(500).json({ message: 'Failed to remove attachment', error: error.message });
  }
});

// Get backlinks for a note
router.get('/:id/backlinks', auth, async (req, res) => {
  try {
    const noteId = req.params.id;
    // Find notes that link to this note (by noteId in content)
    // Looks for /notes?note=NOTE_ID or data-note-id="NOTE_ID"
    const regex = new RegExp(`(\\?note=${noteId}|data-note-id=\\"${noteId}\\")`, 'i');
    const backlinks = await Note.find({
      userId: req.userId,
      isDeleted: false,
      content: { $regex: regex }
    }, 'title _id');
    res.json(backlinks);
  } catch (error) {
    console.error('Get backlinks error:', error);
    res.status(500).json({ message: 'Failed to fetch backlinks' });
  }
});

// Export notes
router.post('/export', auth, async (req, res) => {
  try {
    const { noteIds, format } = req.body;
    if (!Array.isArray(noteIds) || !format) {
      return res.status(400).json({ message: 'Missing noteIds or format' });
    }
    const notes = await Note.find({ _id: { $in: noteIds }, userId: req.userId });
    let data, mime, ext;
    if (format === 'json') {
      data = JSON.stringify(notes, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else if (format === 'txt') {
      data = notes.map(n => `${n.title}\n${n.plainTextContent}`).join('\n\n---\n\n');
      mime = 'text/plain';
      ext = 'txt';
    } else if (format === 'md') {
      data = notes.map(n => `# ${n.title}\n\n${n.plainTextContent}`).join('\n\n---\n\n');
      mime = 'text/markdown';
      ext = 'md';
    } else {
      return res.status(400).json({ message: 'Unsupported format' });
    }
    res.setHeader('Content-Disposition', `attachment; filename=notes-export.${ext}`);
    res.setHeader('Content-Type', mime);
    res.send(data);
  } catch (error) {
    console.error('Export notes error:', error);
    res.status(500).json({ message: 'Failed to export notes' });
  }
});

// Import notes
router.post('/import', auth, upload.single('file'), async (req, res) => {
  try {
    const { format } = req.body;
    const file = req.file;
    if (!file || !format) {
      return res.status(400).json({ message: 'Missing file or format' });
    }
    const content = await fs.readFile(file.path, 'utf-8');
    let notes = [];
    if (format === 'json') {
      notes = JSON.parse(content);
    } else if (format === 'txt' || format === 'md') {
      // Split by ---
      const rawNotes = content.split(/\n---\n/);
      notes = rawNotes.map(raw => {
        const [title, ...body] = raw.trim().split('\n');
        return {
          title: title.replace(/^# /, '').trim() || 'Untitled',
          content: body.join('\n').trim(),
          plainTextContent: body.join('\n').trim(),
        };
      });
    } else {
      return res.status(400).json({ message: 'Unsupported format' });
    }
    // Create notes for user
    for (const n of notes) {
      await Note.create({
        title: n.title || 'Untitled',
        content: n.content || '',
        plainTextContent: n.plainTextContent || '',
        userId: req.userId,
        primaryNotebookId: n.primaryNotebookId || undefined,
        notebookIds: n.notebookIds || [n.primaryNotebookId || undefined],
        tags: n.tags || [],
      });
    }
    // Remove uploaded file
    await fs.unlink(file.path);
    res.json({ message: 'Notes imported successfully', count: notes.length });
  } catch (error) {
    console.error('Import notes error:', error);
    res.status(500).json({ message: 'Failed to import notes' });
  }
});

// Get shared note (public access or collaborator)
router.get('/:id/shared', async (req, res) => {
  try {
    console.log('[DEBUG] Shared note request for ID:', req.params.id);
    
    // Require authentication for all shared note access
    let userId = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
        console.log('[DEBUG] Authenticated user ID:', userId);
      } catch (e) {
        console.log('[DEBUG] JWT verification failed:', e.message);
        return res.status(403).json({ message: 'Authentication required to view shared notes.' });
      }
    } else {
      console.log('[DEBUG] No authorization header provided');
      return res.status(403).json({ message: 'Authentication required to view shared notes.' });
    }

    const note = await Note.findById(req.params.id)
      .populate('userId', 'name email')
      .select('-__v');
    
    if (!note) {
      console.log('[DEBUG] Note not found in database:', req.params.id);
      return res.status(404).json({ message: 'Note not found' });
    }

    console.log('[DEBUG] Note found:', {
      id: note._id,
      title: note.title,
      ownerId: note.userId._id,
      isPublic: note.shareSettings?.isPublic,
      collaborators: note.collaborators?.length || 0
    });

    // Check if note is public
    const isPublic = note.shareSettings?.isPublic;
    
    // Check if user is a collaborator or owner (if logged in)
    let isCollaborator = false;
    let isOwner = false;
    
    // Check if user is the owner
    isOwner = note.userId._id.toString() === userId;
    // Check if user is a collaborator
    isCollaborator = note.collaborators && note.collaborators.some(c => {
      if (!c.userId) return false;
      if (typeof c.userId.equals === 'function') {
        return c.userId.equals(userId);
      }
      return c.userId.toString() === userId;
    });

    console.log('[DEBUG] Access check:', {
      isOwner,
      isCollaborator,
      isPublic,
      userId,
      ownerId: note.userId._id.toString()
    });

    // Determine edit access and permission level
    let canEdit = false;
    let permission = 'none';
    let canSave = false;
    
    if (isOwner) {
      canEdit = true; // Owner always has edit access
      permission = 'owner';
      canSave = true; // Owner can always save
    } else if (isCollaborator) {
      // Find collaborator permission
      const collab = note.collaborators.find(c => c.userId.toString() === userId);
      if (collab) {
        permission = collab.permission;
        canEdit = collab.permission === 'admin' || collab.permission === 'write';
        canSave = collab.permission === 'admin'; // Only admin can save to their account
      }
    } else if (isPublic && note.shareSettings?.allowEdit) {
      canEdit = true;
      permission = 'public';
      canSave = true; // Public edit access can save
    }

    console.log('[DEBUG] Final access granted:', {
      canEdit,
      permission,
      canSave,
      hasYjsUpdate: !!note.yjsUpdate
    });

    // Return the note with access information (always up-to-date)
    const noteObject = note.toObject();
    try {
      noteObject.yjsUpdate = note.yjsUpdate ? note.yjsUpdate.toString('base64') : undefined;
    } catch(e) {
      console.error('[DEBUG] Error converting yjsUpdate to base64:', e);
      noteObject.yjsUpdate = undefined;
    }

    res.json({
      note: {
        ...noteObject,
        owner: {
          name: note.userId.name,
          email: note.userId.email
        }
      },
      access: {
        canEdit,
        canComment: note.shareSettings?.allowComments || false,
        isExpired: false,
        requiresPassword: false,
        permission,
        canSave
      }
    });
  } catch (error) {
    console.error('Get shared note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify password for shared note
router.post('/:id/shared/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const note = await Note.findById(req.params.id)
      .populate('userId', 'name email')
      .select('-__v');
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if note is shared and password protected
    if (!note.shareSettings?.isPublic || !note.shareSettings?.passwordProtected) {
      return res.status(400).json({ message: 'Note is not password protected' });
    }

    // Check if note has expired
    if (note.shareSettings.expiresAt && new Date() > new Date(note.shareSettings.expiresAt)) {
      return res.status(410).json({ message: 'This shared note has expired' });
    }

    // Verify password
    if (note.shareSettings.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Store verification in session (if using sessions) or return success
    if (!req.session) req.session = {};
    if (!req.session.verifiedNotes) req.session.verifiedNotes = [];
    req.session.verifiedNotes.push(note._id.toString());

    // Return the note with access information
    res.json({
      note: {
        _id: note._id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        shareSettings: note.shareSettings,
        owner: {
          name: note.userId.name,
          email: note.userId.email
        }
      },
      access: {
        canEdit: note.shareSettings.allowEdit,
        canComment: note.shareSettings.allowComments,
        isExpired: false,
        requiresPassword: false
      }
    });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH endpoint to save canonical Yjs update
router.patch('/:id/yjs-update', auth, async (req, res) => {
  try {
    // Use lean() to fetch without Mongoose validation to avoid attachment validation errors
    const note = await Note.findById(req.params.id).lean();
    if (!note) return res.status(404).json({ message: 'Note not found' });
    
    const { yjsUpdate } = req.body;
    if (!yjsUpdate) return res.status(400).json({ message: 'Missing yjsUpdate' });
    
    const yjsBuffer = Buffer.from(yjsUpdate, 'base64');
    // MongoDB document size limit is 16MB
    if (yjsBuffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ message: 'Yjs update too large to save' });
    }
    
    // Use direct MongoDB update to bypass Mongoose validation completely
    // This prevents validation errors with attachments or other fields
    // Decode Yjs to derive title/preview for list view updates
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, new Uint8Array(yjsBuffer));
    const yTitle = ydoc.getText('title');
    const derivedTitle = (yTitle?.toString() || '').trim() || 'Untitled';
    const plainText = extractPlainTextFromYjs(yjsUpdate);
    const preview = plainText.length > 200 ? `${plainText.slice(0, 200)}...` : plainText;

    const updatedAt = new Date();
    await Note.collection.updateOne(
      { _id: note._id },
      { 
        $set: { 
          yjsUpdate: yjsBuffer,
          title: derivedTitle,
          preview,
          updatedAt
        }
      }
    );
    
    // Broadcast once per Yjs save instead of every keystroke
    if (req.io) {
      const broadcastPayload = {
        _id: note._id.toString(),
        noteId: note._id.toString(),
        title: derivedTitle,
        preview,
        updatedAt
      };
      req.io.to(`note-${note._id}`).emit('note-updated', broadcastPayload);
      req.io.emit('note-updated', broadcastPayload);
    }
    
    res.json({ message: 'Yjs update saved', title: derivedTitle, preview });
  } catch (error) {
    console.error('[YJS UPDATE ERROR] Save Yjs update error:', error);
    console.error('[YJS UPDATE ERROR] Error details:', {
      message: error.message,
      stack: error.stack,
      noteId: req.params.id
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle shortcut status for a note
router.patch('/:id/shortcut', auth, async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isShortcut: req.body.isShortcut },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.json(note);
  } catch (error) {
    console.error('Toggle shortcut error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;