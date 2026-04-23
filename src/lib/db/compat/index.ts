/**
 * Database Layer - Async Interface
 *
 * This module provides a unified async interface for database operations
 * using Kysely with PostgreSQL.
 *
 * Usage:
 *   import { getUserById, createCategory, ... } from '@/lib/db/compat';
 *
 * All operations use the Kysely query builder for async PostgreSQL access.
 * API routes should import from this module and use `await` for all operations.
 */

// Export database helper
export { getDb } from '../kysely';

// ============ Users ============
export {
  // Types
  type UserRole,
  type DbUser,
  type CreateUserInput,
  type UpdateUserInput,
  type UserWithSubscriptions,
  type UserWithAssignments,
  // User CRUD
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  deleteUserByEmail,
  userExists,
  isAdmin,
  isSuperUser,
  // Users by Role
  getAdmins,
  getSuperUsers,
  getRegularUsers,
  // Super User Category Assignments
  getSuperUserWithAssignments,
  assignCategoryToSuperUser,
  removeCategoryFromSuperUser,
  replaceSuperUserCategories,
  getSuperUserCategories,
  superUserHasCategory,
  // User Subscriptions
  getUserWithSubscriptions,
  addSubscription,
  removeSubscription,
  toggleSubscriptionActive,
  getActiveSubscriptions,
  userHasSubscription,
  getUsersSubscribedToCategory,
  // Bulk Operations
  createUserWithSubscriptions,
  createSuperUserWithAssignments,
  // Initialize from Environment
  initializeAdminsFromEnv,
  // Credentials Management
  setUserPassword,
  setCredentialsEnabled,
  clearUserPassword,
  canLoginWithCredentials,
  getCredentialUsers,
  initializeAdminCredentialsFromEnv,
} from './users';

// ============ Config ============
export {
  // Types
  type RagSettings,
  type LlmSettings,
  type TavilySettings,
  type UploadLimits,
  type SystemPrompt,
  type RetentionSettings,
  type AcronymMappings,
  type BrandingSettings,
  type PWASettings,
  type EmbeddingSettings,
  type RerankerSettings,
  type MemorySettings,
  type SummarizationSettings,
  type SkillsSettings,
  type OcrProvider,
  type OcrProviderConfig,
  type OcrSettings,
  type SuperuserSettings,
  type LimitsSettings,
  type TokenLimitsSettings,
  type ModelTokenLimits,
  type AvailableModel,
  type SettingKey,
  type ToolConfig,
  type AgentBotsSettings,
  type CredentialsAuthSettings,
  type LlmFallbackSettings,
  type RoutesSettings,
  type SpeechSettings,
  type SttProvider,
  type TtsProvider,
  type SttProviderConfig,
  type SttRouteConfig,
  type TtsProviderConfig,
  // Constants
  DEFAULT_PWA_SETTINGS,
  DEFAULT_OCR_SETTINGS,
  BRANDING_ICONS,
  DEFAULT_MODEL_ID,
  DEFAULT_CREDENTIALS_AUTH_SETTINGS,
  // Core Operations
  getSetting,
  setSetting,
  deleteSetting,
  getSettingMetadata,
  // Typed Getters
  getRagSettings,
  getLlmSettings,
  getTavilySettings,
  getUploadLimits,
  getSystemPrompt,
  getAcronymMappings,
  getRetentionSettings,
  getBrandingSettings,
  getEmbeddingSettings,
  getRerankerSettings,
  getMemorySettings,
  getSummarizationSettings,
  getSkillsSettings,
  getOcrSettings,
  getLimitsSettings,
  getTokenLimitsSettings,
  getModelTokenLimits,
  getEffectiveMaxTokens,
  getPWASettings,
  getSuperuserSettings,
  getAvailableModels,
  isToolCapableModelFromDb,
  getToolCapableModels,
  getDefaultSystemPrompt,
  // Typed Setters
  setRagSettings,
  setLlmSettings,
  setTavilySettings,
  setUploadLimits,
  setSystemPrompt,
  setAcronymMappings,
  setRetentionSettings,
  setBrandingSettings,
  setEmbeddingSettings,
  setRerankerSettings,
  setMemorySettings,
  setSummarizationSettings,
  setSkillsSettings,
  setOcrSettings,
  setLimitsSettings,
  setTokenLimitsSettings,
  setModelTokenLimit,
  setModelTokenLimits,
  setPWASettings,
  setSuperuserSettings,
  // Agent Bots, Credentials Auth, LLM Fallback
  getAgentBotsSettings,
  updateAgentBotsSettings,
  getCredentialsAuthSettings,
  setCredentialsAuthSettings,
  getLlmFallbackSettings,
  setLlmFallbackSettings,
  // LLM Routes
  getRoutesSettings,
  setRoutesSettings,
  // Speech (STT + TTS)
  getSpeechSettings,
  setSpeechSettings,
  // Bulk Operations
  getAllSettings,
  // Tool Config (async)
  getToolConfigAsync,
  upsertToolConfigAsync,
} from './config';

// ============ Categories ============
export {
  // Types
  type DbCategory,
  type CategoryWithStats,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  // Helper
  generateSlug,
  // Category CRUD
  getAllCategories,
  getAllCategoriesWithStats,
  getCategoryById,
  getCategoryBySlug,
  getCategoryByName,
  createCategory,
  updateCategory,
  deleteCategory,
  categoryExists,
  // Category Queries
  getCategoriesForSuperUser,
  getCategoriesForUser,
  getAllSubscriptionsForUser,
  getSuperUsersForCategory,
  getSubscribersForCategory,
  // Category Statistics
  getCategoryDocumentCount,
  getUnassignedDocumentCount,
  // Bulk Operations
  bulkSubscribeUsers,
  getCategoryIdsBySlugs,
  getCategorySlugsByIds,
  // Superuser Category Management
  getCreatedCategoriesCount,
  getCategoriesCreatedBy,
  isCategoryCreatedBy,
  getDocumentIdsForCategory,
  deleteCategoryWithRelatedData,
  // Bulk Category Lookup
  type CategoryInfo,
  getCategoriesByIds,
} from './categories';

// ============ Threads ============
export {
  // Types
  type DbThread,
  type DbMessage,
  type DbThreadUpload,
  type DbThreadOutput,
  type ThreadWithDetails,
  type ParsedMessage,
  type ThreadContext,
  type WorkspaceOutputResult,
  type WorkspaceOutput,
  // Thread CRUD
  createThread,
  getThreadById,
  getThreadWithDetails,
  getThreadsForUser,
  getThreadCountForUser,
  updateThreadTitle,
  toggleThreadPin,
  updateThreadModel,
  getEffectiveModelForThread,
  deleteThread,
  userOwnsThread,
  getThreadOwner,
  // Thread Categories
  getThreadCategories,
  getThreadCategorySlugs,
  setThreadCategories,
  // Messages
  addMessage,
  getMessageById,
  getMessagesForThread,
  // Thread Uploads
  addThreadUpload,
  getThreadUploadById,
  getThreadUploads,
  getThreadUploadCount,
  deleteThreadUpload,
  // Thread Outputs
  addThreadOutput,
  getThreadOutputById,
  getThreadOutputs,
  linkOutputsToMessage,
  // Thread Context (for image generation)
  getThreadContext,
  // Workspace Outputs
  addWorkspaceOutput,
  getWorkspaceOutputById,
  incrementWorkspaceOutputDownloadCount,
  // Thread Output Helpers (for docgen)
  getExpiredThreadOutputs,
  deleteThreadOutput,
  incrementThreadOutputDownloadCount,
  getThreadOutputDownloadCount,
  // Cleanup
  getThreadsOlderThan,
  deleteThreadsOlderThan,
  getThreadUploadsStorageSize,
  getThreadOutputsStorageSize,
} from './threads';

// ============ Compliance ============
export {
  type ComplianceStats,
  saveComplianceResult,
  updateHitlResponse,
  getComplianceResult,
  getComplianceResultsForConversation,
  getRecentComplianceResults,
  getComplianceStats,
  deleteOldComplianceResults,
} from './compliance';

// ============ Documents ============
export {
  // Types
  type DocumentStatus,
  type DbDocument,
  type DocumentWithCategories,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  // Document CRUD
  getAllDocuments,
  getAllDocumentsWithCategories,
  getDocumentById,
  getDocumentWithCategories,
  createDocument,
  updateDocument,
  deleteDocument,
  // Category Operations
  getDocumentCategories,
  addDocumentToCategory,
  removeDocumentFromCategory,
  setDocumentCategories,
  setDocumentGlobal,
  // Query Helpers
  getDocumentsByCategory,
  getGlobalDocuments,
  getUnassignedDocuments,
  getDocumentsByStatus,
  // Statistics
  getTotalChunkCount,
  getDocumentCountByStatus,
  getTotalStorageSize,
  // Folder Sync Operations
  updateDocumentFolderSync,
} from './documents';

// ============ Skills ============
export {
  // Types
  type Skill,
  type SkillWithCategories,
  type CreateSkillInput,
  type TriggerType,
  type MatchType,
  type ForceMode,
  type DataSourceFilter,
  type SkillComplianceConfig,
  type ResolvedSkills,
  // Read Operations
  getSkillById,
  getAllSkills,
  getSkillsByTrigger,
  getIndexSkillsForCategories,
  getKeywordSkills,
  getCategoriesForSkill,
  wouldToolSkillMatch,
  getSkillsByTool,
  getAllSkillsWithCategories,
  getSkillsWithToolRouting,
  getSkillsForTool,
  isToolRoutingMigrated,
  // Write Operations
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillActive,
  // Restore Operations
  resetCoreSkillsToDefaults,
  removeCoreFlag,
  // Seed Operations
  seedCoreSkill,
  // Migration Operations
  migrateToolRoutingToSkills,
} from './skills';

// ============ Tool Config ============
export {
  // Types
  type ToolConfig as ToolConfigRecord,
  type ToolConfigAuditEntry,
  // Constants
  TOOL_DEFAULTS,
  getToolDefaultsForTool,
  // CRUD Operations
  getToolConfig,
  getAllToolConfigs,
  isToolEnabled,
  createToolConfig,
  updateToolConfig,
  deleteToolConfig,
  // Audit Operations
  getToolConfigAuditHistory,
  getAllToolConfigAuditHistory,
  // Migration Helpers
  migrateTavilySettingsIfNeeded,
  getWebSearchConfig,
  // Initialization
  ensureToolConfigsExist,
  resetToolToDefaults,
  getDescriptionOverride,
} from './tool-config';

// ============ LLM Providers ============
export {
  // Types
  type LLMProvider,
  type CreateProviderInput,
  type UpdateProviderInput,
  // Constants
  DEFAULT_PROVIDERS,
  maskApiKey,
  // CRUD Operations
  getAllProviders,
  getEnabledProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  upsertProvider,
  // Configuration Helpers
  isProviderConfigured,
  getProviderApiKey,
  getProviderApiBase,
  // Seeding
  seedDefaultProviders,
} from './llm-providers';

// ============ Enabled Models ============
export {
  // Types
  type EnabledModel,
  type CreateEnabledModelInput,
  type UpdateEnabledModelInput,
  // CRUD Operations
  getAllEnabledModels,
  getActiveModels,
  getModelsByProvider,
  getEnabledModel,
  getDefaultModel,
  createEnabledModel,
  createEnabledModelsBatch,
  updateEnabledModel,
  deleteEnabledModel,
  deleteEnabledModelsBatch,
  setDefaultModel,
  disableModel,
  enableModel,
  // Capability Queries
  isModelToolCapable,
  isModelVisionCapable,
  isModelParallelToolCapable,
  isModelThinkingCapable,
  getToolCapableModelIds,
  // Sort Order
  updateModelSortOrder,
  // Migration/Seeding
  hasEnabledModels,
  seedModelsFromConfig,
  findDeprecatedModels,
  refreshModelCapabilities,
  refreshAllModelCapabilities,
} from './enabled-models';

// ============ Folder Syncs ============
export {
  // Types
  type FolderSyncStatus,
  type FolderSyncFileStatus,
  type DbFolderSync,
  type FolderSync,
  type DbFolderSyncFile,
  type FolderSyncFile,
  type CreateFolderSyncInput,
  type CreateFolderSyncFileInput,
  type UpdateFolderSyncInput,
  type UpdateFolderSyncFileInput,
  // Folder Sync CRUD
  createFolderSync,
  getFolderSyncById,
  getFolderSyncsByUser,
  getAllFolderSyncs,
  updateFolderSync,
  deleteFolderSync,
  // Folder Sync File CRUD
  createFolderSyncFile,
  createFolderSyncFiles,
  getFolderSyncFileById,
  getFolderSyncFiles,
  findFolderSyncFileByPath,
  findFolderSyncFileByHash,
  updateFolderSyncFile,
  deleteFolderSyncFile,
  // Statistics
  getFolderSyncFileCountsByStatus,
  getPendingFolderSyncFiles,
  getFailedFolderSyncFiles,
  markAllPendingAsSkipped,
  resetFileStatusToPending,
} from './folder-syncs';

// ============ Category Prompts ============
export {
  // Types
  type StarterPrompt,
  type CategoryPrompt,
  type CategoryPromptRow,
  // Constants
  MAX_COMBINED_PROMPT_LENGTH,
  MAX_STARTER_PROMPTS,
  MAX_STARTER_LABEL_LENGTH,
  MAX_STARTER_PROMPT_LENGTH,
  // Dynamic Limit Getters
  getMaxCombinedPromptLength,
  getMaxStarterPrompts,
  getMaxStarterLabelLength,
  getMaxStarterPromptLength,
  // Read Operations
  getCategoryPrompt,
  getAllCategoryPrompts,
  getResolvedSystemPrompt,
  getAvailableCharLimit,
  getPromptCharacterInfo,
  // Write Operations
  setCategoryPrompt,
  deleteCategoryPrompt,
  setCategoryStarterPrompts,
  setCategoryWelcome,
  // Validation
  validatePromptAddendum,
  validateStarterPrompts,
  // Bulk Operations
  getCategoryPromptsForCategories,
} from './category-prompts';

// ============ Data Sources ============
export {
  // Types
  type DataAPIConfig,
  type DataCSVConfig,
  type DataSource,
  type AuthConfig,
  type DataSourceAuditEntry,
  type DbDataAPIConfig,
  type DbDataCSVConfig,
  type DbDataAPICategory,
  type DbDataCSVCategory,
  type DbDataSourceAudit,
  // API Operations
  createDataAPI,
  getDataAPI,
  getDataAPIByName,
  getAllDataAPIs,
  getDataAPIsForCategories,
  updateDataAPI,
  updateAPIStatus,
  deleteDataAPI,
  setAPICategories,
  // CSV Operations
  createDataCSV,
  getDataCSV,
  getDataCSVByName,
  getAllDataCSVs,
  getDataCSVsForCategories,
  updateDataCSV,
  deleteDataCSV,
  setCSVCategories,
  // Unified Operations
  getAllDataSourcesForCategories,
  getDataSourceByName,
  getAllDataSources,
  // Audit Operations
  logDataSourceChange,
  getDataSourceAuditHistory,
  getAllDataSourceAuditHistory,
} from './data-sources';

// ============ Tool Routing ============
export {
  // Types
  type ToolRoutingRule,
  type ToolRoutingRuleInput,
  // Read Operations
  getActiveRoutingRules,
  getAllRoutingRules,
  getRoutingRuleById,
  getRoutingRulesByTool,
  // Write Operations
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  // Utility
  hasRoutingRules,
  seedDefaultRoutingRules,
} from './tool-routing';

// ============ RAG Testing ============
export {
  // Types
  type RagTestQuery,
  type RagTestResult,
  type TopChunk,
  type RagTestMetrics,
  // Test Queries
  createTestQuery,
  getAllTestQueries,
  getTestQueryById,
  deleteTestQuery,
  // Test Results
  saveTestResult,
  getRecentResults,
  getResultsForQuery,
  cleanupOldResults,
  getTestStats,
} from './rag-testing';

// ============ Function API Config ============
export {
  // Types
  type FunctionAPIConfig,
  type FunctionAPIAuthType,
  type FunctionAPIStatus,
  type EndpointMapping,
  type DbFunctionAPIConfig,
  type DbFunctionAPICategory,
  type CreateFunctionAPIRequest,
  type UpdateFunctionAPIRequest,
  // CRUD Operations
  createFunctionAPIConfig,
  getFunctionAPIConfig,
  getFunctionAPIConfigByName,
  getAllFunctionAPIConfigs,
  getEnabledFunctionAPIConfigs,
  getFunctionAPIConfigsForCategories,
  updateFunctionAPIConfig,
  updateFunctionAPITestStatus,
  deleteFunctionAPIConfig,
  // Function Lookup Helpers
  findConfigForFunction,
  getAllFunctionNamesForCategories,
  getToolDefinitionsForCategories,
  // Validation
  validateToolsSchema,
  validateEndpointMappings,
} from './function-api-config';

// ============ Token Usage ============
export {
  type TokenUsageCategory,
  type TokenUsageByUser,
  type TokenUsageByModel,
  type DailyTokenUsage,
  type TokenUsageSummary,
  type TokenUsageFilters,
  logTokenUsage,
  getTokenUsageSummary,
  getFilterOptions as getTokenUsageFilterOptions,
} from './token-usage';