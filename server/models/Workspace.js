import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  icon: {
    type: String,
    default: 'briefcase'
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  notebookCount: {
    type: Number,
    default: 0
  },
  noteCount: {
    type: Number,
    default: 0
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
    // Share scope: all notebooks or selected subset
    scope: {
      type: String,
      enum: ['all', 'selected'],
      default: 'all'
    },
    notebookIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notebook'
    }],
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    allowPublicSharing: {
      type: Boolean,
      default: false
    },
    autoArchive: {
      type: Boolean,
      default: false
    },
    archiveAfterDays: {
      type: Number,
      default: 30
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
workspaceSchema.index({ userId: 1, isDefault: 1 });
workspaceSchema.index({ userId: 1, sortOrder: 1 });
workspaceSchema.index({ userId: 1, createdAt: -1 });

// Ensure only one default workspace per user
workspaceSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Update notebook count when notebooks are added/removed
workspaceSchema.methods.updateCounts = async function() {
  const Notebook = mongoose.model('Notebook');
  const Note = mongoose.model('Note');
  
  const notebookCount = await Notebook.countDocuments({ workspaceId: this._id });
  const noteCount = await Note.countDocuments({ workspaceId: this._id });
  
  this.notebookCount = notebookCount;
  this.noteCount = noteCount;
  
  return this.save();
};

export default mongoose.model('Workspace', workspaceSchema); 