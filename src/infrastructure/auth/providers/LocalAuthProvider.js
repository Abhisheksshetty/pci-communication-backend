"use strict";
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
exports.LocalAuthProvider = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var bcrypt_1 = require("bcrypt");
var drizzle_orm_1 = require("drizzle-orm");
var db_js_1 = require("../../../db/db.js");
var schema_js_1 = require("../../../db/schema.js");
var LocalAuthProvider = /** @class */ (function () {
    function LocalAuthProvider() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
        this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
        this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    }
    LocalAuthProvider.prototype.authenticate = function (credentials) {
        return __awaiter(this, void 0, void 0, function () {
            var db, user, isValidPassword, tokens;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        db = (0, db_js_1.default)();
                        return [4 /*yield*/, db
                                .select()
                                .from(schema_js_1.users)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, credentials.email))
                                .limit(1)];
                    case 1:
                        user = (_a.sent())[0];
                        if (!user) {
                            throw new Error('Invalid credentials');
                        }
                        return [4 /*yield*/, this.verifyPassword(credentials.password, user.passwordHash)];
                    case 2:
                        isValidPassword = _a.sent();
                        if (!isValidPassword) {
                            throw new Error('Invalid credentials');
                        }
                        return [4 /*yield*/, this.generateTokens(user)];
                    case 3:
                        tokens = _a.sent();
                        return [4 /*yield*/, this.createSession(user.id, tokens.refreshToken)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, { user: user, tokens: tokens }];
                }
            });
        });
    };
    LocalAuthProvider.prototype.validateToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var payload;
            return __generator(this, function (_a) {
                try {
                    payload = jsonwebtoken_1.default.verify(token, this.jwtSecret);
                    return [2 /*return*/, payload];
                }
                catch (error) {
                    throw new Error('Invalid or expired token');
                }
                return [2 /*return*/];
            });
        });
    };
    LocalAuthProvider.prototype.createUser = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var db, existingUser, hashedPassword, result, newUser, tokens;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        db = (0, db_js_1.default)();
                        return [4 /*yield*/, db
                                .select()
                                .from(schema_js_1.users)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, data.email))
                                .limit(1)];
                    case 1:
                        existingUser = _a.sent();
                        if (existingUser.length > 0) {
                            throw new Error('User already exists');
                        }
                        return [4 /*yield*/, this.hashPassword(data.password)];
                    case 2:
                        hashedPassword = _a.sent();
                        return [4 /*yield*/, db
                                .insert(schema_js_1.users)
                                .values({
                                email: data.email,
                                username: data.username,
                                fullName: data.fullName,
                                phoneNumber: data.phoneNumber,
                                passwordHash: hashedPassword,
                                role: data.role || 'player',
                                isActive: true,
                                isEmailVerified: false,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            })
                                .returning()];
                    case 3:
                        result = _a.sent();
                        newUser = result[0];
                        if (!newUser) {
                            throw new Error('Failed to create user');
                        }
                        return [4 /*yield*/, this.generateTokens(newUser)];
                    case 4:
                        tokens = _a.sent();
                        return [4 /*yield*/, this.createSession(newUser.id, tokens.refreshToken)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/, { user: newUser, tokens: tokens }];
                }
            });
        });
    };
    LocalAuthProvider.prototype.refreshToken = function (refreshToken) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, db, session, user, tokens, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        payload = jsonwebtoken_1.default.verify(refreshToken, this.jwtRefreshSecret);
                        db = (0, db_js_1.default)();
                        return [4 /*yield*/, db
                                .select()
                                .from(schema_js_1.userSessions)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.userSessions.refreshToken, refreshToken))
                                .limit(1)];
                    case 1:
                        session = (_a.sent())[0];
                        if (!session || session.expiresAt < new Date()) {
                            throw new Error('Invalid or expired refresh token');
                        }
                        return [4 /*yield*/, db
                                .select()
                                .from(schema_js_1.users)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, payload.userId))
                                .limit(1)];
                    case 2:
                        user = (_a.sent())[0];
                        if (!user) {
                            throw new Error('User not found');
                        }
                        return [4 /*yield*/, this.generateTokens(user)];
                    case 3:
                        tokens = _a.sent();
                        return [4 /*yield*/, db
                                .update(schema_js_1.userSessions)
                                .set({
                                refreshToken: tokens.refreshToken,
                                expiresAt: new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry)),
                                updatedAt: new Date()
                            })
                                .where((0, drizzle_orm_1.eq)(schema_js_1.userSessions.id, session.id))];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, tokens];
                    case 5:
                        error_1 = _a.sent();
                        throw new Error('Invalid or expired refresh token');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    LocalAuthProvider.prototype.revokeToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        db = (0, db_js_1.default)();
                        return [4 /*yield*/, db
                                .update(schema_js_1.userSessions)
                                .set({
                                isValid: false,
                                updatedAt: new Date()
                            })
                                .where((0, drizzle_orm_1.eq)(schema_js_1.userSessions.refreshToken, token))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    LocalAuthProvider.prototype.hashPassword = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, bcrypt_1.default.hash(password, this.bcryptRounds)];
            });
        });
    };
    LocalAuthProvider.prototype.verifyPassword = function (password, hashedPassword) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, bcrypt_1.default.compare(password, hashedPassword)];
            });
        });
    };
    LocalAuthProvider.prototype.generateTokens = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, accessToken, refreshToken;
            return __generator(this, function (_a) {
                payload = {
                    id: user.id,
                    userId: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                };
                accessToken = jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
                    expiresIn: this.accessTokenExpiry
                });
                refreshToken = jsonwebtoken_1.default.sign(payload, this.jwtRefreshSecret, {
                    expiresIn: this.refreshTokenExpiry
                });
                return [2 /*return*/, {
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        expiresIn: this.parseExpiry(this.accessTokenExpiry)
                    }];
            });
        });
    };
    LocalAuthProvider.prototype.createSession = function (userId, refreshToken) {
        return __awaiter(this, void 0, void 0, function () {
            var expiresAt, db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expiresAt = new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry));
                        db = (0, db_js_1.default)();
                        return [4 /*yield*/, db.insert(schema_js_1.userSessions).values({
                                userId: userId,
                                refreshToken: refreshToken,
                                userAgent: 'Unknown',
                                ipAddress: '0.0.0.0',
                                expiresAt: expiresAt,
                                isValid: true,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    LocalAuthProvider.prototype.parseExpiry = function (expiry) {
        var units = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000
        };
        var match = expiry.match(/^(\d+)([smhdw])$/);
        if (!match) {
            return 15 * 60 * 1000;
        }
        var valueStr = match[1], unit = match[2];
        if (!valueStr || !unit || !units[unit]) {
            return 15 * 60 * 1000;
        }
        var value = parseInt(valueStr, 10);
        return value * units[unit];
    };
    return LocalAuthProvider;
}());
exports.LocalAuthProvider = LocalAuthProvider;
