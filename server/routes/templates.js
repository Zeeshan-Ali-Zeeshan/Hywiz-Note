import express from 'express';
import Template from '../models/Template.js';
import User from '../models/User.js';
import Tag from '../models/Tag.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// GET /api/templates/test-socket - Test socket connection (must be before /:id routes)
router.get('/test-socket', async (req, res) => {
  try {
    console.log('Backend: Testing socket connection');
    req.io.emit('test-event', { message: 'Socket test successful', timestamp: new Date().toISOString() });
    res.json({ message: 'Test event emitted' });
  } catch (error) {
    console.error('Error testing socket:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates - Get all templates for the authenticated user
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      tags = '',
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      isPinned,
      isArchived,
      isPublic
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isDeleted: false, userId: req.userId };

    // Add search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add tags filter
    if (tags) {
      const tagIds = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagIds };
    }

    // Add boolean filters
    if (isPinned !== undefined) {
      query.isPinned = isPinned === 'true';
    }
    if (isArchived !== undefined) {
      query.isArchived = isArchived === 'true';
    }
    if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const templates = await Template.find(query)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .populate('collaborators.userId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Template.countDocuments(query);

    res.json({
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/public - Get public templates
router.get('/public', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      tags = '',
      sortBy = 'rating',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { 
      isDeleted: false,
      isPublic: true
    };

    // Add search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add tags filter
    if (tags) {
      const tagIds = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagIds };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const templates = await Template.find(query)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Template.countDocuments(query);

    res.json({
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching public templates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/:id - Get a specific template
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId },
        { isPublic: true }
      ]
    })
    .populate('userId', 'name email')
    .populate('tags', 'name color')
    .populate('collaborators.userId', 'name email');

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Usage tracking removed - all content is now in Yjs

    // Determine edit access
    let canEdit = false;
    if (template.userId._id.toString() === req.userId) {
      canEdit = true;
    } else if (
      template.collaborators &&
      template.collaborators.some(
        c => c.userId && c.userId._id && c.userId._id.toString() === req.userId && c.permission === 'write'
      )
    ) {
      canEdit = true;
    }

    // --- Return yjsUpdate as base64 string and fallback content ---
    const templateObj = template.toObject();
    try {
      templateObj.yjsUpdate = template.yjsUpdate ? template.yjsUpdate.toString('base64') : undefined;
    } catch (err) {
      templateObj.yjsUpdate = undefined;
      templateObj.yjsError = 'Corrupted Yjs data';
    }
    templateObj.fallbackContent = ''; // Content is now stored in YJS
    templateObj.fallbackPlainText = ''; // Plain text content is now derived from YJS

    res.json({
      ...templateObj,
      access: { canEdit }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates - Create a new template
router.post('/', async (req, res) => {
  try {
    const {
      tags,
      isPublic,
      yjsUpdate // <-- Accept yjsUpdate (contains title and content)
    } = req.body;

    let yjsUpdateBuffer = undefined;
    if (yjsUpdate) {
      yjsUpdateBuffer = Buffer.from(yjsUpdate, 'base64');
    } else {
      // Generate empty yjsUpdate with empty title and content
      try {
        const Y = require('yjs');
        const ydoc = new Y.Doc();
        
        // Initialize empty title
        const yTitle = ydoc.getXmlFragment('title');
        yTitle.insert(0, [{ type: 'paragraph', content: [{ type: 'text', text: 'Untitled Template' }] }]);
        
        // Initialize empty content
        const yContent = ydoc.getXmlFragment('default');
        yContent.insert(0, [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]);
        
        yjsUpdateBuffer = Buffer.from(Y.encodeStateAsUpdate(ydoc));
      } catch (e) {
        console.error('[YJS] Failed to generate initial Yjs update for template:', e);
      }
    }

    const template = new Template({
      title: 'Untitled Template', // Fallback title
      tags: tags || [],
      userId: req.userId,
      isPublic: isPublic || false,
      yjsUpdate: yjsUpdateBuffer
    });

    await template.save();

    const populatedTemplate = await Template.findById(template._id)
      .populate('userId', 'name email')
      .populate('tags', 'name color');

    req.io.emit('template-created', { template: populatedTemplate, userId: req.userId });

    res.status(201).json(populatedTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/templates/:id - Update a template
router.put('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId, 'collaborators.permission': { $in: ['write', 'admin'] } }
      ]
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found or access denied' });
    }

    const updateData = { ...req.body };
    delete updateData.userId;
    delete updateData.collaborators;
    delete updateData.shareLink;

    // Handle yjsUpdate update
    if (updateData.yjsUpdate) {
      template.yjsUpdate = Buffer.from(updateData.yjsUpdate, 'base64');
      delete updateData.yjsUpdate;
    }

    Object.assign(template, updateData);
    await template.save();

    const updatedTemplate = await Template.findById(template._id)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .populate('collaborators.userId', 'name email');

    req.io.emit('template-updated', { template: updatedTemplate, userId: req.userId });

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH endpoint to save canonical Yjs update for a template
router.patch('/:id/yjs-update', auth, async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId, 'collaborators.permission': { $in: ['write', 'admin'] } }
      ]
    });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found or access denied' });
    }
    const { yjsUpdate } = req.body;
    if (!yjsUpdate) return res.status(400).json({ message: 'Missing yjsUpdate' });
    const yjsBuffer = Buffer.from(yjsUpdate, 'base64');
    // MongoDB document size limit is 16MB
    if (yjsBuffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ message: 'Yjs update too large to save' });
    }
    if (template._yjsLock) {
      return res.status(429).json({ message: 'Another Yjs update is in progress' });
    }
    template._yjsLock = true;
    template.yjsUpdate = yjsBuffer;
    await template.save();
    template._yjsLock = false;
    res.json({ message: 'Yjs update saved' });
  } catch (error) {
    console.error('Save Yjs update error (template):', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/templates/:id - Delete a template (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId, 'collaborators.permission': 'admin' }
      ]
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found or access denied' });
    }

    template.isDeleted = true;
    await template.save();

    // Emit real-time update
    req.io.emit('template-deleted', { templateId: req.params.id, userId: req.userId });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/duplicate - Duplicate a template
router.post('/:id/duplicate', async (req, res) => {
  try {
    const originalTemplate = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId },
        { isPublic: true }
      ]
    });

    if (!originalTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const duplicatedTemplate = new Template({
      title: `${originalTemplate.title} (Copy)`, // Fallback title
      tags: originalTemplate.tags,
      userId: req.userId,
      isPublic: false,
      yjsUpdate: originalTemplate.yjsUpdate
    });

    await duplicatedTemplate.save();

    const populatedTemplate = await Template.findById(duplicatedTemplate._id)
      .populate('userId', 'name email')
      .populate('tags', 'name color');

    res.status(201).json(populatedTemplate);
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/create-note - Create note from template
router.post('/:id/create-note', auth, async (req, res) => {
  try {
    const { notebookId, workspaceId } = req.body;
    
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId },
        { isPublic: true }
      ]
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Get target notebook and workspace
    const Note = require('../models/Note');
    const Notebook = require('../models/Notebook');
    
    let targetNotebookId = notebookId;
    let targetWorkspaceId = workspaceId;

    if (notebookId) {
      // Verify the notebook exists and user has access
      const notebook = await Notebook.findOne({
        _id: notebookId,
        $or: [
          { userId: req.userId },
          { 'collaborators.userId': req.userId }
        ]
      });
      
      if (!notebook) {
        return res.status(404).json({ message: 'Notebook not found or access denied' });
      }
      
      targetNotebookId = notebook._id;
      targetWorkspaceId = notebook.workspaceId;
    } else {
      // Use user's default notebook
      const defaultNotebook = await Notebook.findOne({
        userId: req.userId,
        isDefault: true
      });
      
      if (!defaultNotebook) {
        return res.status(404).json({ message: 'Default notebook not found' });
      }
      
      targetNotebookId = defaultNotebook._id;
      targetWorkspaceId = defaultNotebook.workspaceId;
    }

    const newNote = new Note({
      title: template.title,
      content: '', // Content will be in YJS
      plainTextContent: '',
      userId: req.userId,
      primaryNotebookId: targetNotebookId,
      notebookIds: [targetNotebookId],
      workspaceId: targetWorkspaceId,
      tags: [...template.tags],
      yjsUpdate: template.yjsUpdate // Copy YJS data from template
    });

    await newNote.save();
    await newNote.populate('primaryNotebookId', 'name color');

    // Update notebook note count
    await Notebook.findByIdAndUpdate(targetNotebookId, {
      $inc: { noteCount: 1 }
    });

    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note from template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/pin - Pin/unpin a template
router.post('/:id/pin', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      userId: req.userId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    template.isPinned = !template.isPinned;
    await template.save();

    res.json({ isPinned: template.isPinned });
  } catch (error) {
    console.error('Error pinning template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/archive - Archive/unarchive a template
router.post('/:id/archive', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      userId: req.userId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    template.isArchived = !template.isArchived;
    await template.save();

    res.json({ isArchived: template.isArchived });
  } catch (error) {
    console.error('Error archiving template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/share - Share a template
router.post('/:id/share', async (req, res) => {
  try {
    const { isPublic, shareExpiry } = req.body;

    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      userId: req.userId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    template.isPublic = isPublic;
    if (shareExpiry) {
      template.shareExpiry = new Date(shareExpiry);
    }
    
    if (isPublic && !template.shareLink) {
      template.generateShareLink();
    }

    await template.save();

    // Get updated template with populated fields for socket event
    const updatedTemplate = await Template.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .populate('collaborators.userId', 'name email');

    // Emit socket event for real-time updates (matching notes implementation)
    console.log('Backend: Emitting template-updated event for share settings', {
      templateId: template._id,
      isPublic: updatedTemplate.isPublic,
      collaboratorsCount: updatedTemplate.collaborators?.length
    });
    req.io.emit('template-updated', { template: updatedTemplate });

    res.json({
      isPublic: template.isPublic,
      shareLink: template.shareLink,
      shareExpiry: template.shareExpiry
    });
  } catch (error) {
    console.error('Error sharing template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/collaborators - Add a collaborator
router.post('/:id/collaborators', async (req, res) => {
  try {
    console.log('Backend: Adding collaborator to template', { templateId: req.params.id, email: req.body.email });
    
    const { email, permission = 'read' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      userId: req.userId
    });

    if (!template) {
      console.log('Backend: Template not found for collaborator addition', { templateId: req.params.id });
      return res.status(404).json({ message: 'Template not found' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('Backend: User not found for collaborator addition', { email });
      return res.status(400).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.userId) {
      console.log('Backend: Cannot add self as collaborator', { userId: req.userId });
      return res.status(400).json({ message: 'Cannot add yourself as a collaborator' });
    }

    // Check if user is already a collaborator
    const existingCollaborator = template.collaborators.find(
      c => c.userId.toString() === user._id.toString()
    );

    if (existingCollaborator) {
      console.log('Backend: User already a collaborator', { email, templateId: req.params.id });
      return res.status(400).json({ message: 'This user is already a collaborator on this template' });
    }

    console.log('Backend: Adding collaborator', { email, permission, templateId: req.params.id });
    await template.addCollaborator(user._id, permission);

    const updatedTemplate = await Template.findById(template._id)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .populate('collaborators.userId', 'name email');

    // Emit collaborator-updated event for real-time updates (like notes)
    console.log('Backend: Emitting collaborator-updated event for collaborator addition', {
      templateId: template._id,
      isPublic: updatedTemplate.isPublic,
      collaboratorsCount: updatedTemplate.collaborators?.length,
      socketConnected: req.io ? 'yes' : 'no'
    });
    req.io.emit('collaborator-updated', updatedTemplate);

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/templates/:id/collaborators/:userId - Update collaborator permission
router.put('/:id/collaborators/:userId', async (req, res) => {
  try {
    const { permission } = req.body;

    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      userId: req.userId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    await template.updateCollaboratorPermission(req.params.userId, permission);

    const updatedTemplate = await Template.findById(template._id)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .populate('collaborators.userId', 'name email');

    // Emit collaborator-updated event for real-time updates (like notes)
    console.log('Backend: Emitting collaborator-updated event for permission change', {
      templateId: template._id,
      isPublic: updatedTemplate.isPublic,
      collaboratorsCount: updatedTemplate.collaborators?.length
    });
    req.io.emit('collaborator-updated', updatedTemplate);

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating collaborator permission:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/templates/:id/collaborators/:userId - Remove a collaborator
router.delete('/:id/collaborators/:userId', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      userId: req.userId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    await template.removeCollaborator(req.params.userId);

    const updatedTemplate = await Template.findById(template._id)
      .populate('userId', 'name email')
      .populate('tags', 'name color')
      .populate('collaborators.userId', 'name email');

    // Emit collaborator-updated event for real-time updates (like notes)
    console.log('Backend: Emitting collaborator-updated event for collaborator removal', {
      templateId: template._id,
      isPublic: updatedTemplate.isPublic,
      collaboratorsCount: updatedTemplate.collaborators?.length
    });
    req.io.emit('collaborator-updated', updatedTemplate);

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates/:id/rate - Rate a template
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const template = await Template.findOne({
      _id: req.params.id,
      isDeleted: false,
      isPublic: true
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    await template.addRating(rating);

    res.json({
      rating: template.rating,
      ratingCount: template.ratingCount
    });
  } catch (error) {
    console.error('Error rating template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/share/:shareLink - Get template by share link
router.get('/share/:shareLink', async (req, res) => {
  try {
    const template = await Template.findOne({
      shareLink: req.params.shareLink,
      isDeleted: false,
      isPublic: true
    })
    .populate('userId', 'name email')
    .populate('tags', 'name color');

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if share link has expired
    if (template.shareExpiry && new Date() > template.shareExpiry) {
      return res.status(410).json({ message: 'Share link has expired' });
    }

    // Usage tracking removed - all content is now in Yjs

    res.json(template);
  } catch (error) {
    console.error('Error fetching shared template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/categories - Get all template categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Template.distinct('category', {
      isDeleted: false,
      $or: [
        { userId: req.userId },
        { 'collaborators.userId': req.userId },
        { isPublic: true }
      ]
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/stats - Get template statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Template.aggregate([
      {
        $match: {
          isDeleted: false,
          $or: [
            { userId: req.userId },
            { 'collaborators.userId': req.userId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pinned: { $sum: { $cond: ['$isPinned', 1, 0] } },
          archived: { $sum: { $cond: ['$isArchived', 1, 0] } },
          public: { $sum: { $cond: ['$isPublic', 1, 0] } }
        }
      }
    ]);

    res.json(stats[0] || { total: 0, pinned: 0, archived: 0, public: 0 });
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle shortcut status for a template
router.patch('/:id/shortcut', auth, async (req, res) => {
  try {
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isShortcut: req.body.isShortcut },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Toggle shortcut error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 