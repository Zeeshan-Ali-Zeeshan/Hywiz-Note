import express from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import Note from '../models/Note.js';
import Notebook from '../models/Notebook.js';
import Tag from '../models/Tag.js';


const router = express.Router();

// Get user preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('preferences.defaultNotebook', 'name')
      .select('preferences');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update preferences
    Object.assign(user.preferences, req.body);
    await user.save();

    await user.populate('preferences.defaultNotebook', 'name');

    res.json(user.preferences);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.userId }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      user.email = email.toLowerCase();
    }

    if (name) user.name = name;

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload avatar
router.post('/avatar', auth, async (req, res) => {
  try {
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ message: 'No avatar file provided' });
    }

    const avatar = req.files.avatar;
    
    // Validate file type
    if (!avatar.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'File must be an image' });
    }

    // Create unique filename
    const timestamp = Date.now();
    const extension = path.extname(avatar.name);
    const filename = `avatar_${req.userId}_${timestamp}${extension}`;
    const uploadPath = path.join(process.cwd(), 'server/uploads', filename);

    // Move file
    await avatar.mv(uploadPath);

    // Update user avatar
    const user = await User.findById(req.userId);
    user.avatar = `/uploads/${filename}`;
    await user.save();

    res.json({ avatar: user.avatar });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Get user stats
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = {
      totalNotes: await Note.countDocuments({ userId: req.userId, isDeleted: false }),
      totalNotebooks: await Notebook.countDocuments({ userId: req.userId }),
      totalTags: await Tag.countDocuments({ userId: req.userId }),
      notesInTrash: await Note.countDocuments({ userId: req.userId, isDeleted: true })
    };

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update user data
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    res.json({ message: 'Profile updated successfully', user: { name: user.name, email: user.email } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user account
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Delete all user data
    await Note.deleteMany({ userId: req.userId });
    await Notebook.deleteMany({ userId: req.userId });
    await Tag.deleteMany({ userId: req.userId });
    await User.findByIdAndDelete(req.userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;