import * as jwt from 'jsonwebtoken';
import { SocketAuthService } from './socket-auth.service';

const SECRET = 'test-chat-jwt-secret-with-32-plus-chars';

const service = (secret: string) =>
  new SocketAuthService({ get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } as any);

const socketWith = (token: string) => ({ handshake: { auth: { token }, query: {}, headers: {} } }) as any;

const staffToken = (key: Buffer | string) =>
  jwt.sign({ sub: 'u1', role: 'MANAGER', branchId: 'branch-a' }, key, { algorithm: 'HS256', expiresIn: '5m' });

describe('SocketAuthService', () => {
  it('accepts a staff token signed with JWT_SECRET', () => {
    expect(service(SECRET).verifyStaffFromSocket(socketWith(staffToken(SECRET)))).toEqual({
      userId: 'u1',
      role: 'MANAGER',
      branchId: 'branch-a',
    });
  });

  it('refuses every token while JWT_SECRET is blank, including one signed with 32 zero bytes', () => {
    const zeroKeyToken = staffToken(Buffer.alloc(32));
    expect(service('').verifyStaffFromSocket(socketWith(zeroKeyToken))).toBeNull();
    expect(service('   ').verifyStaffFromSocket(socketWith(zeroKeyToken))).toBeNull();
  });

  it('refuses a token signed with another key', () => {
    expect(service(SECRET).verifyStaffFromSocket(socketWith(staffToken(Buffer.alloc(32))))).toBeNull();
  });
});
