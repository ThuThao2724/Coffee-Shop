/**
 * In-memory limiter for failed login / credential-check attempts at the gateway.
 *
 * Only failures are counted (the proxy reports each upstream 401/403), and a successful
 * login clears the per-account counter. Two windows are enforced:
 *  - per IP + account identifier: stops password guessing on one account;
 *  - per IP: stops one client spraying many accounts.
 * There is deliberately no account-only key, so nobody can lock a victim out from elsewhere.
 *
 * State lives in this gateway process (single instance in docker-compose). If the gateway is
 * ever scaled out, move these counters to Redis.
 */
export interface LoginRateLimitDecision {
  blocked: boolean;
  retryAfterSeconds: number;
}

export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(
    private readonly windowMs = 15 * 60 * 1000,
    private readonly maxPerAccount = 5,
    private readonly maxPerIp = 20,
    private readonly now: () => number = () => Date.now(),
  ) {}

  check(ip: string, account: string): LoginRateLimitDecision {
    const now = this.now();
    this.sweep(now);
    const checks: Array<[string, number]> = [[this.ipKey(ip), this.maxPerIp]];
    if (account) checks.push([this.accountKey(ip, account), this.maxPerAccount]);

    let retryAfterMs = 0;
    for (const [key, max] of checks) {
      const recent = this.recent(key, now);
      if (recent.length >= max) {
        retryAfterMs = Math.max(retryAfterMs, recent[0] + this.windowMs - now);
      }
    }
    return { blocked: retryAfterMs > 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recordFailure(ip: string, account: string) {
    const now = this.now();
    this.push(this.ipKey(ip), now);
    if (account) this.push(this.accountKey(ip, account), now);
  }

  recordSuccess(ip: string, account: string) {
    if (account) this.failures.delete(this.accountKey(ip, account));
  }

  private ipKey(ip: string) {
    return `ip:${ip}`;
  }

  private accountKey(ip: string, account: string) {
    return `acct:${ip}:${account}`;
  }

  private recent(key: string, now: number) {
    const list = (this.failures.get(key) || []).filter((ts) => now - ts < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  private push(key: string, now: number) {
    const list = this.recent(key, now);
    list.push(now);
    this.failures.set(key, list);
  }

  /** Drop expired entries now and then so the map cannot grow without bound. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60 * 1000) return;
    this.lastSweep = now;
    for (const key of Array.from(this.failures.keys())) this.recent(key, now);
  }
}
