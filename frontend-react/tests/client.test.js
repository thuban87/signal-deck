import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  let client;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    client = await import('../src/api/client');
    client.setTokenProvider(() => 'test-token-123');
    client.setLogoutHandler(() => {});
  });

  it('injects Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await client.get('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-123',
      },
    });
  });

  it('calls logout handler on 401', async () => {
    const logoutFn = vi.fn();
    client.setLogoutHandler(logoutFn);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    await client.get('/api/protected');
    expect(logoutFn).toHaveBeenCalled();
  });

  it('throws on non-401 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Server error' }),
    });

    await expect(client.get('/api/broken')).rejects.toThrow('Server error');
  });

  it('sends POST body as JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await client.post('/api/data', { key: 'value' });

    expect(mockFetch).toHaveBeenCalledWith('/api/data', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-123',
      },
    });
  });
});
