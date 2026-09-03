import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare build configuration.
 *
 * Deliberately minimal: no incremental cache is configured, because Auralis
 * renders per request against live account state. Caching pages here would show
 * people yesterday's sync status, which is worse than showing nothing.
 */
export default defineCloudflareConfig();
