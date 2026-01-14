
import { SystemLog } from '../types';

type LogListener = (log: SystemLog) => void;

class LoggerService {
  private listeners: LogListener[] = [];
  private logs: SystemLog[] = [];
  
  // Real-time Production Metrics
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

  // CALLED BY REAL SERVICES: Record an actual system operation
  trackActivity(latencyMs: number = 0) {
    this.activityCounter++; // Increment real ops count
    if (latencyMs > 0) {
        this.lastLatency = latencyMs; // Record real network latency
    }
  }

  // Used by Dashboard to get REAL throughput (ops/sec) since last tick
  getAndResetActivityCount(): number {
    const count = this.activityCounter;
    this.activityCounter = 0; // Reset for next second's calculation
    return count;
  }

  getLatestLatency(): number {
    return this.lastLatency;
  }

  // Memory Management: Prune old logs to keep browser fast
  pruneLogs(keepLast: number = 50): number {
      const initialCount = this.logs.length;
      if (initialCount <= keepLast) return 0;
      
      this.logs = this.logs.slice(-keepLast);
      return initialCount - this.logs.length;
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
    // Hard limit 200 logs in memory
    if (this.logs.length > 200) this.logs.shift();
    
    this.notify(newLog);
    
    // Console fallback for debugging
    const style = level === 'ERROR' ? 'color: red' : level === 'SUCCESS' ? 'color: green' : 'color: blue';
    console.log(`%c[${module}] ${message}`, style);
  }

  info(module: SystemLog['module'], message: string) { this.log('INFO', module, message); }
  warn(module: SystemLog['module'], message: string) { this.log('WARN', module, message); }
  error(module: SystemLog['module'], message: string) { this.log('ERROR', module, message); }
  success(module: SystemLog['module'], message: string) { this.log('SUCCESS', module, message); }
}

export const logger = new LoggerService();
