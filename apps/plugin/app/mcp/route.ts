/**
 * Public plugin endpoint: Streamable HTTP, no login. Mount point is the URL
 * given to ChatGPT (https://<plugin-host>/mcp). See lib/public-tools.ts.
 */

import { registerPublicPlugin } from '@/lib/public-tools';
import { SERVER_INSTRUCTIONS } from '@/lib/server-info';
import { createMcpHandler } from 'mcp-handler';

export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerPublicPlugin(server);
  },
  {
    serverInfo: { name: 'kept', version: '1.0.0' },
    instructions: SERVER_INSTRUCTIONS,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
