import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock auth
vi.mock('@repo/auth/server', () => ({
  auth: vi.fn(),
}));

// Mock database
vi.mock('@repo/database', () => ({
  database: {
    journalEntry: {
      create: vi.fn(),
    },
  },
}));

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { createEntry } from '../../app/actions/entries/create';

const mockAuth = vi.mocked(auth);
const mockCreate = vi.mocked(database.journalEntry.create);

describe('createEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);
    const result = await createEntry('Hello');
    expect(result).toHaveProperty('error');
  });

  test('returns error for empty content', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    const result = await createEntry('   ');
    expect(result).toHaveProperty('error');
  });

  test('creates entry with valid content', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    const mockEntry = {
      id: 'entry_1',
      userId: 'user_123',
      content: 'Hello world',
      source: 'web',
      mood: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreate.mockResolvedValue(mockEntry as any);

    const result = await createEntry('Hello world');
    expect(result).toHaveProperty('data');
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_123',
        content: 'Hello world',
        source: 'web',
        mood: null,
      },
    });
  });

  test('trims whitespace from content', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockCreate.mockResolvedValue({ id: 'entry_1' } as any);

    await createEntry('  Hello  ');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: 'Hello' }),
      })
    );
  });

  test('validates mood emoji', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockCreate.mockResolvedValue({ id: 'entry_1' } as any);

    await createEntry('Hello', '😊');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mood: '😊' }),
      })
    );
  });

  test('rejects invalid mood emoji', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);
    mockCreate.mockResolvedValue({ id: 'entry_1' } as any);

    await createEntry('Hello', '💀');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mood: null }),
      })
    );
  });
});
