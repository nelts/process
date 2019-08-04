import * as fs from 'fs';
import * as path from 'path';
import processer from './process';
import { ProcessArgvType } from './index';
import { STATUS, CHILD_PROCESS_TYPE } from './utils';
import * as commandArgvParser from 'minimist';
import { configure, getLogger, Configuration, Logger } from 'log4js';
let logger: Logger | Console = console;
const errorHandler = (err: Error) => {
  logger.error('[bootstrap error]:', err);
  sendToParent(STATUS.BOOTSTRAP_FAILED);
  process.exit(1);
}

bindError(errorHandler);

let args: ProcessArgvType = {};
const argv = process.argv.slice(2);

if (!argv.length) throw new Error('process.argv must be an array of string');
if (argv.length === 1 && argv[0].startsWith('{') && argv[0].endsWith('}')) {
  args = JSON.parse(argv[0]);
} else {
  args = (commandArgvParser(argv) || {}) as ProcessArgvType;
}

if (args.script && !path.isAbsolute(args.script)) {
  args.script = path.resolve(process.cwd(), args.script);
}

args.kind = args.kind || CHILD_PROCESS_TYPE.MASTER;
args.mpid = args.mpid || process.pid;

const loggerFilePath = path.resolve(`logger.configure.js`);
let loggerConfiguration = fs.existsSync(loggerFilePath) ? require(loggerFilePath) : {};
loggerConfiguration.appenders && configure(<Configuration>loggerConfiguration);

let category: string = 'default';
if (!loggerConfiguration.categories || !loggerConfiguration.categories.default) throw new Error('logger must have a category of default');
switch (args.kind) {
  case CHILD_PROCESS_TYPE.WORKER: 
    if (loggerConfiguration.categories.worker) category = 'worker';
    break;
  case CHILD_PROCESS_TYPE.MASTER:
    if (loggerConfiguration.categories.master) category = 'master';
    break;
  default:
    if (args.name && loggerConfiguration.categories[args.name]) category = args.name;
    if (category === 'default' && loggerConfiguration.categories.agent) category = 'agent';
}

logger = getLogger(category);

const ModuleHandleFile = args.module || args.script;
if (!ModuleHandleFile) throw new Error('cannot find the argument of `module` or `script`');
const sandbox = require(ModuleHandleFile);
class Runtime {
  private processer: processer;
  private sandbox: any;
  private errorHandler: (err: Error) => any;
  private messageHandler: (...args: any[]) => void;

  constructor() {
    this.processer = new processer(<Logger>logger, args.kind, args.mpid);
    this.processer.onExit((next: () => Promise<void>) => this.destroy().then(next).catch(next));
    this.sandbox = new (sandbox.default || sandbox)(this.processer, args);
  }

  async create() {
    if (typeof this.sandbox.componentWillCreate === 'function') await this.sandbox.componentWillCreate();
    this.createMessager();
    unbindError(errorHandler);
    this.errorHandler = err => err && this.sandbox.componentCatchError && this.sandbox.componentCatchError(err);
    bindError(this.errorHandler);
    if (typeof this.sandbox.componentDidCreated === 'function') await this.sandbox.componentDidCreated();
  }

  async destroy() {
    if (typeof this.sandbox.componentWillDestroy === 'function') await this.sandbox.componentWillDestroy();
    process.off('message', this.messageHandler);
    delete this.sandbox.send;
    delete this.sandbox.kill;
    if (this.sandbox.createAgent) delete this.sandbox.createAgent;
    if (this.sandbox.createWorkerForker) delete this.sandbox.createWorkerForker;
    unbindError(this.errorHandler);
    const errorHandler = (err: Error) => logger.error('[closing error]:', err);
    bindError(errorHandler);
    if (typeof this.sandbox.componentDidDestroyed === 'function') await this.sandbox.componentDidDestroyed();
  }

  async createMessager() {
    this.messageHandler = (message, socket) => {
      switch (message) {
        case 'kill': this.processer.closingSelfStatus = 1; break;
        default: this.sandbox.componentReceiveMessage && this.sandbox.componentReceiveMessage(message, socket);
      }
    };
    this.processer.onMessage(this.messageHandler);
    process.on('message', this.messageHandler);
  }
}

new Runtime()
  .create()
  .then(() => sendToParent(STATUS.BOOTSTRAP_SUCCESS));


function bindError(callback: any) {
  ['error', 'unhandledRejection', 'uncaughtException'].forEach((name: any) => process.on(name, callback));
}

function unbindError(callback: any) {
  ['error', 'unhandledRejection', 'uncaughtException'].forEach((name: any) => process.off(name, callback));
}

function sendToParent(value: any, socket?: any) {
  if (args.kind !== CHILD_PROCESS_TYPE.MASTER) {
    process.send(value, socket);
  }
}