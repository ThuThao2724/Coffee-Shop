import { BadRequestException, ForbiddenException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentService } from './payment.service';

/**
 * Covers the payment rules that protect money:
 *  - the charged amount always comes from order-service, never from the client;
 *  - SePay IPN webhooks need the API key, accumulate partial transfers and ignore retries.
 */

type ConfigValues = Record<string, string>;

beforeAll(() => Logger.overrideLogger(false));

function makeService(configValues: ConfigValues = {}) {
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentRelayEvent: {
      create: jest.fn(async ({ data }: any) => ({ id: 7, createdAt: new Date('2026-11-15T00:00:00Z'), ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    },
  };
  const kafka = { emit: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => (key in configValues ? configValues[key] : fallback)),
  };
  const service = new PaymentService(prisma as any, kafka as any, config as any);
  // Retries wait between attempts; tests must not.
  jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  return { service, prisma };
}

function orderResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('PaymentService.resolveOrderAmount', () => {
  const fetchMock = jest.fn();
  const resolve = (service: PaymentService, orderId: string, clientAmount?: number) =>
    (service as any).resolveOrderAmount(orderId, clientAmount) as Promise<number>;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('uses the order total and ignores a lower amount sent by the client', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(orderResponse(200, { status: 'PENDING', totalAmount: 85000 }));

    await expect(resolve(service, 'ORDER1', 1000)).resolves.toBe(85000);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://order-service:3001/api/orders/ORDER1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rounds a fractional order total', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(orderResponse(200, { status: 'PENDING', totalAmount: 45000.4 }));

    await expect(resolve(service, 'ORDER1')).resolves.toBe(45000);
  });

  it('refuses a cancelled order', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(orderResponse(200, { status: 'cancelled', totalAmount: 50000 }));

    await expect(resolve(service, 'ORDER1', 50000)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an order without a payable amount', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(orderResponse(200, { status: 'PENDING', totalAmount: 0 }));

    await expect(resolve(service, 'ORDER1', 1000)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when the order does not exist', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(orderResponse(404));

    await expect(resolve(service, 'MISSING', 1000)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not fall back to the client amount when order-service fails', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(orderResponse(500));

    await expect(resolve(service, 'ORDER1', 1000)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not fall back to the client amount when order-service is unreachable', async () => {
    const { service } = makeService();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(resolve(service, 'ORDER1', 1000)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('PaymentService.handleWebhook (SePay IPN)', () => {
  const API_KEY = 'test-ipn-key-0123456789'; // gitleaks:allow (fake key used only by this test)
  const basePayment = {
    id: 'pay_1',
    orderId: 'ORDER1',
    provider: 'SEPAY',
    amount: 85000,
    status: PaymentStatus.WAITING_TRANSFER,
    transactionId: 'sepay_ORDER1_1',
    transferContent: 'PAY ORDER1-ABC',
    metadata: {} as Record<string, any>,
  };

  /** Service whose payment lookup returns `payment` and whose status updates are captured. */
  function setup(payment: typeof basePayment | null = { ...basePayment, metadata: {} }) {
    const { service, prisma } = makeService({ SEPAY_IPN_AUTH_TYPE: 'apikey', SEPAY_IPN_API_KEY: API_KEY });
    jest.spyOn(service as any, 'resolvePaymentFromSepayPayload').mockResolvedValue(payment);
    const update = jest
      .spyOn(service as any, 'updatePaymentStatus')
      .mockImplementation(async (id: any, status: any, _tx: any, metadata: any) => {
        if (payment) {
          payment.status = status;
          payment.metadata = { ...payment.metadata, ...metadata };
        }
        return { id, status };
      });
    return { service, prisma, update };
  }

  const headers = { authorization: `Apikey ${API_KEY}` };
  const transfer = (id: number, amount: number) => ({
    id,
    transferType: 'in',
    transferAmount: amount,
    content: 'PAY ORDER1-ABC',
  });

  it('rejects a webhook without the API key', async () => {
    const { service, update } = setup();

    await expect(service.handleWebhook(transfer(1, 85000), {})).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a webhook with a wrong API key', async () => {
    const { service, update } = setup();

    await expect(
      service.handleWebhook(transfer(1, 85000), { authorization: 'Apikey wrong-key' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('marks the payment PAID when the full amount arrives', async () => {
    const { service, update } = setup();

    const result = await service.handleWebhook(transfer(1, 85000), headers);

    expect(result).toMatchObject({ success: true, newStatus: PaymentStatus.PAID, amountReceived: 85000 });
    expect(update).toHaveBeenCalledWith('pay_1', PaymentStatus.PAID, '1', expect.any(Object));
  });

  it('keeps an underpaid transfer waiting and reports the shortfall', async () => {
    const { service } = setup();

    const result = await service.handleWebhook(transfer(1, 50000), headers);

    expect(result).toMatchObject({
      newStatus: PaymentStatus.WAITING_TRANSFER,
      underpaid: true,
      amountReceived: 50000,
      amountShortfall: 35000,
    });
  });

  it('adds up an underpaid transfer and its top-up', async () => {
    const { service } = setup();

    await service.handleWebhook(transfer(1, 50000), headers);
    const result = await service.handleWebhook(transfer(2, 35000), headers);

    expect(result).toMatchObject({ newStatus: PaymentStatus.PAID, amountReceived: 85000 });
  });

  it('does not count a resent webhook (same SePay id) twice', async () => {
    const { service } = setup();

    await service.handleWebhook(transfer(7, 50000), headers);
    const result = await service.handleWebhook(transfer(7, 50000), headers);

    expect(result).toMatchObject({
      newStatus: PaymentStatus.WAITING_TRANSFER,
      amountReceived: 50000,
      amountShortfall: 35000,
    });
  });

  it('ignores a transfer that matches no payment', async () => {
    const { service, update } = setup(null);

    await expect(service.handleWebhook(transfer(1, 85000), headers)).resolves.toMatchObject({
      ignored: true,
      reason: 'payment-not-found',
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('PaymentService SePay authentication and relay', () => {
  const API_KEY = 'test-ipn-key-0123456789'; // gitleaks:allow (fake key used only by this test)
  const RELAY_SECRET = 'test-relay-secret-0123456789'; // gitleaks:allow (fake secret used only by this test)
  const forgedTransfer = { id: 99, transferType: 'in', transferAmount: 85000, content: 'PAY ORDER1-ABC' };

  it('refuses webhooks when no SePay key is configured instead of accepting them all', async () => {
    const { service } = makeService({ SEPAY_IPN_AUTH_TYPE: 'either' });
    const update = jest.spyOn(service as any, 'updatePaymentStatus');

    await expect(service.handleWebhook(forgedTransfer, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('relay ingest is refused while the relay is not configured', async () => {
    const { service, prisma } = makeService({ SEPAY_IPN_AUTH_TYPE: 'apikey', SEPAY_IPN_API_KEY: API_KEY });

    await expect(
      service.relayIngest(forgedTransfer, { authorization: `Apikey ${API_KEY}` }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.paymentRelayEvent.create).not.toHaveBeenCalled();
  });

  it('relay ingest needs the SePay API key, so a forged transfer is never stored', async () => {
    const { service, prisma } = makeService({
      SEPAY_IPN_AUTH_TYPE: 'apikey',
      SEPAY_IPN_API_KEY: API_KEY,
      SEPAY_RELAY_SHARED_SECRET: RELAY_SECRET,
    });

    await expect(service.relayIngest(forgedTransfer, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.relayIngest(forgedTransfer, { authorization: 'Apikey wrong-key' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.paymentRelayEvent.create).not.toHaveBeenCalled();
  });

  it('relay ingest stores an authentic IPN without its credentials', async () => {
    const { service, prisma } = makeService({
      SEPAY_IPN_AUTH_TYPE: 'apikey',
      SEPAY_IPN_API_KEY: API_KEY,
      SEPAY_RELAY_SHARED_SECRET: RELAY_SECRET,
    });

    await service.relayIngest(forgedTransfer, {
      authorization: `Apikey ${API_KEY}`,
      'content-type': 'application/json',
      'x-relay-token': RELAY_SECRET,
    });

    const stored = prisma.paymentRelayEvent.create.mock.calls[0][0].data.headers;
    expect(stored).toEqual({ 'content-type': 'application/json' });
  });

  it('relay pull needs the shared secret, and is closed while none is configured', async () => {
    const open = makeService({});
    await expect(open.service.relayPull({}, {})).rejects.toBeInstanceOf(ForbiddenException);

    const { service, prisma } = makeService({ SEPAY_RELAY_SHARED_SECRET: RELAY_SECRET });
    await expect(service.relayPull({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.relayPull({}, { 'x-relay-token': 'wrong' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.paymentRelayEvent.findMany).not.toHaveBeenCalled();

    await expect(service.relayPull({}, { 'x-relay-token': RELAY_SECRET })).resolves.toMatchObject({ success: true });
  });

  it('the relay bypass header without the right secret still needs the API key', async () => {
    const { service } = makeService({
      SEPAY_IPN_AUTH_TYPE: 'apikey',
      SEPAY_IPN_API_KEY: API_KEY,
      SEPAY_RELAY_SHARED_SECRET: RELAY_SECRET,
    });
    const update = jest.spyOn(service as any, 'updatePaymentStatus');

    await expect(
      service.handleWebhook(forgedTransfer, { 'x-relay-internal': '1', 'x-relay-token': 'guess' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
