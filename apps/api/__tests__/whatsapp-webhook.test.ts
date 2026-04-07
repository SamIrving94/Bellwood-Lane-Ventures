import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock all external dependencies
vi.mock('@repo/database', () => ({
  database: {
    phoneMapping: { findUnique: vi.fn() },
    journalEntry: { create: vi.fn(), findMany: vi.fn() },
    userPreference: { findUnique: vi.fn() },
  },
}));

vi.mock('@repo/observability/log', () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@repo/whatsapp', () => ({
  sendWelcomeMessage: vi.fn(),
  sendWhatsAppMessage: vi.fn(),
}));

vi.mock('@repo/whatsapp/keys', () => ({
  keys: () => ({
    TWILIO_ACCOUNT_SID: null,
    TWILIO_AUTH_TOKEN: null, // Skip signature verification in tests
    TWILIO_WHATSAPP_NUMBER: null,
    OPENAI_API_KEY: null,
  }),
}));

vi.mock('@repo/whatsapp/transcribe', () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock('twilio', () => {
  const validateRequest = vi.fn(() => true);
  const mockClient = vi.fn(() => ({ messages: { create: vi.fn() } }));
  // Twilio exports a callable default + validateRequest as a static
  Object.assign(mockClient, { validateRequest });
  return { default: mockClient };
});

import { database } from '@repo/database';
import { sendWelcomeMessage, sendWhatsAppMessage } from '@repo/whatsapp';
import { transcribeAudio } from '@repo/whatsapp/transcribe';
import { POST } from '../app/webhooks/whatsapp/route';

const mockFindPhone = vi.mocked(database.phoneMapping.findUnique);
const mockCreateEntry = vi.mocked(database.journalEntry.create);
const mockSendWelcome = vi.mocked(sendWelcomeMessage);
const mockSendMessage = vi.mocked(sendWhatsAppMessage);
const mockTranscribe = vi.mocked(transcribeAudio);

function buildRequest(params: Record<string, string>): Request {
  const body = new URLSearchParams(params).toString();
  return new Request('https://example.com/webhooks/whatsapp', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('WhatsApp webhook POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns 200 for text message from linked user', async () => {
    mockFindPhone.mockResolvedValue({
      id: 'pm_1',
      phoneNumber: '+447123456789',
      userId: 'user_123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCreateEntry.mockResolvedValue({} as any);

    const req = buildRequest({
      MessageSid: 'SM001',
      From: 'whatsapp:+447123456789',
      Body: 'Had a great day today',
      NumMedia: '0',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockCreateEntry).toHaveBeenCalledWith({
      data: {
        userId: 'user_123',
        content: 'Had a great day today',
        source: 'whatsapp',
      },
    });
  });

  test('sends welcome for unknown phone number', async () => {
    mockFindPhone.mockResolvedValue(null);
    mockSendWelcome.mockResolvedValue(undefined);

    const req = buildRequest({
      MessageSid: 'SM002',
      From: 'whatsapp:+449999999999',
      Body: 'Hello',
      NumMedia: '0',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSendWelcome).toHaveBeenCalledWith('+449999999999');
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  test('handles /help command', async () => {
    mockFindPhone.mockResolvedValue({
      id: 'pm_1',
      phoneNumber: '+447123456789',
      userId: 'user_123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSendWelcome.mockResolvedValue(undefined);

    const req = buildRequest({
      MessageSid: 'SM003',
      From: 'whatsapp:+447123456789',
      Body: '/help',
      NumMedia: '0',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSendWelcome).toHaveBeenCalled();
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  test('handles voice message transcription', async () => {
    mockFindPhone.mockResolvedValue({
      id: 'pm_1',
      phoneNumber: '+447123456789',
      userId: 'user_123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTranscribe.mockResolvedValue('Transcribed voice note');
    mockCreateEntry.mockResolvedValue({} as any);

    const req = buildRequest({
      MessageSid: 'SM004',
      From: 'whatsapp:+447123456789',
      Body: '',
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/media/123',
      MediaContentType0: 'audio/ogg',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockTranscribe).toHaveBeenCalledWith(
      'https://api.twilio.com/media/123',
      'audio/ogg'
    );
  });

  test('returns 200 when no From field', async () => {
    const req = buildRequest({
      MessageSid: 'SM005',
      Body: 'test',
      NumMedia: '0',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFindPhone).not.toHaveBeenCalled();
  });

  test('skips duplicate MessageSid', async () => {
    mockFindPhone.mockResolvedValue({
      id: 'pm_1',
      phoneNumber: '+447123456789',
      userId: 'user_123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCreateEntry.mockResolvedValue({} as any);

    const params = {
      MessageSid: 'SM_DUP_TEST',
      From: 'whatsapp:+447123456789',
      Body: 'Duplicate test',
      NumMedia: '0',
    };

    // First call should process
    await POST(buildRequest(params));
    expect(mockCreateEntry).toHaveBeenCalledTimes(1);

    // Second call with same MessageSid should be skipped
    await POST(buildRequest(params));
    expect(mockCreateEntry).toHaveBeenCalledTimes(1); // Still 1
  });
});
