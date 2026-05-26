import { Injectable, NotFoundException } from '@nestjs/common';
import { PluginLoaderService, PluginStatus } from '../../core/plugins';
import { PluginDto } from './dto/plugin.dto';

export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: string;
  builtIn: boolean;
  installed: boolean;
  npmPackage?: string;
  repositoryUrl?: string;
  tags: string[];
}

@Injectable()
export class PluginsService {
  constructor(private readonly pluginLoader: PluginLoaderService) {}

  findAll(): PluginDto[] {
    const plugins = this.pluginLoader.getAllPlugins();

    return plugins.map(plugin => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      type: plugin.manifest.type,
      description: plugin.manifest.description,
      author: plugin.manifest.author,
      status: plugin.status,
      config: plugin.config,
      builtIn: plugin.manifest.id === 'whatsapp-web.js', // Built-in engines
      provides: plugin.manifest.provides ?? [],
      configSchema: plugin.manifest.configSchema,
      loadedAt: plugin.loadedAt?.toISOString(),
      enabledAt: plugin.enabledAt?.toISOString(),
      error: plugin.error,
    }));
  }

  findOne(id: string): PluginDto {
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    return {
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      type: plugin.manifest.type,
      description: plugin.manifest.description,
      author: plugin.manifest.author,
      status: plugin.status,
      config: plugin.config,
      builtIn: plugin.manifest.id === 'whatsapp-web.js',
      provides: plugin.manifest.provides ?? [],
      configSchema: plugin.manifest.configSchema,
      loadedAt: plugin.loadedAt?.toISOString(),
      enabledAt: plugin.enabledAt?.toISOString(),
      error: plugin.error,
    };
  }

  async enable(id: string): Promise<{ success: boolean; message: string }> {
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    if (plugin.status === PluginStatus.ENABLED) {
      return { success: true, message: `Plugin ${id} is already enabled` };
    }

    try {
      await this.pluginLoader.enablePlugin(id);
      return { success: true, message: `Plugin ${id} enabled successfully` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async disable(id: string): Promise<{ success: boolean; message: string }> {
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    if (plugin.status !== PluginStatus.ENABLED) {
      return { success: true, message: `Plugin ${id} is not enabled` };
    }

    try {
      await this.pluginLoader.disablePlugin(id);
      return { success: true, message: `Plugin ${id} disabled successfully` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  updateConfig(id: string, config: Record<string, unknown>): { success: boolean; message: string } {
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    try {
      this.pluginLoader.updatePluginConfig(id, config);
      return { success: true, message: `Plugin ${id} configuration updated` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async healthCheck(id: string): Promise<{ healthy: boolean; message?: string }> {
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    if (!plugin.instance?.healthCheck) {
      return { healthy: true, message: 'Plugin does not implement health check' };
    }

    try {
      return await plugin.instance.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getMarketplace(): MarketplacePlugin[] {
    const autoReplyInstalled = this.pluginLoader.getPlugin('auto-reply') !== undefined;

    return [
      {
        id: 'auto-reply',
        name: 'Auto Reply',
        version: '1.0.0',
        description: 'Automatically reply to messages based on keyword rules',
        author: 'OpenWA Team',
        type: 'extension',
        builtIn: true,
        installed: autoReplyInstalled,
        tags: ['automation', 'productivity'],
      },
      {
        id: 'openwa-scheduler',
        name: 'Message Scheduler',
        version: '1.0.0',
        description: 'Schedule messages to be sent at specific times',
        author: 'OpenWA Team',
        type: 'extension',
        builtIn: false,
        installed: false,
        npmPackage: 'openwa-scheduler-plugin',
        repositoryUrl: 'https://github.com/openwa/scheduler-plugin',
        tags: ['automation', 'scheduling'],
      },
      {
        id: 'openwa-chatgpt',
        name: 'ChatGPT Integration',
        version: '1.0.0',
        description: 'Connect your WhatsApp to ChatGPT for AI-powered responses',
        author: 'Community',
        type: 'extension',
        builtIn: false,
        installed: false,
        npmPackage: 'openwa-chatgpt-plugin',
        repositoryUrl: 'https://github.com/openwa/chatgpt-plugin',
        tags: ['ai', 'automation'],
      },
      {
        id: 'openwa-s3-storage',
        name: 'S3 Storage',
        version: '1.0.0',
        description: 'Store media files in Amazon S3 or compatible storage',
        author: 'OpenWA Team',
        type: 'storage',
        builtIn: false,
        installed: false,
        npmPackage: 'openwa-s3-plugin',
        repositoryUrl: 'https://github.com/openwa/s3-plugin',
        tags: ['storage', 'aws'],
      },
    ];
  }
}
