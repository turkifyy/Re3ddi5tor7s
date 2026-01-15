
import { SystemLog } from '../types';

// PRODUCTION MODE: All data is fetched from Firebase.
// No mock data is used in this environment.
// Used by TerminalLog to show initial system state.

export const INITIAL_LOGS: SystemLog[] = [
  { id: 'init-1', timestamp: new Date().toISOString(), level: 'INFO', module: 'SYS', message: 'System initialized. Connecting to Cloud Uplink...' },
];
