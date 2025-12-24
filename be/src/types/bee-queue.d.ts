declare module 'bee-queue' {
  import { EventEmitter } from 'events';
  import { RedisClientType } from 'redis';

  interface BeeQueueSettings {
    prefix?: string;
    stallInterval?: number;
    nearTermWindow?: number;
    delayedDebounce?: number;
    redis?: string | object;
    isWorker?: boolean;
    getEvents?: boolean;
    sendEvents?: boolean;
    storeJobs?: boolean;
    ensureScripts?: boolean;
    activateDelayedJobs?: boolean;
    disable? : boolean;
    removeOnSuccess?: boolean;
    removeOnFailure?: boolean;
    redisScanCount?: number;
  }

  interface Job<T> extends EventEmitter {
    id: string;
    data: T;
    options: any;
    status: string;
    progress: number;
    queue: BeeQueue<T>;

    save(cb?: (err: Error | null, job: Job<T>) => void): Promise<Job<T>>;
    retries(n: number): Job<T>;
    timeout(ms: number): Job<T>;
    backoff(strategy: string, delay: number): Job<T>;
    reportProgress(progress: number): void;
    remove(): Promise<void>;
  }

  class BeeQueue<T = any> extends EventEmitter {
    constructor(name: string, settings?: BeeQueueSettings);

    createJob(data: T): Job<T>;
    process<R>(concurrency: number, handler: (job: Job<T>, done: (err: Error | null, result?: R) => void) => void): void;
    process<R>(handler: (job: Job<T>, done: (err: Error | null, result?: R) => void) => void): void;
    process<R>(handler: (job: Job<T>) => Promise<R>): void;

    close(timeout?: number): Promise<void>;
    ready(): Promise<void>;
    checkStalledJobs(interval?: number): Promise<number>;

    // Add other methods as needed
  }

  export = BeeQueue;
}
