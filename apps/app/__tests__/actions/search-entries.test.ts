import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@repo/auth/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  database: {
    journalEntry: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { searchEntries } from '../../app/actions/entries/search';

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(database.journalEntry.findMany);

describe('searchEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);
    const result = await searchEntries('hello');
    expect(result).toHaveProperty('error');
  });

  test('returns all entries for empty query', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }] as any);

    const result = await searchEntries('');
    expect(result).toHaveProperty('data');
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'user_123' },
      orderBy: { createdAt: 'desc' },
    });
  });

  test('searches with case-insensitive contains', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindMany.mockResolvedValue([{ id: 'e1' }] as any);

    const result = await searchEntries('grateful');
    expect(result).toHaveProperty('data');
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_123',
        content: { contains: 'grateful', mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  test('trims query whitespace', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindMany.mockResolvedValue([] as any);

    await searchEntries('  hello  ');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          content: { contains: 'hello', mode: 'insensitive' },
        }),
      })
    );
  });
});
