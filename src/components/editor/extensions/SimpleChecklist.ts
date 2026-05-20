import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Simple Checklist List (like bullet list)
export const SimpleChecklistList = Node.create({
  name: 'simpleChecklistList',
  group: 'block list',
  content: 'simpleChecklistItem+',
  
  parseHTML() {
    return [{ tag: 'ul[data-type=simple-checklist]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes({ 'data-type': 'simple-checklist', class: 'simple-checklist' }, HTMLAttributes), 0];
  },
  
  addCommands() {
    return {
      toggleSimpleChecklist: () => ({ commands }) => {
        return commands.toggleList('simpleChecklistList', 'simpleChecklistItem');
      },
    };
  },
});

// Simple Checklist Item Component
const SimpleChecklistItemComponent: React.FC<{
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, any>) => void;
}> = ({ node, updateAttributes }) => {
  const isChecked = node.attrs.checked;
  const contentClass = isChecked ? 'simple-checklist-content checked-content' : 'simple-checklist-content';

  return React.createElement(NodeViewWrapper, {
    className: 'simple-checklist-item-wrapper',
    as: 'li',
    'data-checked': isChecked
  }, [
    React.createElement('label', {
      className: 'simple-checklist-label',
      contentEditable: false
    }, [
      React.createElement('input', {
        type: 'checkbox',
        className: 'simple-checklist-checkbox',
        checked: isChecked,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => updateAttributes({ checked: e.target.checked })
      })
    ]),
    React.createElement(NodeViewContent, {
      className: contentClass
    })
  ]);
};

// Simple Checklist Item
export const SimpleChecklistItem = Node.create({
  name: 'simpleChecklistItem',
  content: 'paragraph block*',
  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: element => element.getAttribute('data-checked') === 'true',
        renderHTML: attributes => ({ 'data-checked': attributes.checked }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'li[data-type=simple-checklist-item]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes({ 'data-type': 'simple-checklist-item' }, HTMLAttributes),
      [
        'label',
        { class: 'simple-checklist-label', contenteditable: 'false' },
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
            class: 'simple-checklist-checkbox',
          },
        ],
      ],
      ['div', { class: 'simple-checklist-content' }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SimpleChecklistItemComponent);
  },
});
