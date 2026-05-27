import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PluginLoaderService } from '../plugin-loader.service';
import { IPlugin, PluginContext, PluginManifest, PluginType } from '../plugin.interfaces';
import { HookContext, HookResult } from '../../hooks/hook.interfaces';

const AUTO_REPLY_MANIFEST: PluginManifest = {
  id: 'auto-reply',
  name: 'Auto Reply',
  version: '1.0.0',
  type: PluginType.EXTENSION,
  description: 'Automatically reply to incoming messages based on keyword rules',
  author: 'OpenWA',
  main: '__builtin__',
  provides: ['auto-reply'],
  hooks: ['message:received'],
  configSchema: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        title: 'Enable Auto Reply',
        description: 'Turn auto-reply on or off',
        default: true,
      },
      rules: {
        type: 'array',
        title: 'Reply Rules',
        description: 'JSON array of rules: [{"keyword":"hello","reply":"Hi there!","caseSensitive":false}]',
        default: [],
      },
    },
  },
};

@Injectable()
export class AutoReplyPlugin implements OnModuleInit, IPlugin {
  private currentCtx: PluginContext | null = null;

  constructor(
    private readonly pluginLoader: PluginLoaderService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.pluginLoader.registerBuiltInPlugin(AUTO_REPLY_MANIFEST, this);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onEnable(ctx: PluginContext): Promise<void> {
    this.currentCtx = ctx;
    ctx.registerHook('message:received', this.handleMessage.bind(this));
    ctx.logger.log('Auto Reply plugin enabled');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onDisable(_ctx: PluginContext): Promise<void> {
    this.currentCtx = null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onConfigChange(ctx: PluginContext, newConfig: Record<string, unknown>): Promise<void> {
    this.currentCtx = { ...ctx, config: newConfig };
  }

  async handleMessage(hookCtx: HookContext<unknown>): Promise<HookResult<unknown>> {
    const data = hookCtx.data as { from: string; body: string; sessionId: string };

    if (!this.currentCtx) {
      return { continue: true, data: hookCtx.data };
    }

    const config = this.currentCtx.config;

    // Check if auto-reply is enabled
    if (config.enabled === false) {
      return { continue: true, data: hookCtx.data };
    }

    const rules = config.rules as Array<{ keyword: string; reply: string; caseSensitive?: boolean }>;

    if (!Array.isArray(rules) || rules.length === 0) {
      return { continue: true, data: hookCtx.data };
    }

    const messageBody = data.body ?? '';
    const from = data.from;
    const sessionId = data.sessionId ?? hookCtx.sessionId;

    for (const rule of rules) {
      if (!rule.keyword || !rule.reply) continue;

      const keyword = rule.keyword;
      const caseSensitive = rule.caseSensitive === true;

      const bodyToCheck = caseSensitive ? messageBody : messageBody.toLowerCase();
      const keywordToCheck = caseSensitive ? keyword : keyword.toLowerCase();

      if (bodyToCheck.includes(keywordToCheck)) {
        try {
          if (sessionId) {
            // Lazy-resolve SessionService to avoid circular dependency at module init
            const { SessionService } = await import('../../../modules/session/session.service');
            const sessionService = this.moduleRef.get(SessionService, { strict: false });
            const engine = sessionService.getEngine(sessionId);
            if (engine) {
              await engine.sendTextMessage(from, rule.reply);
            } else {
              this.currentCtx.logger.warn(`Engine not found for session: ${sessionId}`);
            }
          }
        } catch (error) {
          this.currentCtx.logger.error(`Failed to send auto-reply to ${from}`, error, {
            keyword: rule.keyword,
            sessionId: sessionId ?? '',
          });
        }
        break; // Only first matching rule
      }
    }

    return { continue: true, data: hookCtx.data };
  }
}
