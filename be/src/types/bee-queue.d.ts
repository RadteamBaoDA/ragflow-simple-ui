declare module 'bee-queue' {
  import { EventEmitter } from 'events';
  import { RedisClientType } from 'redis';

  interface QueueSettings {
    prefix?: string;
    stallInterval?: number;
    nearTermWindow?: number;
    delayedDebounce?: number;
    redis?: {
      host?: string;
      port?: number;
      db?: number;
      options?: any;
      password?: string;
    } | string | RedisClientType;
    isWorker?: boolean;
    getEvents?: boolean;
    sendEvents?: boolean;
    storeJobs?: boolean;
    ensureScripts?: boolean;
    activateDelayedJobs?: boolean;
    removeOnSuccess?: boolean;
    removeOnFailure?: boolean;
    redisScanCount?: number;
  }

  interface Job<T = any> extends EventEmitter {
    id: string;
    data: T;
    options: any;
    queue: Queue;
    progress: any;

    setId(id: string): this;
    retries(n: number): this;
    backoff(strategy: string, delayFactor?: number): this;
    delayUntil(dateOrTimestamp: Date | number): this;
    timeout(ms: number): this;
    save(cb?: (err: Error | null, job: Job<T>) => void): Promise<Job<T>>;
    reportProgress(n: any): void;
    remove(cb?: (err: Error | null) => void): Promise<Job<T>>;
    on(event: string, handler: (...args: any[]) => void): this;
  }

  class Queue extends EventEmitter {
    constructor(name: string, settings?: QueueSettings);

    name: string;
    keyPrefix: string;
    jobs: Map<string, Job>;
    paused: boolean;
    settings: QueueSettings;

    createJob<T>(data: T): Job<T>;
    getJob(jobId: string, cb?: (err: Error | null, job: Job) => void): Promise<Job>;
    getJobs(type: string, page: any, cb?: (err: Error | null, jobs: Job[]) => void): Promise<Job[]>;
    process<T>(handler: (job: Job<T>, done: (err?: Error | null, result?: any) => void) => Promise<any> | void): void;
    process<T>(concurrency: number, handler: (job: Job<T>, done: (err?: Error | null, result?: any) => void) => Promise<any> | void): void;
    checkStalledJobs(interval?: number, cb?: (err: Error | null, numStalled: number) => void): Promise<number>;
    checkHealth(cb?: (err: Error | null, counts: any) => void): Promise<any>;
    close(timeout?: number, cb?: (err: Error | null) => void): Promise<void>;
    isRunning(): boolean;
    ready(cb?: (err: Error | null) => void): Promise<void>;
    removeJob(jobId: string, cb?: (err: Error | null) => void): Promise<void>;
    destroy(cb?: (err: Error | null) => void): Promise<void>;
  }

  export = Queue;
}
