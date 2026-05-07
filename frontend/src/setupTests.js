// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// JSDOM (used by Jest) may not expose the Web Crypto API on `global.crypto`.
// Polyfill it using Node's built-in crypto module so that generateId() works.
if (typeof global.crypto === 'undefined') {
  const nodeCrypto = require('crypto');
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () => nodeCrypto.randomUUID(),
      getRandomValues: (buffer) => {
        nodeCrypto.randomFillSync(buffer);
        return buffer;
      },
    },
    configurable: true,
  });
}
