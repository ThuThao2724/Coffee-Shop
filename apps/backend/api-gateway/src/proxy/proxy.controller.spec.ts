import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ProxyController, stripUpstreamCorsHeaders } from './proxy.controller';

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

  const tableFetch = (table: Record<string, unknown>) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => table });
    (global as any).fetch = fetchMock;
    return fetchMock;
  };
  const checkMenu = async (path: string, query: Record<string, string>, authorization?: string) => {
    const req = { method: 'GET', path, headers: authorization ? { authorization } : {}, query } as any;
    try {
      await (controller as any).validateQrOrderMenuRequest(req);
      return 'allowed';
    } catch (error) {
      if (error instanceof BadRequestException) return 'bad request';
      if (error instanceof ForbiddenException) return 'forbidden';
      throw error;
    }
  };

  it('requires a scanned table for the branch menu path too', async () => {
    const fetchMock = tableFetch({ status: 'AVAILABLE', branchId: 'branch-a' });
    expect(await checkMenu('/api/orders/branches/branch-a/menu', {})).toBe('bad request');
    expect(fetchMock.mock.calls.length).toBe(0);
    expect(await checkMenu('/api/orders/branches/branch-a/menu', { tableId: 'tbl-01' })).toBe('allowed');
  });

  it('rejects a table QR used to open another branch menu', async () => {
    tableFetch({ status: 'AVAILABLE', branchId: 'branch-a' });
    expect(await checkMenu('/api/orders/menu', { tableId: 'tbl-01', branchId: 'branch-b' })).toBe('bad request');
    expect(await checkMenu('/api/orders/branches/branch-b/menu', { tableId: 'tbl-01' })).toBe('bad request');
    expect(await checkMenu('/api/orders/menu', { tableId: 'tbl-01', branchId: 'BRANCH-A' })).toBe('allowed');
    expect(await checkMenu('/api/orders/menu', { tableId: 'tbl-01' })).toBe('allowed');
  });

  it('does not let a table without a branch open a branch menu', async () => {
    tableFetch({ status: 'AVAILABLE', branchId: null });
    expect(await checkMenu('/api/orders/branches/branch-a/menu', { tableId: 'tbl-99' })).toBe('bad request');
  });

  it('treats a customer token like an anonymous guest, but lets staff skip the table', async () => {
    (jwtServiceMock.verify as any).mockReturnValue({ sub: 'c1', role: 'CUSTOMER' });
    expect(await checkMenu('/api/orders/menu', { branchId: 'branch-a' }, 'Bearer customer-token')).toBe('bad request');
    expect(await checkMenu('/api/orders/branches/branch-a/menu', {}, 'Bearer customer-token')).toBe('bad request');
    (jwtServiceMock.verify as any).mockReturnValue({ sub: 'w1', role: 'WAITER', branchId: 'branch-a' });
    expect(await checkMenu('/api/orders/branches/branch-a/menu', {}, 'Bearer staff-token')).toBe('allowed');
  });

  it('leaves branch menu item writes to the role rules', async () => {
    expect(await checkMenu('/api/orders/branches/branch-a/menu/items', {})).toBe('allowed');
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

describe('stripUpstreamCorsHeaders', () => {
  it('drops every CORS header sent by a service, keeping the others', () => {
    const headers: Record<string, unknown> = {
      'access-control-allow-origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'access-control-allow-credentials': 'true',
      'content-type': 'application/json',
      vary: 'Origin',
    };
    stripUpstreamCorsHeaders(headers);
    expect(Object.keys(headers).sort().join(',')).toBe('content-type,vary');
  });
});

describe('ProxyController public table list', () => {
  let controller: ProxyController;
  const configServiceMock = {
    get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'test-secret-that-has-at-least-32-characters' : undefined)),
  } as unknown as ConfigService;
  const jwtServiceMock = { verify: jest.fn() } as unknown as JwtService;

  const listTables = (query: Record<string, string>, authorization?: string) => {
    const req = {
      method: 'GET',
      url: '/api/tables',
      path: '/api/tables',
      query,
      headers: authorization ? { authorization } : {},
    } as any;
    try {
      (controller as any).authorizeRequest(req);
      return 'allowed';
    } catch (error) {
      return error instanceof BadRequestException ? 'branchId required' : String(error);
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProxyController(configServiceMock, jwtServiceMock);
  });

  it('refuses an anonymous list of every table of every branch', () => {
    expect(listTables({})).toBe('branchId required');
  });

  it('lets the QR flow list the tables of its own branch', () => {
    expect(listTables({ branchId: 'branch-a' })).toBe('allowed');
  });

  it('treats a customer token like an anonymous caller', () => {
    (jwtServiceMock.verify as any).mockReturnValue({ sub: 'c1', role: 'CUSTOMER' });
    expect(listTables({}, 'Bearer customer-token')).toBe('branchId required');
  });

  it('keeps the full list for staff', () => {
    (jwtServiceMock.verify as any).mockReturnValue({ sub: 'm1', role: 'MANAGER', branchId: 'branch-a' });
    expect(listTables({}, 'Bearer staff-token')).toBe('allowed');
  });
});
