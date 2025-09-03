"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.InAppChannel = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var db_js_1 = require("../../db/db.js");
var schema_js_1 = require("../../db/schema.js");
var InAppChannel = /** @class */ (function () {
    function InAppChannel(config, socketIO) {
        this.channelType = 'in_app';
        this.config = config;
        this.socketIO = socketIO;
    }
    InAppChannel.prototype.send = function (recipient, message) {
        return __awaiter(this, void 0, void 0, function () {
            var deliveryStatus, notification, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        deliveryStatus = {
                            messageId: message.id || this.generateMessageId(),
                            recipientId: recipient.id,
                            status: 'pending',
                            timestamp: new Date(),
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        if (!this.config.enabled) {
                            throw new Error('In-app channel is disabled');
                        }
                        return [4 /*yield*/, this.validateRecipient(recipient)];
                    case 2:
                        if (!(_b.sent())) {
                            throw new Error('Invalid recipient');
                        }
                        // Check if recipient has in-app notifications enabled
                        if (((_a = recipient.preferences) === null || _a === void 0 ? void 0 : _a.inApp) === false) {
                            deliveryStatus.status = 'failed';
                            deliveryStatus.error = 'Recipient has disabled in-app notifications';
                            return [2 /*return*/, deliveryStatus];
                        }
                        // Clean up old notifications if limit exceeded
                        return [4 /*yield*/, this.cleanupOldNotifications(recipient.id)];
                    case 3:
                        // Clean up old notifications if limit exceeded
                        _b.sent();
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .insert(schema_js_1.notifications)
                                .values({
                                userId: recipient.id,
                                type: message.type,
                                title: message.title,
                                body: message.body || null,
                                data: message.data ? JSON.stringify(message.data) : null,
                                isRead: false,
                                readAt: null,
                            })
                                .returning()];
                    case 4:
                        notification = (_b.sent())[0];
                        if (!notification) return [3 /*break*/, 8];
                        deliveryStatus.status = 'sent';
                        deliveryStatus.deliveredAt = new Date();
                        deliveryStatus.messageId = notification.id;
                        if (!(this.config.realTime.enabled && this.socketIO)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.sendRealTimeNotification(recipient.id, __assign(__assign(__assign({}, notification), message), { id: notification.id }))];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        if (!this.config.badgeCount.enabled) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.updateBadgeCount(recipient.id)];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8:
                        console.log("In-app notification sent to user ".concat(recipient.id), {
                            notificationId: notification === null || notification === void 0 ? void 0 : notification.id,
                            type: message.type,
                            title: message.title,
                        });
                        return [3 /*break*/, 10];
                    case 9:
                        error_1 = _b.sent();
                        deliveryStatus.status = 'failed';
                        deliveryStatus.error = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        console.error("Failed to send in-app notification to user ".concat(recipient.id, ":"), error_1);
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, deliveryStatus];
                }
            });
        });
    };
    InAppChannel.prototype.sendBulk = function (recipients, message) {
        return __awaiter(this, void 0, void 0, function () {
            var result, batchSize, batches, _loop_1, this_1, _i, batches_1, batch;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = {
                            successful: [],
                            failed: [],
                            totalSent: 0,
                            totalFailed: 0,
                        };
                        batchSize = 50;
                        batches = this.chunkArray(recipients, batchSize);
                        _loop_1 = function (batch) {
                            var notificationData, insertedNotifications, realTimePromises, badgeUpdatePromises, error_2;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 6, , 7]);
                                        notificationData = batch
                                            .filter(function (recipient) { var _a; return ((_a = recipient.preferences) === null || _a === void 0 ? void 0 : _a.inApp) !== false; })
                                            .map(function (recipient) { return ({
                                            userId: recipient.id,
                                            type: message.type,
                                            title: message.title,
                                            body: message.body || null,
                                            data: message.data ? JSON.stringify(message.data) : null,
                                            isRead: false,
                                            readAt: null,
                                        }); });
                                        if (notificationData.length === 0) {
                                            // All recipients have disabled in-app notifications
                                            batch.forEach(function (recipient) {
                                                result.failed.push({
                                                    recipientId: recipient.id,
                                                    error: 'In-app notifications disabled',
                                                });
                                                result.totalFailed++;
                                            });
                                            return [2 /*return*/, "continue"];
                                        }
                                        return [4 /*yield*/, (0, db_js_1.default)()
                                                .insert(schema_js_1.notifications)
                                                .values(notificationData)
                                                .returning()];
                                    case 1:
                                        insertedNotifications = _b.sent();
                                        if (!(this_1.config.realTime.enabled && this_1.socketIO)) return [3 /*break*/, 3];
                                        realTimePromises = insertedNotifications.map(function (notification, index) {
                                            var recipient = batch.find(function (r) { return r.id === notification.userId; });
                                            if (recipient) {
                                                return _this.sendRealTimeNotification(recipient.id, __assign(__assign(__assign({}, notification), message), { id: notification.id }));
                                            }
                                            return Promise.resolve();
                                        });
                                        return [4 /*yield*/, Promise.allSettled(realTimePromises)];
                                    case 2:
                                        _b.sent();
                                        _b.label = 3;
                                    case 3:
                                        if (!this_1.config.badgeCount.enabled) return [3 /*break*/, 5];
                                        badgeUpdatePromises = batch.map(function (recipient) {
                                            return _this.updateBadgeCount(recipient.id);
                                        });
                                        return [4 /*yield*/, Promise.allSettled(badgeUpdatePromises)];
                                    case 4:
                                        _b.sent();
                                        _b.label = 5;
                                    case 5:
                                        // Mark successful deliveries
                                        batch.forEach(function (recipient) {
                                            result.successful.push(recipient.id);
                                            result.totalSent++;
                                        });
                                        return [3 /*break*/, 7];
                                    case 6:
                                        error_2 = _b.sent();
                                        // Mark all recipients in this batch as failed
                                        batch.forEach(function (recipient) {
                                            result.failed.push({
                                                recipientId: recipient.id,
                                                error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                                            });
                                            result.totalFailed++;
                                        });
                                        return [3 /*break*/, 7];
                                    case 7: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, batches_1 = batches;
                        _a.label = 1;
                    case 1:
                        if (!(_i < batches_1.length)) return [3 /*break*/, 4];
                        batch = batches_1[_i];
                        return [5 /*yield**/, _loop_1(batch)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    InAppChannel.prototype.sendTemplate = function (recipient, templateId, variables) {
        return __awaiter(this, void 0, void 0, function () {
            var template, compiledMessage;
            var _a;
            return __generator(this, function (_b) {
                template = (_a = this.config.templates) === null || _a === void 0 ? void 0 : _a[templateId];
                if (!template) {
                    throw new Error("Template not found: ".concat(templateId));
                }
                compiledMessage = this.compileTemplate(template, variables);
                return [2 /*return*/, this.send(recipient, compiledMessage)];
            });
        });
    };
    InAppChannel.prototype.schedule = function (recipient, message, scheduleTime) {
        return __awaiter(this, void 0, void 0, function () {
            var jobId, delay;
            var _this = this;
            return __generator(this, function (_a) {
                jobId = this.generateJobId();
                delay = scheduleTime.getTime() - Date.now();
                if (delay <= 0) {
                    throw new Error('Schedule time must be in the future');
                }
                setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                    var error_3;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, this.send(recipient, message)];
                            case 1:
                                _a.sent();
                                console.log("Scheduled in-app notification sent to user ".concat(recipient.id, " at ").concat(scheduleTime));
                                return [3 /*break*/, 3];
                            case 2:
                                error_3 = _a.sent();
                                console.error("Failed to send scheduled in-app notification:", error_3);
                                return [3 /*break*/, 3];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }, delay);
                console.log("In-app notification scheduled for user ".concat(recipient.id, " at ").concat(scheduleTime, " with job ID: ").concat(jobId));
                return [2 /*return*/, jobId];
            });
        });
    };
    InAppChannel.prototype.cancelScheduled = function (jobId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // This would integrate with a job queue to cancel scheduled jobs
                console.log("Cancel scheduled in-app notification job: ".concat(jobId, " (not implemented for setTimeout)"));
                return [2 /*return*/, false];
            });
        });
    };
    InAppChannel.prototype.getDeliveryStatus = function (messageId) {
        return __awaiter(this, void 0, void 0, function () {
            var notification, status_1, error_4;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .select()
                                .from(schema_js_1.notifications)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.notifications.id, messageId))
                                .limit(1)];
                    case 1:
                        notification = _g.sent();
                        if (notification.length === 0) {
                            return [2 /*return*/, []];
                        }
                        status_1 = {
                            messageId: ((_a = notification[0]) === null || _a === void 0 ? void 0 : _a.id) || '',
                            recipientId: ((_b = notification[0]) === null || _b === void 0 ? void 0 : _b.userId) || '',
                            status: ((_c = notification[0]) === null || _c === void 0 ? void 0 : _c.isRead) ? 'read' : 'delivered',
                            timestamp: ((_d = notification[0]) === null || _d === void 0 ? void 0 : _d.createdAt) || new Date(),
                            deliveredAt: ((_e = notification[0]) === null || _e === void 0 ? void 0 : _e.createdAt) || new Date(),
                            readAt: ((_f = notification[0]) === null || _f === void 0 ? void 0 : _f.readAt) || undefined,
                        };
                        return [2 /*return*/, [status_1]];
                    case 2:
                        error_4 = _g.sent();
                        console.error('Failed to get delivery status:', error_4);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.validateRecipient = function (recipient) {
        return __awaiter(this, void 0, void 0, function () {
            var user, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .select({ id: schema_js_1.users.id })
                                .from(schema_js_1.users)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, recipient.id))
                                .limit(1)];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user.length > 0];
                    case 2:
                        error_5 = _a.sent();
                        console.error('Failed to validate recipient:', error_5);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Test database connection by querying notifications table
                        return [4 /*yield*/, (0, db_js_1.default)().select().from(schema_js_1.notifications).limit(1)];
                    case 1:
                        // Test database connection by querying notifications table
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_6 = _a.sent();
                        console.error('In-app channel health check failed:', error_6);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    InAppChannel.prototype.updateConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.config = __assign(__assign({}, this.config), config);
                return [2 /*return*/];
            });
        });
    };
    // In-app specific methods
    InAppChannel.prototype.markAsRead = function (userId, notificationId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .update(schema_js_1.notifications)
                                .set({
                                isRead: true,
                                readAt: new Date(),
                            })
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.notifications.id, notificationId), (0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId)))
                                .returning()];
                    case 1:
                        result = _a.sent();
                        if (!(result.length > 0 && this.config.badgeCount.enabled)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.updateBadgeCount(userId)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/, result.length > 0];
                    case 4:
                        error_7 = _a.sent();
                        console.error('Failed to mark notification as read:', error_7);
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.markAllAsRead = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .update(schema_js_1.notifications)
                                .set({
                                isRead: true,
                                readAt: new Date(),
                            })
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.notifications.isRead, false)))
                                .returning()];
                    case 1:
                        result = _a.sent();
                        if (!(result.length > 0 && this.config.badgeCount.enabled)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.updateBadgeCount(userId)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/, result.length];
                    case 4:
                        error_8 = _a.sent();
                        console.error('Failed to mark all notifications as read:', error_8);
                        return [2 /*return*/, 0];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.getUserNotifications = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, options) {
            var _a, limit, _b, offset, _c, unreadOnly, type, query, result, error_9;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        _a = options.limit, limit = _a === void 0 ? 50 : _a, _b = options.offset, offset = _b === void 0 ? 0 : _b, _c = options.unreadOnly, unreadOnly = _c === void 0 ? false : _c, type = options.type;
                        query = (0, db_js_1.default)()
                            .select()
                            .from(schema_js_1.notifications)
                            .where((0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId))
                            .$dynamic();
                        if (unreadOnly) {
                            query = query.where((0, drizzle_orm_1.eq)(schema_js_1.notifications.isRead, false));
                        }
                        if (type && (type === 'message' || type === 'mention' || type === 'reaction' || type === 'system')) {
                            query = query.where((0, drizzle_orm_1.eq)(schema_js_1.notifications.type, type));
                        }
                        return [4 /*yield*/, query
                                .orderBy((0, drizzle_orm_1.desc)(schema_js_1.notifications.createdAt))
                                .limit(limit)
                                .offset(offset)];
                    case 1:
                        result = _d.sent();
                        return [2 /*return*/, result.map(function (notification) { return (__assign(__assign({}, notification), { data: notification.data ? JSON.parse(notification.data) : null })); })];
                    case 2:
                        error_9 = _d.sent();
                        console.error('Failed to get user notifications:', error_9);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.getUnreadCount = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_10;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .select({ count: (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["count(*)"], ["count(*)"]))) })
                                .from(schema_js_1.notifications)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.notifications.isRead, false)))];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) || 0];
                    case 2:
                        error_10 = _b.sent();
                        console.error('Failed to get unread count:', error_10);
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.cleanupOldNotifications = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var countResult, currentCount, deleteCount, oldestNotifications, idsToDelete, cutoffDate, error_11;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .select({ count: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["count(*)"], ["count(*)"]))) })
                                .from(schema_js_1.notifications)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId))];
                    case 1:
                        countResult = _b.sent();
                        currentCount = ((_a = countResult[0]) === null || _a === void 0 ? void 0 : _a.count) || 0;
                        if (!(currentCount >= this.config.maxNotificationsPerUser)) return [3 /*break*/, 4];
                        deleteCount = currentCount - this.config.maxNotificationsPerUser + 1;
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .select({ id: schema_js_1.notifications.id })
                                .from(schema_js_1.notifications)
                                .where((0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId))
                                .orderBy(schema_js_1.notifications.createdAt)
                                .limit(deleteCount)];
                    case 2:
                        oldestNotifications = _b.sent();
                        if (!(oldestNotifications.length > 0)) return [3 /*break*/, 4];
                        idsToDelete = oldestNotifications.map(function (n) { return n.id; });
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .delete(schema_js_1.notifications)
                                .where((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["", " = ANY(", ")"], ["", " = ANY(", ")"])), schema_js_1.notifications.id, idsToDelete))];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - this.config.autoDeleteAfterDays);
                        return [4 /*yield*/, (0, db_js_1.default)()
                                .delete(schema_js_1.notifications)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.notifications.userId, userId), (0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["", " < ", ""], ["", " < ", ""])), schema_js_1.notifications.createdAt, cutoffDate)))];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_11 = _b.sent();
                        console.error('Failed to cleanup old notifications:', error_11);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.sendRealTimeNotification = function (userId, notification) {
        return __awaiter(this, void 0, void 0, function () {
            var namespace, io;
            return __generator(this, function (_a) {
                try {
                    if (!this.socketIO)
                        return [2 /*return*/];
                    namespace = this.config.realTime.socketNamespace || '/';
                    io = this.socketIO.of(namespace);
                    // Send to specific user room
                    io.to("user-".concat(userId)).emit('notification', {
                        id: notification.id,
                        type: notification.type,
                        title: notification.title,
                        body: notification.body,
                        data: notification.data,
                        timestamp: notification.createdAt,
                        category: notification.category,
                        priority: notification.priority,
                    });
                }
                catch (error) {
                    console.error('Failed to send real-time notification:', error);
                }
                return [2 /*return*/];
            });
        });
    };
    InAppChannel.prototype.updateBadgeCount = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var unreadCount, badgeCount, namespace, io, error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getUnreadCount(userId)];
                    case 1:
                        unreadCount = _a.sent();
                        badgeCount = Math.min(unreadCount, this.config.badgeCount.maxCount);
                        if (this.socketIO) {
                            namespace = this.config.realTime.socketNamespace || '/';
                            io = this.socketIO.of(namespace);
                            io.to("user-".concat(userId)).emit('badge-update', {
                                count: badgeCount,
                                hasMore: unreadCount > this.config.badgeCount.maxCount,
                            });
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_12 = _a.sent();
                        console.error('Failed to update badge count:', error_12);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InAppChannel.prototype.compileTemplate = function (template, variables) {
        var compiledTitle = template.title || '';
        var compiledBody = template.body;
        // Simple template variable replacement
        Object.entries(variables).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            var placeholder = "{{".concat(key, "}}");
            compiledTitle = compiledTitle.replace(new RegExp(placeholder, 'g'), String(value));
            compiledBody = compiledBody.replace(new RegExp(placeholder, 'g'), String(value));
        });
        return {
            title: compiledTitle,
            body: compiledBody,
            type: template.type,
            priority: template.priority,
            category: template.category,
            data: variables,
        };
    };
    InAppChannel.prototype.generateMessageId = function () {
        return "in-app-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
    };
    InAppChannel.prototype.generateJobId = function () {
        return "job-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
    };
    InAppChannel.prototype.chunkArray = function (array, size) {
        var chunks = [];
        for (var i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };
    InAppChannel.prototype.setSocketIO = function (socketIO) {
        this.socketIO = socketIO;
    };
    return InAppChannel;
}());
exports.InAppChannel = InAppChannel;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
