import mongoose from 'mongoose';
import User from './models/User.js';
import Workspace from './models/Workspace.js';
import Notebook from './models/Notebook.js';
import Note from './models/Note.js';

// MongoDB connection
mongoose.connect('mongodb+srv://zeeshantidi259:hyperking@cluster0.s17pj.mongodb.net/evernote-clone?retryWrites=true&w=majority')
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

async function migrateWorkspaces() {
  try {
    console.log('Starting workspace migration...');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      console.log(`Processing user: ${user.email}`);

      // Create default workspace for user if none exists
      let defaultWorkspace = await Workspace.findOne({ userId: user._id, isDefault: true });
      
      if (!defaultWorkspace) {
        console.log(`Creating default workspace for user: ${user.email}`);
        defaultWorkspace = new Workspace({
          name: 'Default Workspace',
          description: 'Your default workspace for organizing notes and notebooks',
          userId: user._id,
          icon: 'briefcase',
          color: '#3B82F6',
          isDefault: true,
          sortOrder: 0
        });
        await defaultWorkspace.save();
        console.log(`Created default workspace: ${defaultWorkspace.name}`);
      }

      // Update all notebooks for this user to have workspaceId
      const notebooks = await Notebook.find({ userId: user._id });
      console.log(`Found ${notebooks.length} notebooks for user: ${user.email}`);
      
      for (const notebook of notebooks) {
        if (!notebook.workspaceId) {
          notebook.workspaceId = defaultWorkspace._id;
          await notebook.save();
          console.log(`Updated notebook: ${notebook.name}`);
        }
      }

      // Update all notes for this user to have workspaceId
      const notes = await Note.find({ userId: user._id });
      console.log(`Found ${notes.length} notes for user: ${user.email}`);
      
      for (const note of notes) {
        if (!note.workspaceId) {
          note.workspaceId = defaultWorkspace._id;
          await note.save();
          console.log(`Updated note: ${note.title || note._id}`);
        }
      }

      // Update workspace counts
      await defaultWorkspace.updateCounts();
      console.log(`Updated workspace counts for: ${defaultWorkspace.name}`);
    }

    console.log('Workspace migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateWorkspaces(); 