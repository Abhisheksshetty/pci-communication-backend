"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProviderFactory = exports.ProviderFactory = void 0;
var LocalAuthProvider_js_1 = require("./auth/providers/LocalAuthProvider.js");
var AzureAuthProvider_js_1 = require("./auth/providers/AzureAuthProvider.js");
var LocalStorageProvider_js_1 = require("./storage/LocalStorageProvider.js");
var AzureBlobProvider_js_1 = require("./storage/AzureBlobProvider.js");
var RedisProvider_js_1 = require("./cache/RedisProvider.js");
var EmailChannel_js_1 = require("./messaging/EmailChannel.js");
var InAppChannel_js_1 = require("./messaging/InAppChannel.js");
var ProviderFactory = /** @class */ (function () {
    function ProviderFactory(configuration) {
        this.notificationChannels = new Map();
        this.configuration = configuration;
    }
    ProviderFactory.getInstance = function (configuration) {
        if (!ProviderFactory.instance) {
            if (!configuration) {
                throw new Error('Configuration is required for first initialization');
            }
            ProviderFactory.instance = new ProviderFactory(configuration);
        }
        return ProviderFactory.instance;
    };
    ProviderFactory.createFromEnvironment = function () {
        var configuration = {
            auth: {
                provider: process.env.AUTH_PROVIDER || 'local',
                config: __assign({ jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key', jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key', accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m', refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d' }, (process.env.AUTH_PROVIDER === 'azure' && {
                    tenantId: process.env.AZURE_TENANT_ID,
                    clientId: process.env.AZURE_CLIENT_ID,
                    clientSecret: process.env.AZURE_CLIENT_SECRET,
                })),
            },
            storage: {
                provider: process.env.STORAGE_PROVIDER || 'local',
                config: __assign(__assign({ provider: process.env.STORAGE_PROVIDER || 'local' }, (process.env.STORAGE_PROVIDER === 'local' && {
                    baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3000',
                })), (process.env.STORAGE_PROVIDER === 'azure' && {
                    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                    containerName: process.env.AZURE_STORAGE_CONTAINER || 'uploads',
                })),
            },
            cache: {
                provider: process.env.CACHE_PROVIDER || 'redis',
                config: {
                    provider: process.env.CACHE_PROVIDER || 'redis',
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD,
                    database: parseInt(process.env.REDIS_DB || '0'),
                    keyPrefix: process.env.REDIS_KEY_PREFIX || 'sports-app:',
                    defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '3600'),
                },
            },
            notifications: {
                email: {
                    enabled: process.env.EMAIL_ENABLED === 'true',
                    config: {
                        enabled: process.env.EMAIL_ENABLED === 'true',
                        smtp: {
                            host: process.env.SMTP_HOST || 'localhost',
                            port: parseInt(process.env.SMTP_PORT || '587'),
                            secure: process.env.SMTP_SECURE === 'true',
                            auth: process.env.SMTP_USER ? {
                                user: process.env.SMTP_USER,
                                pass: process.env.SMTP_PASS || '',
                            } : undefined,
                        },
                        from: {
                            name: process.env.EMAIL_FROM_NAME || 'Sports App',
                            address: process.env.EMAIL_FROM_ADDRESS || 'noreply@sportsapp.com',
                        },
                        rateLimit: {
                            maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE || '50'),
                            maxPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '1000'),
                            maxPerDay: parseInt(process.env.EMAIL_RATE_LIMIT_PER_DAY || '10000'),
                        },
                    },
                },
                inApp: {
                    enabled: true, // Always enabled for in-app notifications
                    config: {
                        enabled: true,
                        maxNotificationsPerUser: parseInt(process.env.IN_APP_MAX_NOTIFICATIONS_PER_USER || '100'),
                        autoDeleteAfterDays: parseInt(process.env.IN_APP_AUTO_DELETE_AFTER_DAYS || '30'),
                        realTime: {
                            enabled: process.env.REALTIME_NOTIFICATIONS === 'true',
                            socketNamespace: process.env.SOCKET_NAMESPACE || '/',
                        },
                        badgeCount: {
                            enabled: true,
                            maxCount: parseInt(process.env.BADGE_MAX_COUNT || '99'),
                        },
                    },
                },
            },
        };
        return ProviderFactory.getInstance(configuration);
    };
    // Authentication Provider
    ProviderFactory.prototype.getAuthProvider = function () {
        if (!this.authProvider) {
            switch (this.configuration.auth.provider) {
                case 'azure':
                    this.authProvider = new AzureAuthProvider_js_1.AzureAuthProvider(this.configuration.auth.config);
                    break;
                case 'local':
                default:
                    this.authProvider = new LocalAuthProvider_js_1.LocalAuthProvider(this.configuration.auth.config);
                    break;
            }
        }
        return this.authProvider;
    };
    // Storage Provider
    ProviderFactory.prototype.getStorageProvider = function () {
        if (!this.storageProvider) {
            switch (this.configuration.storage.provider) {
                case 'azure':
                    this.storageProvider = new AzureBlobProvider_js_1.AzureBlobProvider();
                    break;
                case 'local':
                default:
                    this.storageProvider = new LocalStorageProvider_js_1.LocalStorageProvider();
                    break;
                // Additional providers can be added here (S3, GCS, etc.)
            }
        }
        return this.storageProvider;
    };
    // Cache Provider
    ProviderFactory.prototype.getCacheProvider = function () {
        if (!this.cacheProvider) {
            switch (this.configuration.cache.provider) {
                case 'redis':
                case 'azure_redis':
                default:
                    this.cacheProvider = new RedisProvider_js_1.RedisProvider(this.configuration.cache.config);
                    break;
                // Additional providers can be added here (Memory cache, etc.)
            }
        }
        return this.cacheProvider;
    };
    // Notification Channels
    ProviderFactory.prototype.getNotificationChannel = function (type) {
        var _a, _b;
        if (this.notificationChannels.has(type)) {
            return this.notificationChannels.get(type);
        }
        var channel = null;
        switch (type) {
            case 'email':
                if ((_a = this.configuration.notifications.email) === null || _a === void 0 ? void 0 : _a.enabled) {
                    channel = new EmailChannel_js_1.EmailChannel(this.configuration.notifications.email.config);
                }
                break;
            case 'inApp':
                if ((_b = this.configuration.notifications.inApp) === null || _b === void 0 ? void 0 : _b.enabled) {
                    channel = new InAppChannel_js_1.InAppChannel(this.configuration.notifications.inApp.config, undefined);
                }
                break;
            // Additional channels can be added here (push, sms, etc.)
        }
        if (channel) {
            this.notificationChannels.set(type, channel);
        }
        return channel;
    };
    ProviderFactory.prototype.getEnabledNotificationChannels = function () {
        var channels = [];
        var channelTypes = ['email', 'inApp', 'push', 'sms'];
        for (var _i = 0, channelTypes_1 = channelTypes; _i < channelTypes_1.length; _i++) {
            var type = channelTypes_1[_i];
            var channel = this.getNotificationChannel(type);
            if (channel) {
                channels.push(channel);
            }
        }
        return channels;
    };
    // Configuration management
    ProviderFactory.prototype.updateConfiguration = function (newConfiguration) {
        this.configuration = __assign(__assign({}, this.configuration), newConfiguration);
        // Reset cached providers to force re-initialization with new config
        this.authProvider = undefined;
        this.storageProvider = undefined;
        this.cacheProvider = undefined;
        this.notificationChannels.clear();
    };
    ProviderFactory.prototype.getConfiguration = function () {
        return __assign({}, this.configuration);
    };
    // Health checks
    ProviderFactory.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var results, storageProvider, _a, error_1, cacheProvider, error_2, channelTypes, _i, channelTypes_2, type, channel, _b, _c, error_3;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        results = {
                            auth: false,
                            storage: false,
                            cache: false,
                            notifications: {},
                        };
                        try {
                            // Auth provider health check (if applicable)
                            results.auth = true; // Auth providers typically don't have health checks
                        }
                        catch (error) {
                            console.error('Auth provider health check failed:', error);
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 5, , 6]);
                        storageProvider = this.getStorageProvider();
                        if (!('healthCheck' in storageProvider && typeof storageProvider.healthCheck === 'function')) return [3 /*break*/, 3];
                        _a = results;
                        return [4 /*yield*/, storageProvider.healthCheck()];
                    case 2:
                        _a.storage = _d.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        results.storage = true; // Assume healthy if no health check method
                        _d.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_1 = _d.sent();
                        console.error('Storage provider health check failed:', error_1);
                        return [3 /*break*/, 6];
                    case 6:
                        _d.trys.push([6, 10, , 11]);
                        cacheProvider = this.getCacheProvider();
                        if (!('ping' in cacheProvider && typeof cacheProvider.ping === 'function')) return [3 /*break*/, 8];
                        return [4 /*yield*/, cacheProvider.ping()];
                    case 7:
                        _d.sent();
                        results.cache = true;
                        return [3 /*break*/, 9];
                    case 8:
                        results.cache = true; // Assume healthy if no ping method
                        _d.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_2 = _d.sent();
                        console.error('Cache provider health check failed:', error_2);
                        return [3 /*break*/, 11];
                    case 11:
                        channelTypes = ['email', 'inApp', 'push', 'sms'];
                        _i = 0, channelTypes_2 = channelTypes;
                        _d.label = 12;
                    case 12:
                        if (!(_i < channelTypes_2.length)) return [3 /*break*/, 18];
                        type = channelTypes_2[_i];
                        _d.label = 13;
                    case 13:
                        _d.trys.push([13, 16, , 17]);
                        channel = this.getNotificationChannel(type);
                        if (!channel) return [3 /*break*/, 15];
                        _b = results.notifications;
                        _c = type;
                        return [4 /*yield*/, channel.healthCheck()];
                    case 14:
                        _b[_c] = _d.sent();
                        _d.label = 15;
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        error_3 = _d.sent();
                        console.error("".concat(type, " notification channel health check failed:"), error_3);
                        results.notifications[type] = false;
                        return [3 /*break*/, 17];
                    case 17:
                        _i++;
                        return [3 /*break*/, 12];
                    case 18: return [2 /*return*/, results];
                }
            });
        });
    };
    // Cleanup method
    ProviderFactory.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!this.cacheProvider) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.cacheProvider.disconnect()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // Clear notification channels
                        this.notificationChannels.clear();
                        console.log('Provider factory cleanup completed');
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error('Provider factory cleanup failed:', error_4);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return ProviderFactory;
}());
exports.ProviderFactory = ProviderFactory;
// Export singleton instance creator
var createProviderFactory = function (configuration) {
    if (configuration) {
        return ProviderFactory.getInstance(configuration);
    }
    return ProviderFactory.createFromEnvironment();
};
exports.createProviderFactory = createProviderFactory;
