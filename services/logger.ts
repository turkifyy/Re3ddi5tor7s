import { SystemLog } from '../types';

type LogListener = (log: SystemLog) => void;

class LoggerService {
  private listeners: LogListener[] = [];
  private logs: SystemLog[] = [];
  
  // Real-time Metrics
  private activityCounter: number = 0;
  private lastLatency: number = 0;

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(log: SystemLog) {
    this.listeners.forEach(listener => listener(log));
  }

  // Record an actual system operation (Database write, AI call, etc.)
  trackActivity(latencyMs: number = 0) {
    this.activityCounter++;
    if (latencyMs > 0) {
        this.lastLatency = latencyMs;
    }
  }

  // Used by Dashboard to get REAL throughput (ops/sec)
  getAndResetActivityCount(): number {
    const count = this.activityCounter;
    this.activityCounter = 0;
    return count;
  }

  getLatestLatency(): number {
    return this.lastLatency;
  }

  log(level: SystemLog['level'], module: SystemLog['module'], message: string) {
    const newLog: SystemLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      level,
      module,
      message
    };
    
    this.logs.push(newLog);
    // Keep only last 100 in memory
    if (this.logs.length > 100) this.logs.shift();
    
    this.notify(newLog);
    
    // Also output to console for debugging
    const style = level === 'ERROR' ? 'color: red' : level === 'SUCCESS' ? 'color: green' : 'color: blue';
    console.log(`%c[${module}] ${message}`, style);
  }

  info(module: SystemLog['module'], message: string) { this.log('INFO', module, message); }
  warn(module: SystemLog['module'], message: string) { this.log('WARN', module, message); }
  error(module: SystemLog['module'], message: string) { this.log('ERROR', module, message); }
  success(module: SystemLog['module'], message: string) { this.log('SUCCESS', module, message); }
}

export const logger = new LoggerService();