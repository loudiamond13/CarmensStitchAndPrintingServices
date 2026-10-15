// The shared MSW server for component and service tests. It starts with no handlers; each test adds its own with
// server.use, and setup.ts resets them after every test.
import { setupServer } from 'msw/node';

export const server = setupServer();
