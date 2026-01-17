
import React, { useEffect, useRef, useState, memo } from 'react';
import { INITIAL_LOGS } from './constants';
import { SystemLog } from '../types';
import { logger } from '../services/logger';

export const TerminalLog: React.FC = memo(() => {
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_LOGS);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLog) => {
      setLogs(prev => {
        const newLogs = [...prev, newLog];
        if (newLogs.length > 50) return newLogs.slice(-50);
        return newLogs;
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'blue-text text-lighten-2';
      case 'WARN': return 'orange-text text-lighten-2';
      case 'ERROR': return 'red-text text-accent-2';
      case 'SUCCESS': return 'green-text text-accent-3';
      default: return 'grey-text';
    }
  };

  return (
    <div className="blue-grey darken-4 z-depth-3" style={{height: '200px', width: '100%', display: 'flex', flexDirection: 'column'}}>
        <div className="blue-grey darken-3 px-2 flex-center" style={{padding: '5px 15px', justifyContent: 'space-between', borderBottom: '1px solid #37474f'}}>
             <span className="grey-text text-lighten-1" style={{fontSize: '0.8rem', fontFamily: 'monospace'}}>SYSTEM_KERNEL_V6.0</span>
             <span className="green-text accent-3" style={{fontSize: '0.8rem'}}>● ONLINE</span>
        </div>
        <div className="flex-1" style={{overflowY: 'auto', padding: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem'}}>
            {logs.map((log) => (
                <div key={log.id} style={{marginBottom: '4px'}}>
                    <span className="grey-text text-darken-1">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                    <span className={`bold ${getLevelColor(log.level)}`} style={{margin: '0 8px'}}>{log.level}</span>
                    <span className="grey-text text-lighten-2">{log.module} :: </span>
                    <span className="grey-text text-lighten-4">{log.message}</span>
                </div>
            ))}
            <div ref={endRef} />
        </div>
    </div>
  );
});
