/**
 * Type declarations for opossum circuit breaker library
 *
 * WHY: Backup type declarations in case @types/opossum isn't installed
 * WHEN: Build time when TypeScript compiles the code
 * HOW: Declares the module so TypeScript doesn't error on import
 */

declare module 'opossum' {
  interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
    rollingCountTimeout?: number;
    rollingCountBuckets?: number;
    name?: string;
    group?: string;
    rollingPercentilesEnabled?: boolean;
    capacity?: number;
    errorFilter?: (error: Error) => boolean;
    cache?: boolean;
    cacheTTL?: number;
    cacheGetKey?: (...args: any[]) => string;
    cacheTransport?: any;
    abortController?: AbortController;
    enableSnapshots?: boolean;
    rotateBucketController?: any;
  }

  interface CircuitBreakerStats {
    failures: number;
    fallbacks: number;
    successes: number;
    rejects: number;
    fires: number;
    timeouts: number;
    cacheHits: number;
    cacheMisses: number;
    semaphoreRejections: number;
    percentiles: { [key: string]: number };
    latencyTimes: number[];
    latencyMean: number;
  }

  class CircuitBreaker<TI extends unknown[] = unknown[], TR = unknown> {
    constructor(
      action: (...args: TI) => Promise<TR>,
      options?: CircuitBreakerOptions
    );

    readonly name: string;
    readonly group: string;
    readonly enabled: boolean;
    readonly pendingClose: boolean;
    readonly closed: boolean;
    readonly opened: boolean;
    readonly halfOpen: boolean;
    readonly isShutdown: boolean;
    readonly status: any;
    readonly stats: CircuitBreakerStats;
    readonly warmUp: boolean;
    readonly volumeThreshold: number;

    fire(...args: TI): Promise<TR>;
    call(...args: TI): Promise<TR>;
    clearCache(): void;
    open(): void;
    close(): void;
    disable(): void;
    enable(): void;
    shutdown(): void;
    toJSON(): any;

    fallback(func: (...args: TI) => TR | Promise<TR>): this;

    on(event: 'success', listener: (result: TR, latencyMs: number) => void): this;
    on(event: 'timeout', listener: (error: Error, latencyMs: number) => void): this;
    on(event: 'reject', listener: (error: Error) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'halfOpen', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'fallback', listener: (result: TR, error: Error) => void): this;
    on(event: 'failure', listener: (error: Error, latencyMs: number) => void): this;
    on(event: 'semaphoreLocked', listener: (error: Error) => void): this;
    on(event: 'healthCheckFailed', listener: (error: Error) => void): this;
    on(event: 'shutdown', listener: () => void): this;
    on(event: 'cacheHit', listener: () => void): this;
    on(event: 'cacheMiss', listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export default CircuitBreaker;
  export { CircuitBreakerOptions, CircuitBreakerStats };
}
