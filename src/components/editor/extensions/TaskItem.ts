import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TaskItemComponent } from './TaskItemComponent';

export interface TaskItemOptions {
  HTMLAttributes: Record<string, any>;
  nested: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskItem: {
      setTaskItem: (attributes?: { checked?: boolean; text?: string }) => ReturnType;
      toggleTaskItem: () => ReturnType;
    };
  }
}

export const TaskItem = Node.create<TaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      HTMLAttributes: {},
      nested: false,
    };
  },

  group: 'listItem',

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+';
  },

  defining: true,

  addAttributes() {
    return {
      // Hardened Anchor Fields
      taskId: {
        default: null,
        parseHTML: element => element.getAttribute('data-task-id'),
        renderHTML: attributes => {
          if (!attributes.taskId) return {};
          return { 'data-task-id': attributes.taskId };
        },
      },
      snapshotStatus: {
        default: 'pending',
        parseHTML: element => element.getAttribute('data-snapshot-status') || 'pending',
        renderHTML: attributes => ({
          'data-snapshot-status': attributes.snapshotStatus,
        }),
      },
      snapshotEtag: {
        default: null,
        parseHTML: element => element.getAttribute('data-snapshot-etag'),
        renderHTML: attributes => {
          if (!attributes.snapshotEtag) return {};
          return { 'data-snapshot-etag': attributes.snapshotEtag };
        },
      },
      // Dirty flag for sync (internal only, not rendered)
      dirty: {
        default: false,
        renderHTML: () => ({}),
        parseHTML: () => false,
      },

      // Scheduled Data (Cached Snapshot)
      dueDateWall: {
        default: null,
        parseHTML: element => element.getAttribute('data-due-date-wall'),
        renderHTML: attributes => {
          if (!attributes.dueDateWall) return {};
          return { 'data-due-date-wall': attributes.dueDateWall };
        },
      },
      // FIX M-5: attribute name is now 'timezone' (all lowercase) matching the component
      // and the backend field. parseHTML still reads the existing 'data-time-zone' HTML attr.
      timezone: {
        default: 'UTC',
        parseHTML: element => element.getAttribute('data-timezone') || element.getAttribute('data-time-zone') || 'UTC',
        renderHTML: attributes => ({
          'data-timezone': attributes.timezone,
        }),
      },
      isFloating: {
        default: false,
        parseHTML: element => element.getAttribute('data-is-floating') === 'true',
        renderHTML: attributes => ({
          'data-is-floating': attributes.isFloating ? 'true' : 'false',
        }),
      },

      // Recurrence (Snapshot)
      isRecurring: {
        default: false,
        parseHTML: element => element.getAttribute('data-is-recurring') === 'true',
        renderHTML: attributes => ({
          'data-is-recurring': attributes.isRecurring ? 'true' : 'false',
        }),
      },
      recurrenceRule: {
        default: null,
        parseHTML: element => element.getAttribute('data-recurrence-rule'),
        renderHTML: attributes => {
          if (!attributes.recurrenceRule) return {};
          return { 'data-recurrence-rule': attributes.recurrenceRule };
        },
      },
      recurringPattern: {
        default: null,
        parseHTML: element => element.getAttribute('data-recurring-pattern'),
        renderHTML: attributes => {
          if (!attributes.recurringPattern) return {};
          return { 'data-recurring-pattern': attributes.recurringPattern };
        },
      },

      // Additional Task Fields
      description: {
        default: null,
        parseHTML: element => element.getAttribute('data-description'),
        renderHTML: attributes => {
          if (!attributes.description) return {};
          return { 'data-description': attributes.description };
        },
      },
      reminder: {
        default: null,
        parseHTML: element => element.getAttribute('data-reminder'),
        renderHTML: attributes => {
          if (!attributes.reminder) return {};
          return { 'data-reminder': attributes.reminder };
        },
      },
      completionHistory: {
        default: null,
        parseHTML: element => {
          const hist = element.getAttribute('data-completion-history');
          return hist ? JSON.parse(hist) : null;
        },
        renderHTML: attributes => {
          if (!attributes.completionHistory) return {};
          return { 'data-completion-history': JSON.stringify(attributes.completionHistory) };
        },
      },

      // Legacy/UI Fields (kept for compatibility during migration, but driven by backend now)
      checked: {
        default: false,
        // Map snapshotStatus to checked for UI compatibility
        parseHTML: element => element.getAttribute('data-checked') === 'true' || element.getAttribute('data-snapshot-status') === 'completed',
        renderHTML: attributes => ({
          'data-checked': (attributes.checked || attributes.snapshotStatus === 'completed') ? 'true' : 'false',
        }),
      },
      priority: {
        default: 'medium',
        parseHTML: element => element.getAttribute('data-priority') || 'medium',
        renderHTML: attributes => ({
          'data-priority': attributes.priority,
        }),
      },
      tags: {
        default: [],
        parseHTML: element => {
          const tags = element.getAttribute('data-tags');
          return tags ? JSON.parse(tags) : [];
        },
        renderHTML: attributes => {
          if (!attributes.tags || attributes.tags.length === 0) return {};
          return { 'data-tags': JSON.stringify(attributes.tags) };
        },
      },
      // Assignee, Flag, Note Context — needed by More panel to persist across sessions
      assignee: {
        default: null,
        parseHTML: element => element.getAttribute('data-assignee'),
        renderHTML: attributes => {
          if (!attributes.assignee) return {};
          return { 'data-assignee': attributes.assignee };
        },
      },
      isFlagged: {
        default: false,
        parseHTML: element => element.getAttribute('data-is-flagged') === 'true',
        renderHTML: attributes => ({
          'data-is-flagged': attributes.isFlagged ? 'true' : 'false',
        }),
      },
      noteId: {
        default: null,
        parseHTML: element => element.getAttribute('data-note-id'),
        renderHTML: attributes => {
          if (!attributes.noteId) return {};
          return { 'data-note-id': attributes.noteId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(
        { 'data-type': this.name },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setTaskItem:
        (attributes = {}) =>
          ({ commands }) => {
            return commands.updateAttributes(this.name, attributes);
          },
      toggleTaskItem:
        () =>
          ({ commands }) => {
            const { state } = this.editor;
            const { selection } = state;
            const { $from } = selection;

            // Find the task item node
            let taskItemPos = null;
            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth);
              if (node.type.name === this.name) {
                taskItemPos = $from.before(depth);
                break;
              }
            }

            if (taskItemPos !== null) {
              const _node = state.doc.nodeAt(taskItemPos);
              if (_node) {
                return commands.updateAttributes(this.name, {
                  checked: !_node.attrs.checked,
                  completedAt: !_node.attrs.checked ? new Date().toISOString() : null,
                });
              }
            }

            return false;
          },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskItemComponent);
  },
});
