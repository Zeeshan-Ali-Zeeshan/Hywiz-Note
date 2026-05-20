import { Node, mergeAttributes } from '@tiptap/core';

export interface TaskListOptions {
  HTMLAttributes: Record<string, any>;
  itemTypeName: string;
  keepMarks: boolean;
  keepAttributes: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskList: {
      toggleTaskList: () => ReturnType;
      wrapInTaskList: () => ReturnType;
    };
  }
}

export const TaskList = Node.create<TaskListOptions>({
  name: 'taskList',

  addOptions() {
    return {
      HTMLAttributes: {},
      itemTypeName: 'taskItem',
      keepMarks: false,
      keepAttributes: false,
    };
  },

  group: 'block list',

  content() {
    return `${this.options.itemTypeName}+`;
  },

  defining: true,

  addAttributes() {
    return {
      class: {
        default: 'task-list',
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => ({
          class: attributes.class,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `ul[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes(
        { 'data-type': this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          class: 'task-list',
        }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ commands }) => {
          return commands.toggleList(this.name, this.options.itemTypeName);
        },
      wrapInTaskList:
        () =>
        ({ commands }) => {
          return commands.wrapInList(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),
    };
  },
});
