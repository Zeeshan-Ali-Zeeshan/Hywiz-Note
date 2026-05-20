import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';

export interface LinkOptions {
  HTMLAttributes: Record<string, any>;
  validate?: (href: string) => boolean;
  openOnClick?: boolean;
  linkOnPaste?: boolean;
  autolink?: boolean;
  protocols?: string[];
  maskLinks?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    link: {
      setLink: (attributes: { href: string; target?: string; rel?: string; title?: string; maskText?: string }) => ReturnType;
      unsetLink: () => ReturnType;
      toggleLink: (attributes: { href: string; target?: string; rel?: string; title?: string; maskText?: string }) => ReturnType;
    };
  }
}

export const Link = Extension.create<LinkOptions>({
  name: 'link',

  addOptions() {
    return {
      HTMLAttributes: {},
      validate: undefined,
      openOnClick: true,
      linkOnPaste: true,
      autolink: true,
      protocols: ['http', 'https', 'mailto', 'tel'],
      maskLinks: false,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: [this.name],
        attributes: {
          href: {
            default: null,
            parseHTML: element => element.getAttribute('href'),
            renderHTML: attributes => {
              if (!attributes.href) {
                return {};
              }
              return {
                href: attributes.href,
              };
            },
          },
          target: {
            default: null,
            parseHTML: element => element.getAttribute('target'),
            renderHTML: attributes => {
              if (!attributes.target) {
                return {};
              }
              return {
                target: attributes.target,
              };
            },
          },
          rel: {
            default: null,
            parseHTML: element => element.getAttribute('rel'),
            renderHTML: attributes => {
              if (!attributes.rel) {
                return {};
              }
              return {
                rel: attributes.rel,
              };
            },
          },
          title: {
            default: null,
            parseHTML: element => element.getAttribute('title'),
            renderHTML: attributes => {
              if (!attributes.title) {
                return {};
              }
              return {
                title: attributes.title,
              };
            },
          },
          maskText: {
            default: null,
            parseHTML: element => element.getAttribute('data-mask-text'),
            renderHTML: attributes => {
              if (!attributes.maskText) {
                return {};
              }
              return {
                'data-mask-text': attributes.maskText,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLink:
        attributes =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleLink:
        attributes =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('linkClickHandler'),
        props: {
          handleClick: (view, pos, event) => {
            const { state } = view;
            const link = state.doc.nodeAt(pos);
            
            if (!link || !this.options.openOnClick) {
              return false;
            }

            const linkMark = link.marks.find(mark => mark.type.name === this.name);
            if (!linkMark) {
              return false;
            }

            const href = linkMark.attrs.href;
            if (!href) {
              return false;
            }

            // Handle internal note links
            if (href.startsWith('note://') || href.startsWith('template://')) {
              event.preventDefault();
              const noteId = href.replace('note://', '').replace('template://', '');
              // Emit custom event for internal navigation
              window.dispatchEvent(new CustomEvent('navigateToNote', { 
                detail: { noteId, type: href.startsWith('note://') ? 'note' : 'template' } 
              }));
              return true;
            }

            // Handle external links
            if (href.startsWith('http://') || href.startsWith('https://')) {
              const target = linkMark.attrs.target || '_blank';
              const rel = linkMark.attrs.rel || 'noopener noreferrer';
              
              if (target === '_blank') {
                window.open(href, target, `rel=${rel}`);
              } else {
                window.location.href = href;
              }
              return true;
            }

            // Handle other protocols (mailto, tel, etc.)
            if (this.options.protocols.some(protocol => href.startsWith(protocol + ':'))) {
              window.location.href = href;
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => this.editor.commands.toggleLink({ href: '' }),
    };
  },
});
