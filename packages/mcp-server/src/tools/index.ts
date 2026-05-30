/**
 * @repo/mcp-server/tools — registration helpers for every Bellwood MCP tool.
 *
 * Pattern: each tool file exports a `register*` function that takes an
 * `McpServer` and calls `.tool()` once. The aggregate `registerAll` below
 * wires every tool in one go. Add a new tool: create the file, add to the
 * imports + the `registerAll` body. No central registry to keep in sync.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLookupHmlr } from './lookup-hmlr';
import { registerLookupEpc } from './lookup-epc';
import { registerLookupOsPlaces } from './lookup-os-places';
import { registerLookupHpi } from './lookup-hpi';
import { registerSearchCompaniesHouse } from './search-companies-house';
import { registerQueryScoutDb } from './query-scout-db';
import { registerQueryPipeline } from './query-pipeline';
import { registerReadFounderActions } from './read-founder-actions';

export function registerAll(server: McpServer): void {
  registerLookupHmlr(server);
  registerLookupEpc(server);
  registerLookupOsPlaces(server);
  registerLookupHpi(server);
  registerSearchCompaniesHouse(server);
  registerQueryScoutDb(server);
  registerQueryPipeline(server);
  registerReadFounderActions(server);
}

export const TOOL_NAMES = [
  'lookup_hmlr_pricepaid',
  'lookup_epc',
  'lookup_os_places',
  'lookup_hpi',
  'search_companies_house',
  'search_dissolved_property_companies',
  'query_scout_db',
  'query_pipeline',
  'read_founder_actions',
] as const;
