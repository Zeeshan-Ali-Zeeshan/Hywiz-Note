import express from 'express';
import auth from '../middleware/auth.js';
import Workspace from '../models/Workspace.js';
import Notebook from '../models/Notebook.js';
import Note from '../models/Note.js';
import User from '../models/User.js';

const router = express.Router();

// Get all workspaces for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    // Return both workspaces owned by the user and those shared with the user
    const workspaces = await Workspace.find({
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId }
      ]
    })
      .sort({ sortOrder: 1, createdAt: -1 });
    
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific workspace with its notebooks and notes
router.get('/:id', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Check if user has access to this workspace
    if (workspace.userId.toString() !== req.userId && 
        !workspace.collaborators.some(c => c.userId.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get notebooks in this workspace
    const notebooks = await Notebook.find({ workspaceId: workspace._id })
      .sort({ sortOrder: 1, createdAt: -1 });
    
    // Get notes in this workspace
    const notes = await Note.find({ workspaceId: workspace._id, isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(10); // Limit to recent notes for performance
    
    res.json({
      workspace,
      notebooks,
      notes
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new workspace
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, icon, color, isDefault } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Workspace name is required' });
    }
    
    // If this is set as default, unset any existing default workspace
    if (isDefault) {
      await Workspace.updateMany(
        { userId: req.userId },
        { isDefault: false }
      );
    }
    
    const workspace = new Workspace({
      name,
      description: description || '',
      icon: icon || 'briefcase',
      color: color || '#3B82F6',
      isDefault: isDefault || false,
      userId: req.userId,
      sortOrder: Date.now() // Use timestamp for sorting
    });
    
    await workspace.save();
    
    res.status(201).json(workspace);
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a workspace
router.put('/:id', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Check if user has access to this workspace
    if (workspace.userId.toString() !== req.userId && 
        !workspace.collaborators.some(c => c.userId.toString() === req.userId && c.permission === 'admin')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { name, description, icon, color, isDefault, settings } = req.body;
    
    // If this is set as default, unset any existing default workspace
    if (isDefault && !workspace.isDefault) {
      await Workspace.updateMany(
        { userId: req.userId },
        { isDefault: false }
      );
    }
    
    // Update fields
    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (icon !== undefined) workspace.icon = icon;
    if (color !== undefined) workspace.color = color;
    if (isDefault !== undefined) workspace.isDefault = isDefault;
    if (settings !== undefined) workspace.settings = { ...workspace.settings, ...settings };
    
    await workspace.save();
    
    res.json(workspace);
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a workspace
router.delete('/:id', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Check if user owns this workspace
    if (workspace.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if this is the default workspace
    if (workspace.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default workspace' });
    }
    
    // Check if workspace has notebooks or notes
    const notebookCount = await Notebook.countDocuments({ workspaceId: workspace._id });
    const noteCount = await Note.countDocuments({ workspaceId: workspace._id });
    
    if (notebookCount > 0 || noteCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete workspace with notebooks or notes. Please move or delete them first.' 
      });
    }
    
    await workspace.deleteOne();
    
    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get workspace statistics
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Check if user has access to this workspace
    if (workspace.userId.toString() !== req.userId && 
        !workspace.collaborators.some(c => c.userId.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get counts
    const notebookCount = await Notebook.countDocuments({ workspaceId: workspace._id });
    const noteCount = await Note.countDocuments({ workspaceId: workspace._id, isDeleted: false });
    const pinnedNoteCount = await Note.countDocuments({ 
      workspaceId: workspace._id, 
      isPinned: true, 
      isDeleted: false 
    });
    
    // Get recent activity
    const recentNotes = await Note.find({ workspaceId: workspace._id, isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title updatedAt');
    
    res.json({
      notebookCount,
      noteCount,
      pinnedNoteCount,
      recentNotes
    });
  } catch (error) {
    console.error('Error fetching workspace stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add collaborator to workspace
router.post('/:id/collaborators', auth, async (req, res) => {
  try {
    const { userId, email, permission, scope = 'all', notebookIds = [] } = req.body;
    if ((!userId && !email) || !permission) {
      return res.status(400).json({ message: 'User (id or email) and permission are required' });
    }
    
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Check if user owns this workspace
    if (workspace.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Resolve user by email if provided
    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      resolvedUserId = user._id.toString();
    }

    // Check if collaborator already exists
    const existingCollaborator = workspace.collaborators.find(
      c => c.userId.toString() === resolvedUserId
    );
    
    if (existingCollaborator) {
      existingCollaborator.permission = permission;
      existingCollaborator.scope = scope === 'selected' ? 'selected' : 'all';
      existingCollaborator.notebookIds = scope === 'selected' ? notebookIds : [];
    } else {
      workspace.collaborators.push({ 
        userId: resolvedUserId, 
        permission, 
        scope: scope === 'selected' ? 'selected' : 'all',
        notebookIds: scope === 'selected' ? notebookIds : []
      });
    }
    
    await workspace.save();
    // Emit real-time update
    req.io.emit('workspace-updated', { workspace });
    res.json(workspace);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove collaborator from workspace
router.delete('/:id/collaborators/:collaboratorId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Check if user owns this workspace
    if (workspace.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    workspace.collaborators = workspace.collaborators.filter(
      c => c.userId.toString() !== req.params.collaboratorId
    );
    
    await workspace.save();
    // Emit real-time update
    req.io.emit('workspace-updated', { workspace });
    res.json(workspace);
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 