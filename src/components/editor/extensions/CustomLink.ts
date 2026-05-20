import Link from '@tiptap/extension-link';
import { Plugin, PluginKey } from 'prosemirror-state';

export const CustomLink = Link.extend({
  addGlobalAttributes() {
    return [
      ...this.parent?.(),
      {
        types: [this.name],
        attributes: {
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

  addProseMirrorPlugins() {
    return [
      ...this.parent?.(),
      new Plugin({
        key: new PluginKey('customLinkClickHandler'),
        props: {
          handleClick: (view, pos, event) => {
            const { state } = view;
            const link = state.doc.nodeAt(pos);
            
            if (!link) {
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
            if (href.startsWith('mailto:') || href.startsWith('tel:')) {
              window.location.href = href;
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
