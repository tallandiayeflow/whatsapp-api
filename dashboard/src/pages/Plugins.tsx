import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Puzzle,
  Power,
  PowerOff,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  Database,
  Server,
  Shield,
  Zap,
  X,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { pluginsApi } from '../services/api';
import type { Plugin, PluginConfigSchema, MarketplacePlugin } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  usePluginsQuery,
  useEnginesQuery,
  useCurrentEngineQuery,
  useInfraStatusQuery,
  queryKeys,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import './Plugins.css';

type PluginType = 'engine' | 'storage' | 'queue' | 'auth' | 'extension';

const pluginTypeIcons: Record<PluginType, typeof Puzzle> = {
  engine: Cpu,
  storage: Database,
  queue: Server,
  auth: Shield,
  extension: Zap,
};

interface EngineConfig {
  type: string;
  headless: boolean;
  sessionDataPath: string;
  browserArgs: string;
}

// ── Schema-driven field renderer ─────────────────────────────────────────────

interface SchemaFieldProps {
  propKey: string;
  propDef: PluginConfigSchema['properties'][string];
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

function SchemaField({ propKey, propDef, value, onChange }: SchemaFieldProps) {
  const { t } = useTranslation();
  const label = propDef.title ?? propKey;

  if (propDef.type === 'boolean') {
    return (
      <div className="form-group toggle-group">
        <div className="toggle-info">
          <label>{label}</label>
          {propDef.description && <small>{propDef.description}</small>}
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={value === true}
            onChange={e => onChange(propKey, e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    );
  }

  if (propDef.type === 'array') {
    const textValue = typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2);
    return (
      <div className="form-group">
        <label>{label}</label>
        <textarea
          rows={4}
          value={textValue}
          onChange={e => onChange(propKey, e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-light)', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.875rem' }}
        />
        {propDef.description && <small>{propDef.description}</small>}
        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>{t('plugins.config.jsonArrayHint')}</small>
      </div>
    );
  }

  if (propDef.type === 'number') {
    return (
      <div className="form-group">
        <label>{label}</label>
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={e => onChange(propKey, e.target.valueAsNumber)}
        />
        {propDef.description && <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>{propDef.description}</small>}
      </div>
    );
  }

  // string (default), with secret support
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={propDef.secret === true ? 'password' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(propKey, e.target.value)}
      />
      {propDef.description && <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>{propDef.description}</small>}
    </div>
  );
}

// ── Marketplace Modal ─────────────────────────────────────────────────────────

interface MarketplaceModalProps {
  onClose: () => void;
}

function MarketplaceModal({ onClose }: MarketplaceModalProps) {
  const { t } = useTranslation();
  const { data: plugins = [], isLoading, error } = useQuery({
    queryKey: ['plugins', 'marketplace'],
    queryFn: pluginsApi.getMarketplace,
    staleTime: 60_000,
  });

  return (
    <div className="modal-overlay" aria-hidden="true" onClick={onClose}>
      <div className="modal marketplace-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('plugins.marketplace.title')}</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 className="animate-spin" size={32} />
            </div>
          )}

          {error && (
            <div className="error-banner">
              <AlertCircle size={20} />
              <span className="error-banner-text">{error instanceof Error ? error.message : String(error)}</span>
            </div>
          )}

          {!isLoading && !error && plugins.length === 0 && (
            <div className="no-config">
              <Puzzle size={48} style={{ opacity: 0.3 }} />
              <p>{t('plugins.marketplace.noResults')}</p>
            </div>
          )}

          {!isLoading && plugins.length > 0 && (
            <div className="marketplace-grid">
              {plugins.map((plugin: MarketplacePlugin) => (
                <div key={plugin.id} className="marketplace-card">
                  <div className="marketplace-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="marketplace-plugin-name">{plugin.name}</span>
                      <span className="marketplace-version-badge">v{plugin.version}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {plugin.installed && (
                        <span className="marketplace-badge installed">{t('plugins.marketplace.installed')}</span>
                      )}
                      {plugin.builtIn && (
                        <span className="marketplace-badge builtin">{t('plugins.marketplace.builtIn')}</span>
                      )}
                      <span className="marketplace-badge type">{plugin.type}</span>
                    </div>
                  </div>

                  <div className="marketplace-card-body">
                    <p className="marketplace-description">{plugin.description}</p>

                    <div className="marketplace-meta">
                      <span className="marketplace-author">by {plugin.author}</span>
                    </div>

                    {plugin.tags.length > 0 && (
                      <div className="marketplace-tags">
                        {plugin.tags.map(tag => (
                          <span key={tag} className="marketplace-tag">{tag}</span>
                        ))}
                      </div>
                    )}

                    {plugin.repositoryUrl && (
                      <a
                        href={plugin.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="marketplace-github-link"
                      >
                        <ExternalLink size={14} />
                        {t('plugins.marketplace.viewOnGithub')}
                      </a>
                    )}

                    {!plugin.installed && !plugin.builtIn && plugin.npmPackage && (
                      <div className="marketplace-install-hint">
                        <span className="marketplace-install-label">{t('plugins.marketplace.installWith')}</span>
                        <code className="marketplace-install-code">npm install {plugin.npmPackage}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Plugins() {
  const { t } = useTranslation();
  useDocumentTitle(t('plugins.title'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: plugins = [], isLoading: loadingPlugins, error: queryError } = usePluginsQuery();
  const { data: engines = [] } = useEnginesQuery();
  const { data: currentEngineData } = useCurrentEngineQuery();
  const { data: infraStatus } = useInfraStatusQuery();
  const currentEngine = currentEngineData?.engineType ?? '';
  const loading = loadingPlugins;
  const error = queryError instanceof Error ? queryError.message : null;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [engineConfig, setEngineConfig] = useState<EngineConfig>({
    type: infraStatus?.engine?.type || 'whatsapp-web.js',
    headless: infraStatus?.engine?.headless ?? true,
    sessionDataPath: '/data/sessions',
    browserArgs: '--no-sandbox --disable-gpu',
  });
  const [genericConfig, setGenericConfig] = useState<Record<string, unknown>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const [showMarketplace, setShowMarketplace] = useState(false);

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.plugins });
    void queryClient.invalidateQueries({ queryKey: queryKeys.engines });
    void queryClient.invalidateQueries({ queryKey: queryKeys.currentEngine });
  };

  const handleToggle = async (plugin: Plugin) => {
    setActionLoading(plugin.id);
    try {
      if (plugin.status === 'enabled') {
        await pluginsApi.disable(plugin.id);
      } else {
        await pluginsApi.enable(plugin.id);
      }
      refetchAll();
    } catch (err) {
      toast.error(t('plugins.toasts.errorTitle'), err instanceof Error ? err.message : t('plugins.toasts.errorDefault'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleHealthCheck = async (pluginId: string) => {
    setActionLoading(pluginId);
    try {
      const result = await pluginsApi.healthCheck(pluginId);
      if (result.healthy) {
        toast.success(t('plugins.toasts.healthOk'), result.message);
      } else {
        toast.warning(t('plugins.toasts.healthFail'), result.message);
      }
    } catch (err) {
      toast.error(t('plugins.toasts.healthError'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenConfig = (plugin: Plugin) => {
    setConfigPlugin(plugin);
    // Pre-populate genericConfig from existing plugin.config
    setGenericConfig({ ...plugin.config });
    setShowConfigModal(true);
  };

  const handleGenericConfigChange = (key: string, value: unknown) => {
    setGenericConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveConfig = async () => {
    if (!configPlugin) return;
    setSavingConfig(true);
    try {
      if (configPlugin.type !== 'engine' && configPlugin.configSchema) {
        // Parse any textarea JSON arrays before saving
        const coerced: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(genericConfig)) {
          const propDef = configPlugin.configSchema.properties[key];
          if (propDef?.type === 'array' && typeof val === 'string') {
            try {
              coerced[key] = JSON.parse(val) as unknown;
            } catch {
              coerced[key] = val;
            }
          } else {
            coerced[key] = val;
          }
        }
        await pluginsApi.updateConfig(configPlugin.id, coerced);
      }
      toast.success(t('plugins.toasts.savedTitle'), t('plugins.toasts.savedDesc'));
      setShowConfigModal(false);
    } catch (err) {
      toast.error(t('plugins.toasts.saveFailed'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div
        className="plugins-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const activeEngine = engines.find(e => e.id === currentEngine);

  return (
    <div className="plugins-page">
      <PageHeader
        title={t('plugins.title')}
        subtitle={t('plugins.subtitle')}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setShowMarketplace(true)}>
              <ShoppingBag size={16} />
              {t('plugins.marketplace.title')}
            </button>
            <button className="btn-secondary" onClick={refetchAll}>
              <RefreshCw size={16} />
              {t('plugins.refresh')}
            </button>
          </>
        }
      />

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span className="error-banner-text">{error}</span>
        </div>
      )}

      <div className="engine-card">
        <div className="engine-header">
          <div className="engine-info">
            <div className="engine-icon-wrapper">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="engine-title">{t('plugins.engineCard')}</h3>
              <span className="engine-name">{currentEngine}</span>
            </div>
          </div>
          <span className="status-badge connected">{t('plugins.running')}</span>
        </div>

        {activeEngine && activeEngine.features.length > 0 && (
          <div className="engine-features">
            <p className="features-label">{t('plugins.supportedFeatures')}</p>
            <div className="features-list">
              {activeEngine.features.slice(0, 8).map(feature => (
                <span key={feature} className="feature-tag">
                  {feature}
                </span>
              ))}
              {activeEngine.features.length > 8 && (
                <span className="feature-more">{t('plugins.more', { count: activeEngine.features.length - 8 })}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="plugins-grid">
        {plugins.map(plugin => {
          const TypeIcon = pluginTypeIcons[plugin.type as PluginType] || Puzzle;
          const isLoading = actionLoading === plugin.id;

          return (
            <div key={plugin.id} className="plugin-card">
              <div className={`plugin-card-header type-${plugin.type}`}>
                <div className="plugin-info">
                  <div className="plugin-icon-wrapper">
                    <TypeIcon size={20} />
                  </div>
                  <div>
                    <h3 className="plugin-name">{plugin.name}</h3>
                    <span className="plugin-version">v{plugin.version}</span>
                  </div>
                </div>
                {plugin.builtIn && <span className="plugin-builtin-badge">{t('plugins.builtIn')}</span>}
              </div>

              <div className="plugin-card-body">
                <p className="plugin-description">{plugin.description || t('plugins.noDescription')}</p>

                <div className="plugin-status-row">
                  <div className="plugin-status">
                    <span className={`status-dot ${plugin.status}`} />
                    <span className="status-text">{plugin.status}</span>
                  </div>
                  <span className="plugin-type-label">{plugin.type}</span>
                </div>

                {plugin.error && (
                  <div className="plugin-error">
                    <p className="plugin-error-text">{plugin.error}</p>
                  </div>
                )}

                {plugin.provides && plugin.provides.length > 0 && (
                  <div className="plugin-provides">
                    {plugin.provides.map(item => (
                      <span key={item} className="provides-tag">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                <div className="plugin-actions">
                  {plugin.type === 'engine' ? (
                    (() => {
                      const enginePlugins = plugins.filter(p => p.type === 'engine');
                      const isOnlyEngine = enginePlugins.length === 1;
                      const isActive = plugin.status === 'enabled';

                      if (isOnlyEngine && isActive) {
                        return (
                          <span className="btn-required">
                            <CheckCircle size={16} />
                            {t('plugins.required')}
                          </span>
                        );
                      } else if (isActive) {
                        return (
                          <span className="btn-active">
                            <CheckCircle size={16} />
                            {t('plugins.active')}
                          </span>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => handleToggle(plugin)}
                            disabled={isLoading}
                            className="btn-toggle enable"
                          >
                            {isLoading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Power size={16} />
                                {t('plugins.activate')}
                              </>
                            )}
                          </button>
                        );
                      }
                    })()
                  ) : (
                    <button
                      onClick={() => handleToggle(plugin)}
                      disabled={isLoading}
                      className={`btn-toggle ${plugin.status === 'enabled' ? 'disable' : 'enable'}`}
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : plugin.status === 'enabled' ? (
                        <>
                          <PowerOff size={16} />
                          {t('plugins.disable')}
                        </>
                      ) : (
                        <>
                          <Power size={16} />
                          {t('plugins.enable')}
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleHealthCheck(plugin.id)}
                    disabled={isLoading}
                    className="btn-action"
                    title={t('plugins.healthCheck')}
                  >
                    <CheckCircle size={16} />
                  </button>

                  <button className="btn-action" title={t('plugins.configure')} onClick={() => handleOpenConfig(plugin)}>
                    <Settings size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {plugins.length === 0 && !loading && (
        <div className="empty-state">
          <Puzzle size={64} />
          <h3>{t('plugins.empty.title')}</h3>
          <p>{t('plugins.empty.description')}</p>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && configPlugin && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setShowConfigModal(false)}>
          <div className="modal config-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('plugins.config.title', { name: configPlugin.name })}</h2>
              <button className="btn-icon" onClick={() => setShowConfigModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {configPlugin.type === 'engine' ? (
                <>
                  <div className="config-info-banner">
                    <AlertCircle size={16} />
                    <span>{t('plugins.config.restartNotice')}</span>
                  </div>

                  <div className="config-form">
                    <div className="form-group">
                      <label>{t('plugins.config.engineType')}</label>
                      <select
                        value={engineConfig.type}
                        onChange={e => setEngineConfig({ ...engineConfig, type: e.target.value })}
                      >
                        <option value="whatsapp-web.js">WhatsApp Web.js</option>
                      </select>
                    </div>

                    <div className="form-group toggle-group">
                      <div className="toggle-info">
                        <label>{t('plugins.config.headless')}</label>
                        <small>{t('plugins.config.headlessDesc')}</small>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={engineConfig.headless}
                          onChange={e => setEngineConfig({ ...engineConfig, headless: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label>{t('plugins.config.sessionDataPath')}</label>
                      <input
                        type="text"
                        value={engineConfig.sessionDataPath}
                        onChange={e => setEngineConfig({ ...engineConfig, sessionDataPath: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('plugins.config.browserArgs')}</label>
                      <input
                        type="text"
                        value={engineConfig.browserArgs}
                        onChange={e => setEngineConfig({ ...engineConfig, browserArgs: e.target.value })}
                        placeholder="--no-sandbox --disable-gpu"
                      />
                    </div>
                  </div>
                </>
              ) : configPlugin.configSchema ? (
                <div className="config-form">
                  {Object.entries(configPlugin.configSchema.properties).map(([key, propDef]) => (
                    <SchemaField
                      key={key}
                      propKey={key}
                      propDef={propDef}
                      value={genericConfig[key]}
                      onChange={handleGenericConfigChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="no-config">
                  <Settings size={48} style={{ opacity: 0.3 }} />
                  <p>{t('plugins.config.noSchema')}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowConfigModal(false)}>
                {t('common.cancel')}
              </button>
              {(configPlugin.type === 'engine' || configPlugin.configSchema) && (
                <button className="btn-primary" onClick={handleSaveConfig} disabled={savingConfig}>
                  {savingConfig ? <Loader2 size={16} className="animate-spin" /> : t('plugins.config.save')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Marketplace Modal */}
      {showMarketplace && <MarketplaceModal onClose={() => setShowMarketplace(false)} />}
    </div>
  );
}
