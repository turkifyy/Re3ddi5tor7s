
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
  keywords: string[]; // NEW: For Auto-Search
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'DRAFT';
  postsEngaged: number;
  commentsGenerated: number;
  roi: number;
}

// NEW: Data Structure for Scraped Leads
export interface ScrapedLead {
    id: string; // Reddit Thing ID (t1_xyz or t3_xyz)
    type: 'POST' | 'COMMENT';
    subreddit: string;
    author: string;
    content: string;
    matchedKeyword: string;
    permalink: string;
    scrapedAt: string;
    status: 'NEW' | 'ENGAGED' | 'DISMISSED';
    score: number; // Reddit Score
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  module: 'AAO' | 'CASE' | 'SYS' | 'NET' | 'DB' | 'AI' | 'AUTH' | 'REDDIT' | 'BOT' | 'CRON' | 'SCRAPER';
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

// --- CRON TYPES ---
export type CronInterval = 'EVERY_MINUTE' | 'EVERY_5_MINUTES' | 'HOURLY' | 'DAILY' | 'WEEKLY';

export interface CronJob {
    id: string;
    name: string;
    description: string;
    interval: CronInterval;
    lastRun: number; // Timestamp
    nextRun: number; // Timestamp
    status: 'IDLE' | 'RUNNING' | 'FAILED' | 'SUCCESS';
    enabled: boolean;
}

// NEW: Server-Side Heartbeat Type for GitHub Actions
export interface ServerPulse {
    lastHeartbeat: number; // Timestamp
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    runnerId: string; // GitHub Action Run ID
    executedTasks: string[];
    durationMs: number;
    nextScheduledRun: number;
}

// NEW: Reddit System Health for Monitoring
export interface RedditSystemHealth {
    globalRateLimit: number; // Remaining requests
    averageLatency: number;
    errorRate: number;
    activeNodes: number;
    lastSync: number;
}

// NEW: Marketing Types
export type MarketingCategory = 'MOVIES' | 'SERIES' | 'MATCHES' | 'RECIPES' | 'GAMES' | 'APPS' | 'CUSTOM';
export type SearchTimeframe = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

export type ViewState = 'DASHBOARD' | 'ACCOUNTS' | 'CAMPAIGNS' | 'INBOX' | 'LOGS' | 'SETTINGS' | 'DOCUMENTATION' | 'SCRAPER';
