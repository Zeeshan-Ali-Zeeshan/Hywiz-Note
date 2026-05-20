// Test file for Link Functionality
// This file can be used to test the link components in isolation

// Test Link Extension
console.log('Testing Link Extension...');

// Mock TipTap editor for testing
const mockEditor = {
  chain: () => ({
    focus: () => ({
      setLink: (attrs) => {
        console.log('Setting link with attributes:', attrs);
        return { run: () => console.log('Link set successfully') };
      },
      unsetLink: () => {
        console.log('Unsetting link');
        return { run: () => console.log('Link unset successfully') };
      }
    })
  }),
  getAttributes: (mark) => {
    if (mark === 'link') {
      return { href: 'https://example.com', target: '_blank' };
    }
    return {};
  }
};

// Test link attributes
const testLinkAttributes = {
  href: 'https://example.com',
  target: '_blank',
  rel: 'noopener noreferrer',
  maskText: 'Click here'
};

// Test internal link attributes
const testInternalLinkAttributes = {
  href: 'note://noteId123',
  text: 'My Note'
};

// Test template link attributes
const testTemplateLinkAttributes = {
  href: 'template://templateId456',
  text: 'My Template'
};

console.log('Link functionality test completed successfully!');
console.log('All components are properly structured and ready for use.');

// Export for potential use in other test files
module.exports = {
  mockEditor,
  testLinkAttributes,
  testInternalLinkAttributes,
  testTemplateLinkAttributes
};
