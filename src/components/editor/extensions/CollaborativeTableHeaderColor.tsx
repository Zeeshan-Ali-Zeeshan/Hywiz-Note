import TableHeader from '@tiptap/extension-table-header';

export const CollaborativeTableHeaderColor = TableHeader.extend({
  name: 'tableHeader', // Explicitly set the name
  
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        renderHTML: attributes => {
          // console.log('[DEBUG] TableHeader renderHTML called with backgroundColor:', attributes.backgroundColor);
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}` };
        },
        parseHTML: element => {
          const bgColor = element.style.backgroundColor || null;
          console.log('[DEBUG] TableHeader parseHTML found backgroundColor:', bgColor);
          return bgColor;
        },
      },
    };
  },
}); 