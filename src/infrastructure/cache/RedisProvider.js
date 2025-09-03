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
exports.RedisProvider = void 0;
var redis_1 = require("redis");
var RedisProvider = /** @class */ (function () {
    function RedisProvider(config) {
        var _this = this;
        this.isConnected = false;
        this.config = config;
        this.client = (0, redis_1.createClient)(__assign({ socket: {
                host: config.host || 'localhost',
                port: config.port || 6379,
            }, password: config.password, database: config.database || 0 }, (config.connectionString && { url: config.connectionString })));
        this.client.on('error', function (error) {
            console.error('Redis Client Error:', error);
        });
        this.client.on('connect', function () {
            console.log('Connected to Redis');
            _this.isConnected = true;
        });
        this.client.on('disconnect', function () {
            console.log('Disconnected from Redis');
            _this.isConnected = false;
        });
    }
    RedisProvider.prototype.ensureConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.isConnected) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.client.connect()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Failed to connect to Redis:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.getKey = function (key) {
        return this.config.keyPrefix ? "".concat(this.config.keyPrefix, ":").concat(key) : key;
    };
    RedisProvider.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.get(this.getKey(key))];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result ? JSON.parse(result) : null];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Redis get error:', error_2);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.set = function (key, value, ttl) {
        return __awaiter(this, void 0, void 0, function () {
            var serializedValue, redisKey, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        serializedValue = JSON.stringify(value);
                        redisKey = this.getKey(key);
                        if (!(ttl || this.config.defaultTTL)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.client.setEx(redisKey, ttl || this.config.defaultTTL, serializedValue)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.client.set(redisKey, serializedValue)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_3 = _a.sent();
                        console.error('Redis set error:', error_3);
                        throw error_3;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.delete = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.del(this.getKey(key))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error('Redis delete error:', error_4);
                        throw error_4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.exists = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.exists(this.getKey(key))];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result === 1];
                    case 3:
                        error_5 = _a.sent();
                        console.error('Redis exists error:', error_5);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.invalidate = function (pattern) {
        return __awaiter(this, void 0, void 0, function () {
            var searchPattern, keys, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        searchPattern = this.getKey(pattern);
                        return [4 /*yield*/, this.client.keys(searchPattern)];
                    case 2:
                        keys = _a.sent();
                        if (!(keys.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.client.del(keys)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_6 = _a.sent();
                        console.error('Redis invalidate error:', error_6);
                        throw error_6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.mget = function (keys) {
        return __awaiter(this, void 0, void 0, function () {
            var redisKeys, results, error_7;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        redisKeys = keys.map(function (key) { return _this.getKey(key); });
                        return [4 /*yield*/, this.client.mGet(redisKeys)];
                    case 2:
                        results = _a.sent();
                        return [2 /*return*/, results.map(function (result) {
                                return result ? JSON.parse(result) : null;
                            })];
                    case 3:
                        error_7 = _a.sent();
                        console.error('Redis mget error:', error_7);
                        return [2 /*return*/, keys.map(function () { return null; })];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.mset = function (entries) {
        return __awaiter(this, void 0, void 0, function () {
            var pipeline, _i, entries_1, entry, redisKey, serializedValue, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        pipeline = this.client.multi();
                        for (_i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                            entry = entries_1[_i];
                            redisKey = this.getKey(entry.key);
                            serializedValue = JSON.stringify(entry.value);
                            if (entry.ttl || this.config.defaultTTL) {
                                pipeline.setEx(redisKey, entry.ttl || this.config.defaultTTL, serializedValue);
                            }
                            else {
                                pipeline.set(redisKey, serializedValue);
                            }
                        }
                        return [4 /*yield*/, pipeline.exec()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _a.sent();
                        console.error('Redis mset error:', error_8);
                        throw error_8;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.increment = function (key_1) {
        return __awaiter(this, arguments, void 0, function (key, increment) {
            var error_9;
            if (increment === void 0) { increment = 1; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.incrBy(this.getKey(key), increment)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_9 = _a.sent();
                        console.error('Redis increment error:', error_9);
                        throw error_9;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.expire = function (key, ttl) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.expire(this.getKey(key), ttl)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 3:
                        error_10 = _a.sent();
                        console.error('Redis expire error:', error_10);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.ttl = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.ttl(this.getKey(key))];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_11 = _a.sent();
                        console.error('Redis ttl error:', error_11);
                        return [2 /*return*/, -1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.clear = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.flushDb()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_12 = _a.sent();
                        console.error('Redis clear error:', error_12);
                        throw error_12;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_13;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!this.isConnected) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.disconnect()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [3 /*break*/, 4];
                    case 3:
                        error_13 = _a.sent();
                        console.error('Redis disconnect error:', error_13);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Redis-specific utility methods
    RedisProvider.prototype.ping = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_14;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.ping()];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_14 = _a.sent();
                        console.error('Redis ping error:', error_14);
                        throw error_14;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RedisProvider.prototype.info = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_15;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.ensureConnection()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.info()];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_15 = _a.sent();
                        console.error('Redis info error:', error_15);
                        throw error_15;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return RedisProvider;
}());
exports.RedisProvider = RedisProvider;
