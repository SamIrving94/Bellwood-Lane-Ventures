import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@repo/auth/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  database: {
    journalEntry: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { updateEntry } from '../../app/actions/entries/update';

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(database.journalEntry.findFirst);
const mockUpdate = vi.mocked(database.journalEntry.update);

describe('updateEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);
    const result = await updateEntry('entry_1', 'Updated');
    expect(result).toHaveProperty('error');
  });

  test('returns error for empty content', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    const result = await updateEntry('entry_1', '   ');
    expect(result).toHaveProperty('error');
  });

  test('returns error when entry not found', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue(null);

    const result = await updateEntry('entry_1', 'Updated');
    expect(result).toHaveProperty('error');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('updates entry content', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue({
      id: 'entry_1',
      userId: 'user_123',
      mood: '😊',
    } as any);
    const updatedEntry = { id: 'entry_1', content: 'Updated text', mood: '😊' };
    mockUpdate.mockResolvedValue(updatedEntry as any);

    const result = await updateEntry('entry_1', 'Updated text');
    expect(result).toHaveProperty('data');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'entry_1' },
      data: { content: 'Updated text', mood: '😊' },
    });
  });

  test('updates mood to a valid emoji', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue({
      id: 'entry_1',
      userId: 'user_123',
      mood: null,
    } as any);
    mockUpdate.mockResolvedValue({ id: 'entry_1' } as any);

    await updateEntry('entry_1', 'Content', '😤');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'entry_1' },
      data: { content: 'Content', mood: '😤' },
    });
  });

  test('clears mood when null is passed', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockFindFirst.mockResolvedValue({
      id: 'entry_1',
      userId: 'user_123',
      mood: '😊',
    } as any);
    mockUpdate.mockResolvedValue({ id: 'entry_1' } as any);

    await updateEntry('entry_1', 'Content', null);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'entry_1' },
      data: { content: 'Content', mood: null },
    });
  });
});
