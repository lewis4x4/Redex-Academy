import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSync } from './sync-manager';

const managers: { stop: () => void }[] = [];
afterEach(() => {
  for (const m of managers.splice(0)) m.stop();
});

describe('sync manager (flush on reconnect)', () => {
  it('flushes once at startup when already online', async () => {
    const flushImpl = vi.fn(async () => ({ accepted: [], rejected: [] }));
    managers.push(startSync({ syncUrl: '/sync', flushImpl }));
    await Promise.resolve();
    expect(flushImpl).toHaveBeenCalledTimes(1);
  });

  it('flushes when the browser goes back online', async () => {
    const flushImpl = vi.fn(async () => ({ accepted: [], rejected: [] }));
    managers.push(startSync({ syncUrl: '/sync', flushImpl }));
    flushImpl.mockClear();
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(flushImpl).toHaveBeenCalledTimes(1);
    expect(flushImpl).toHaveBeenCalledWith('/sync', expect.objectContaining({}));
  });

  it('passes the current token from getToken()', async () => {
    const flushImpl = vi.fn(async () => ({ accepted: [], rejected: [] }));
    managers.push(startSync({ syncUrl: '/sync', getToken: () => 'tok-123', flushImpl }));
    await Promise.resolve();
    expect(flushImpl).toHaveBeenCalledWith('/sync', expect.objectContaining({ token: 'tok-123' }));
  });

  it('stop() unregisters the online listener', async () => {
    const flushImpl = vi.fn(async () => ({ accepted: [], rejected: [] }));
    const m = startSync({ syncUrl: '/sync', flushImpl });
    m.stop();
    flushImpl.mockClear();
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(flushImpl).not.toHaveBeenCalled();
  });
});
