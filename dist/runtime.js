"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const process_1 = require("./process");
const utils_1 = require("./utils");
const commandArgvParser = require("minimist");
const log4js_1 = require("log4js");
let logger = console;
const errorHandler = (err) => {
    logger.error('[bootstrap error]:', err);
    sendToParent(utils_1.STATUS.BOOTSTRAP_FAILED);
    process.exit(1);
};
bindError(errorHandler);
let args = {};
const argv = process.argv.slice(2);
if (!argv.length)
    throw new Error('process.argv must be an array of string');
if (argv.length === 1 && argv[0].startsWith('{') && argv[0].endsWith('}')) {
    args = JSON.parse(argv[0]);
}
else {
    args = (commandArgvParser(argv) || {});
}
if (args.script && !path.isAbsolute(args.script)) {
    args.script = path.resolve(process.cwd(), args.script);
}
if (!args.env)
    args.env = process.env.NODE_ENV;
args.kind = args.kind || utils_1.CHILD_PROCESS_TYPE.MASTER;
args.mpid = args.mpid || process.pid;
const loggerFilePath = path.resolve(`logger.configure.js`);
let loggerConfiguration = fs.existsSync(loggerFilePath) ? require(loggerFilePath) : {};
loggerConfiguration.appenders && log4js_1.configure(loggerConfiguration);
let category = 'default';
if (!loggerConfiguration.categories || !loggerConfiguration.categories.default)
    throw new Error('logger must have a category of default');
switch (args.kind) {
    case utils_1.CHILD_PROCESS_TYPE.WORKER:
        if (loggerConfiguration.categories.worker)
            category = 'worker';
        break;
    case utils_1.CHILD_PROCESS_TYPE.MASTER:
        if (loggerConfiguration.categories.master)
            category = 'master';
        break;
    default:
        if (args.name && loggerConfiguration.categories[args.name])
            category = args.name;
        if (category === 'default' && loggerConfiguration.categories.agent)
            category = 'agent';
}
logger = log4js_1.getLogger(category);
const ModuleHandleFile = args.module || args.script;
if (!ModuleHandleFile)
    throw new Error('cannot find the argument of `module` or `script`');
const sandbox = require(ModuleHandleFile);
class Runtime {
    constructor() {
        logger.info('start process env:', args.env);
        this.processer = new process_1.default(logger, args.kind, args.mpid, args.env);
        this.processer.onExit((next) => this.destroy().then(next).catch(next));
        this.sandbox = new (sandbox.default || sandbox)(this.processer, args);
    }
    async create() {
        if (typeof this.sandbox.componentWillCreate === 'function')
            await this.sandbox.componentWillCreate();
        this.createMessager();
        unbindError(errorHandler);
        this.errorHandler = err => err && this.sandbox.componentCatchError && this.sandbox.componentCatchError(err);
        bindError(this.errorHandler);
        if (typeof this.sandbox.componentDidCreated === 'function')
            await this.sandbox.componentDidCreated();
    }
    async destroy() {
        if (typeof this.sandbox.componentWillDestroy === 'function')
            await this.sandbox.componentWillDestroy();
        process.off('message', this.messageHandler);
        delete this.sandbox.send;
        delete this.sandbox.kill;
        if (this.sandbox.createAgent)
            delete this.sandbox.createAgent;
        if (this.sandbox.createWorkerForker)
            delete this.sandbox.createWorkerForker;
        unbindError(this.errorHandler);
        const errorHandler = (err) => logger.error('[closing error]:', err);
        bindError(errorHandler);
        if (typeof this.sandbox.componentDidDestroyed === 'function')
            await this.sandbox.componentDidDestroyed();
    }
    async createMessager() {
        this.messageHandler = (message, socket) => {
            switch (message) {
                case 'kill':
                    this.processer.closingSelfStatus = 1;
                    break;
                default: this.sandbox.componentReceiveMessage && this.sandbox.componentReceiveMessage(message, socket);
            }
        };
        this.processer.onMessage(this.messageHandler);
        process.on('message', this.messageHandler);
    }
}
new Runtime()
    .create()
    .then(() => sendToParent(utils_1.STATUS.BOOTSTRAP_SUCCESS));
function bindError(callback) {
    ['error', 'unhandledRejection', 'uncaughtException'].forEach((name) => process.on(name, callback));
}
function unbindError(callback) {
    ['error', 'unhandledRejection', 'uncaughtException'].forEach((name) => process.off(name, callback));
}
function sendToParent(value, socket) {
    if (args.kind !== utils_1.CHILD_PROCESS_TYPE.MASTER) {
        process.send(value, socket);
    }
}
