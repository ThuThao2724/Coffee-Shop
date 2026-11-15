import { buildCorsOriginCheck } from './cors-origin';

// The gateway has no @types/jest; declare the globals this spec uses, like the other specs here.
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare const jest: any;
declare function expect(value: unknown): any;

describe('buildCorsOriginCheck', () => {
  const check = buildCorsOriginCheck(['https://app.example.com', ' https://admin.example.com ']);
  const decide = (origin?: string) => {
    const callback = jest.fn();
    check(origin, callback);
    return callback.mock.calls[0];
  };

  it('allows listed origins', () => {
    expect(decide('https://app.example.com')).toEqual([null, true]);
    expect(decide('https://admin.example.com')).toEqual([null, true]);
  });

  it('allows requests without an Origin header (server-to-server, curl)', () => {
    expect(decide(undefined)).toEqual([null, true]);
  });

  it('answers an unlisted origin without CORS headers instead of failing the request', () => {
    // An error here becomes a 500 for the whole request, including same-origin POSTs.
    expect(decide('https://new-tunnel.trycloudflare.com')).toEqual([null, false]);
    expect(decide('https://evil.example')).toEqual([null, false]);
  });

  it('allows every origin when ALLOWED_ORIGINS is empty (local development)', () => {
    const open = buildCorsOriginCheck([]);
    const callback = jest.fn();
    open('http://localhost:5173', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
