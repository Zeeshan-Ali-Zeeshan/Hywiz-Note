import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: ''
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'black'],
      default: 'light'
    },
    backgroundImage: {
      type: String,
      default: ''
    },
    greeting: {
      type: String,
      default: 'Welcome back!'
    },
    layoutStyle: {
      type: String,
      enum: ['comfortable', 'compact', 'spacious'],
      default: 'comfortable'
    },
    fontSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium'
    },
    autoSaveInterval: {
      type: Number,
      default: 3000
    },
    defaultNotebook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notebook'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    browserNotifications: {
      type: Boolean,
      default: true
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLoginAt: Date,
  loginCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ 'preferences.defaultNotebook': 1 });

export default mongoose.model('User', userSchema);