import { Global, Module } from '@nestjs/common';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginStorageService } from './plugin-storage.service';
import { AutoReplyPlugin } from './built-in/auto-reply.plugin';

@Global() // Make plugin services available everywhere
@Module({
  providers: [PluginStorageService, PluginLoaderService, AutoReplyPlugin],
  exports: [PluginLoaderService, PluginStorageService, AutoReplyPlugin],
})
export class PluginsModule {}
