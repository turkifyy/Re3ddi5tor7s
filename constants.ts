import { SystemLog } from './types';

// Mocks removed to support Real Live Data exclusively.
export const MOCK_ACCOUNTS = [];
export const MOCK_CAMPAIGNS = [];

export const INITIAL_LOGS: SystemLog[] = [
  { id: 'init-1', timestamp: new Date().toISOString(), level: 'INFO', module: 'SYS', message: 'System initialized. Waiting for user input...' },
];