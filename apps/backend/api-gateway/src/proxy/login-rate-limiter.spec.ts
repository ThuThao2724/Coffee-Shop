import { LoginRateLimiter } from './login-rate-limiter';

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(value: unknown): { toBe(expected: unknown): void };

const WINDOW = 15 * 60 * 1000;

describe('LoginRateLimiter', () => {
  it('blocks an IP + account after 5 failures and reports a retry delay', () => {
    const limiter = new LoginRateLimiter(WINDOW, 5, 20);
    for (let i = 0; i < 5; i += 1) {
      expect(limiter.check('1.1.1.1', 'a@x.vn').blocked).toBe(false);
      limiter.recordFailure('1.1.1.1', 'a@x.vn');
    }
    const decision = limiter.check('1.1.1.1', 'a@x.vn');
    expect(decision.blocked).toBe(true);
    expect(decision.retryAfterSeconds > 0).toBe(true);
  });

  it('does not lock the same account for a different IP', () => {
    const limiter = new LoginRateLimiter(WINDOW, 5, 20);
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('1.1.1.1', 'a@x.vn');
    expect(limiter.check('2.2.2.2', 'a@x.vn').blocked).toBe(false);
  });

  it('blocks an IP spraying many accounts', () => {
    const limiter = new LoginRateLimiter(WINDOW, 5, 20);
    for (let i = 0; i < 20; i += 1) limiter.recordFailure('1.1.1.1', `user${i}@x.vn`);
    expect(limiter.check('1.1.1.1', 'new@x.vn').blocked).toBe(true);
  });

  it('clears the account counter after a successful login', () => {
    const limiter = new LoginRateLimiter(WINDOW, 5, 20);
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('1.1.1.1', 'a@x.vn');
    limiter.recordSuccess('1.1.1.1', 'a@x.vn');
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('1.1.1.1', 'a@x.vn');
    expect(limiter.check('1.1.1.1', 'a@x.vn').blocked).toBe(false);
  });

  it('forgets failures once the window has passed', () => {
    let clock = 1_000_000;
    const limiter = new LoginRateLimiter(1000, 5, 20, () => clock);
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('1.1.1.1', 'a@x.vn');
    expect(limiter.check('1.1.1.1', 'a@x.vn').blocked).toBe(true);
    clock += 1001;
    expect(limiter.check('1.1.1.1', 'a@x.vn').blocked).toBe(false);
  });
});
