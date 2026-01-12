
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

export interface RedditCredential {
    id: string;
    clientId: string;
    clientSecret: string;
    username: string;
    password: string; // Stored locally
    usageCount: number;
    status: 'READY' | 'RATE_LIMITED' | 'EXHAUSTED';
    lastUsed: number;
    cooldownUntil: number; // Timestamp when rate limit expires
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  subreddit: string;
  postTitle: string;
  permalink: string;
  createdUtc: number;
  isReplied: boolean;
  sentiment?: 'Positive' | 'Negative' | 'Neutral';
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
  module: 'AAO' | 'CASE' | 'SYS' | 'NET' | 'DB' | 'AI' | 'AUTH' | 'REDDIT' | 'BOT';
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

// --- ROBOTICS TYPES ---
export type AgentStatus = 'IDLE' | 'WORKING' | 'RESTING' | 'ERROR';

export interface BotAgent {
    id: string;
    name: string;
    type: 'SPIDER' | 'SENTINEL' | 'WORKER';
    status: AgentStatus;
    currentTask: string;
    efficiency: number; // 0-100%
    lastCycle: number;
}

export interface RoboticsState {
    systemMode: 'PRODUCTION_CYCLE' | 'MAINTENANCE_CYCLE';
    uptime: number;
    activeAgents: number;
    nextMaintenance: string;
}

export type ViewState = 'DASHBOARD' | 'ACCOUNTS' | 'CAMPAIGNS' | 'INBOX' | 'LOGS' | 'SETTINGS';
