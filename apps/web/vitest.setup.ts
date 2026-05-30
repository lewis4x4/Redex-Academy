import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto'; // IndexedDB for Dexie in jsdom (F4 offline tests)
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// globals: false → Testing Library's auto-cleanup is not registered for us.
afterEach(() => cleanup());
