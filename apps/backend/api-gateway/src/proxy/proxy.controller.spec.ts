import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ProxyController } from './proxy.controller';

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => Promise<void> | void): void;
declare function beforeEach(fn: () => void): void;
declare const jest: any;
declare function expect(value: unknown): {
  toBe(expected: unknown): void;
  toBeInstanceOf(expected: any): void;
  toContain(expected: string): void;
};

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => {
    return (_req: unknown, _res: unknown, next?: (err?: Error) => void) => {
      if (next) next();
    };
  }),
}));

describe('ProxyController QR menu validation', () => {
  let controller: ProxyController;
  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-that-has-at-least-32-characters';
      if (key === 'TABLE_SERVICE_URL') return 'http://table-service:3003';
      if (key === 'MENU_QR_ALLOW_BRANCH_ONLY_TEST') return false;
      return undefined;
    }),
  } as unknown as ConfigService;

  const jwtServiceMock = {
    verify: jest.fn(),
  } as unknown as JwtService;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProxyController(configServiceMock, jwtServiceMock);
  });

  it('rejects customer menu request when table is CLEANING', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'CLEANING' }),
    });
    (global as any).fetch = fetchMock;

    const req = {
      method: 'GET',
      path: '/api/orders/menu',
      headers: {},
      query: { tableId: 'tbl-01' },
    } as any;

    let thrown: unknown;
    try {
      await (controller as any).validateQrOrderMenuRequest(req);
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof ForbiddenException).toBe(true);
    expect(String((thrown as any)?.message || '')).toContain('Ban hien khong kha dung');
  });

  it('rejects customer menu request without tableId', async () => {
    const req = {
      method: 'GET',
      path: '/api/orders/menu',
      headers: {},
      query: {},
    } as any;

    let thrown: unknown;
    try {
      await (controller as any).validateQrOrderMenuRequest(req);
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof BadRequestException).toBe(true);
  });
});

describe('ProxyController path variants cannot skip authorization', () => {
  let controller: ProxyController;
  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-that-has-at-least-32-characters';
      return undefined;
    }),
  } as unknown as ConfigService;
  const jwtServiceMock = { verify: jest.fn() } as unknown as JwtService;

  // Like Express: `path` is derived from `url`, so rewriting the URL changes the path.
  const makeReq = (method: string, url: string) =>
    ({
      method,
      url,
      headers: {},
      query: {},
      get path() {
        return String(this.url).split('?')[0];
      },
    }) as any;

  const authorizeAfterCanonicalization = (req: any) => {
    (controller as any).canonicalizeRequestUrl(req);
    let thrown: unknown;
    try {
      (controller as any).authorizeRequest(req);
    } catch (error) {
      thrown = error;
    }
    return thrown;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProxyController(configServiceMock, jwtServiceMock);
  });

  it('collapses repeated slashes and drops a trailing slash, keeping the query and id case', () => {
    const req = makeReq('GET', '/api/orders//Order-ABC/items/?x=1');
    req.originalUrl = '/api/orders//Order-ABC/items/?x=1';
    (controller as any).canonicalizeRequestUrl(req);
    expect(req.url).toBe('/api/orders/Order-ABC/items?x=1');
    // The proxy forwards originalUrl, so it must be canonical too.
    expect(req.originalUrl).toBe('/api/orders/Order-ABC/items?x=1');
  });

  it('requires a token for admin menu and promotion paths written in any letter case', () => {
    for (const url of [
      '/api/orders/admin/menu/items',
      '/api/orders/ADMIN/menu/items',
      '/api/orders/Admin/promotions',
      '/API/Orders/admin/menu/categories',
    ]) {
      const thrown = authorizeAfterCanonicalization(makeReq('POST', url));
      expect(thrown instanceof UnauthorizedException).toBe(true);
    }
  });

  it('requires a token when slashes are doubled or trailing', () => {
    for (const url of [
      '/api/orders//admin/menu/items',
      '/api/orders/admin/menu/items/',
      '/api/orders/table-actions/transfer/',
      '/api/orders/Table-actions/transfer',
    ]) {
      const thrown = authorizeAfterCanonicalization(makeReq('POST', url));
      expect(thrown instanceof UnauthorizedException).toBe(true);
    }
  });

  it('still validates the QR table when the menu path is written in another case', async () => {
    const req = makeReq('GET', '/api/orders/Menu');
    let thrown: unknown;
    try {
      await (controller as any).validateQrOrderMenuRequest(req);
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof BadRequestException).toBe(true);
  });
});
