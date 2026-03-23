import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const sendJsonMock = vi.fn();
const clearPlatformSessionMock = vi.fn();
const getPlatformBaseUrlMock = vi.fn(() => 'http://127.0.0.1:3000');
const getPlatformUrlMapMock = vi.fn(() => ({
  credits: 'http://127.0.0.1:3000/embed/credits',
  login: 'http://127.0.0.1:3000/login?next=/embed/profile',
  marketplace: 'http://127.0.0.1:3000/embed/marketplace',
  profile: 'http://127.0.0.1:3000/embed/profile',
}));
const platformJsonMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/platform', () => ({
  clearPlatformSession: (...args: unknown[]) => clearPlatformSessionMock(...args),
  getPlatformBaseUrl: () => getPlatformBaseUrlMock(),
  getPlatformUrlMap: () => getPlatformUrlMapMock(),
  platformJson: (...args: unknown[]) => platformJsonMock(...args),
}));

describe('handlePlatformRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPlatformBaseUrlMock.mockReturnValue('http://127.0.0.1:3000');
    getPlatformUrlMapMock.mockReturnValue({
      credits: 'http://127.0.0.1:3000/embed/credits',
      login: 'http://127.0.0.1:3000/login?next=/embed/profile',
      marketplace: 'http://127.0.0.1:3000/embed/marketplace',
      profile: 'http://127.0.0.1:3000/embed/profile',
    });
  });

  it('returns disconnected auth status when platform session is not authenticated', async () => {
    platformJsonMock.mockResolvedValueOnce({
      data: null,
      ok: false,
      status: 401,
    });
    const { handlePlatformRoutes } = await import('@electron/api/routes/platform');

    const handled = await handlePlatformRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/platform/auth/status'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      connected: false,
      user: null,
    }));
  });

  it('returns connected auth status when /api/me resolves successfully', async () => {
    platformJsonMock.mockResolvedValueOnce({
      data: {
        display_name: 'Bo',
        email: 'bo@example.com',
        id: 'user-1',
        source: 'session',
      },
      ok: true,
      status: 200,
    });
    const { handlePlatformRoutes } = await import('@electron/api/routes/platform');

    await handlePlatformRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/platform/auth/status'),
      {} as never,
    );

    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      connected: true,
      user: expect.objectContaining({
        display_name: 'Bo',
        email: 'bo@example.com',
      }),
    }));
  });

  it('clears the dedicated platform session on disconnect', async () => {
    const { handlePlatformRoutes } = await import('@electron/api/routes/platform');

    await handlePlatformRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/platform/auth/disconnect'),
      {} as never,
    );

    expect(clearPlatformSessionMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });
});
