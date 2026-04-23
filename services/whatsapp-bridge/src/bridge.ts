import path from 'node:path';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import { config } from './config.js';
import { log } from './logger.js';

const { Client, LocalAuth } = pkg;

const DATA_DIR = path.resolve(process.cwd(), 'data');

export function createBridge() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: DATA_DIR }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr: string) => {
    log.info(
      'Scan this QR code with WhatsApp > Settings > Linked Devices > Link a Device:'
    );
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    log.info('authenticated — session cached in ./data');
  });

  client.on('auth_failure', (msg: string) => {
    log.error('auth_failure:', msg);
  });

  client.on('ready', () => {
    const info = (client as unknown as { info?: { pushname?: string } }).info;
    log.info(
      `WhatsApp bridge connected as: ${info?.pushname ?? 'unknown user'}`
    );
    log.info(`Allowed groups (${config.allowedGroups.length}):`, config.allowedGroups);
    log.info(`Forwarding to: ${config.BELLWOOD_API_URL}/agents/intake/whatsapp`);
  });

  client.on('disconnected', (reason: string) => {
    log.warn('disconnected:', reason);
  });

  client.on('message', async (message) => {
    try {
      if (message.fromMe) return;

      const chat = await message.getChat();
      if (!chat.isGroup) return;

      const groupName = chat.name;
      if (!config.allowedGroups.includes(groupName)) {
        log.debug(`skipping message from non-allowed group "${groupName}"`);
        return;
      }

      const contact = await message.getContact();
      const senderName =
        contact.pushname || contact.name || contact.shortName || undefined;
      const senderPhone = contact.number || undefined;

      let rawText = message.body ?? '';
      const mediaUrls: string[] = [];

      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            rawText = rawText
              ? `${rawText}\n[Media attached: ${media.mimetype}]`
              : `[Media attached: ${media.mimetype}]`;
          }
        } catch (err) {
          log.warn('media download failed:', err);
        }
      }

      if (!rawText.trim()) {
        log.debug('skipping empty message');
        return;
      }

      const payload = {
        source: 'bridge' as const,
        rawText,
        groupName,
        senderName,
        senderPhone,
        mediaUrls,
        receivedAt: new Date(message.timestamp * 1000).toISOString(),
      };

      log.info(
        `forwarding message from "${groupName}" by ${senderName ?? 'unknown'} (${rawText.length} chars)`
      );

      const res = await fetch(
        `${config.BELLWOOD_API_URL}/agents/intake/whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.PAPERCLIP_API_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        log.error(`intake API ${res.status}:`, txt || res.statusText);
        return;
      }

      const result = (await res.json()) as {
        intakeId: string;
        parseStatus: string;
      };
      log.info(
        `intake ok — id=${result.intakeId} status=${result.parseStatus}`
      );
    } catch (err) {
      log.error('message handler error:', err);
    }
  });

  return client;
}
