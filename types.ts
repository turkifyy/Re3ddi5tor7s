export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  RESTING = 'RESTING',
  FLAGGED = 'FLAGGED',
  BANNED = 'BANNED'
}

export type UserRole = 'ADMIN' | 'USER';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface RedditAccount {
  id: string;
  username: string;
  karma: number;
  accountAgeDays: number;
  status: AccountStatus;
  proxyIp: string;
  lastActive: string;
  healthScore: number; // 0-100
  sentiment?: {
    score: number; // -1.0 to 1.0
    label: string; // Positive, Negative, Neutral
  };
}

export interface Campaign {
  id: string;
  name: string;
  targetSubreddits: string[];
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'DRAFT';
  postsEngaged: number;
  commentsGenerated: number;
  roi: number;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  module: 'AAO' | 'CASE' | 'SYS' | 'NET' | 'DB' | 'AI' | 'AUTH';
  message: string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface AiGenerationRequest {
  targetUrl: string;
  contextData: string;
  tone: string;
  model: string;
}

export type ViewState = 'DASHBOARD' | 'ACCOUNTS' | 'CAMPAIGNS' | 'LOGS' | 'SETTINGS';