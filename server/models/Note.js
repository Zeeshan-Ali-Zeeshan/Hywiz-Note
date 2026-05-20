import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  noteId: {
    type: String,
    required: true,
    unique: true,
    default: function() { return this._id.toString(); }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  notebookIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notebook'
  }],
  primaryNotebookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notebook',
    required: false,
    default: function() {
      return this.notebookId || null;
    }
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  attachments: {
    type: [{
      filename: String,
      originalName: String,
      url: String,
      type: String,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isShortcut: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,

  lastViewedAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  },
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['read', 'write', 'admin'],
      default: 'read'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  shareSettings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowEdit: {
      type: Boolean,
      default: false
    },
    allowComments: {
      type: Boolean,
      default: false
    },
    passwordProtected: {
      type: Boolean,
      default: false
    },
    password: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: String,
      default: ''
    },
    publicUrl: String
  },

  yjsUpdate: {
    type: Buffer, // Store the canonical Yjs update as a binary Buffer
    required: false
  },
}, {
  timestamps: true
});

// Indexes for better query performance
noteSchema.index({ userId: 1, isDeleted: 1 });
noteSchema.index({ notebookIds: 1, isDeleted: 1 });
noteSchema.index({ userId: 1, isPinned: 1 });
noteSchema.index({ userId: 1, lastViewedAt: -1 });
noteSchema.index({ userId: 1, updatedAt: -1 });
noteSchema.index({ tags: 1 });

// Virtual for excerpt (now derived from YJS content)
noteSchema.virtual('excerpt').get(function() {
  // This will be calculated from YJS content when needed
  return '';
});

// Virtual for word count (now derived from YJS content)
noteSchema.virtual('wordCount').get(function() {
  // This will be calculated from YJS content when needed
  return 0;
});

// Virtual for backward compatibility with notebookId
noteSchema.virtual('notebookId').get(function() {
  return this.primaryNotebookId;
});

// Ensure virtuals are included in JSON output
noteSchema.set('toJSON', { virtuals: true });
noteSchema.set('toObject', { virtuals: true });

// Migration middleware to handle old notebookId structure
noteSchema.pre('save', function(next) {
  // If this note has the old notebookId field but no primaryNotebookId
  if (this.notebookId && !this.primaryNotebookId) {
    this.primaryNotebookId = this.notebookId;
    this.notebookIds = [this.notebookId];
    // Remove the old field
    this.notebookId = undefined;
  }
  // If this note has primaryNotebookId but no notebookIds
  if (this.primaryNotebookId && (!this.notebookIds || this.notebookIds.length === 0)) {
    this.notebookIds = [this.primaryNotebookId];
  }
  next();
});

// Pre-findOneAndUpdate middleware
noteSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update && update.notebookId && !update.primaryNotebookId) {
    update.primaryNotebookId = update.notebookId;
    update.notebookIds = [update.notebookId];
    delete update.notebookId;
  }
  next();
});

// Pre-find middleware to handle old notebookId queries
noteSchema.pre('find', function() {
  // If querying by notebookId, also check primaryNotebookId
  if (this._conditions && this._conditions.notebookId) {
    this._conditions.$or = [
      { primaryNotebookId: this._conditions.notebookId },
      { notebookIds: this._conditions.notebookId }
    ];
    delete this._conditions.notebookId;
  }
});

noteSchema.pre('findOne', function() {
  // If querying by notebookId, also check primaryNotebookId
  if (this._conditions && this._conditions.notebookId) {
    this._conditions.$or = [
      { primaryNotebookId: this._conditions.notebookId },
      { notebookIds: this._conditions.notebookId }
    ];
    delete this._conditions.notebookId;
  }
});

noteSchema.pre('save', function(next) {
  console.log('[DEBUG] Note is being saved:', this._id, this.collaborators);
  next();
});

export default mongoose.model('Note', noteSchema);