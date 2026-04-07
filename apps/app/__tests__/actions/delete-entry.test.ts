import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@repo/auth/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  database: {
    journalEntry: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { deleteEntry } from '../../app/actions/entries/delete';

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(database.journalEntry.findFirst);
const mockDelete = vi.mocked(database.journalEntry.delete);

describe('deleteEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);
    const result = await deleteEntry('entry_1');
    expect(result).toHaveProperty('error');
  });

  test('returns error when entry not found', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue(null);

    const result = await deleteEntry('entry_nonexistent');
    expect(result).toHaveProperty('error');
  });

  test('returns error when entry belongs to another user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue(null); // findFirst with userId filter returns null

    const result = await deleteEntry('entry_1');
    expect(result).toHaveProperty('error');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('deletes entry belonging to user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue({ id: 'entry_1', userId: 'user_123' } as any);
    mockDelete.mockResolvedValue({} as any);

    const result = await deleteEntry('entry_1');
    expect(result).toEqual({ data: true });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'entry_1', userId: 'user_123' },
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'entry_1' } });
  });
});
