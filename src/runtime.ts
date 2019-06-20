import * as path from 'path';
import processer from './process';
import { STATUS, CHILD_PROCESS_TYPE } from './utils';
import * as commandArgvParser from 'minimist';

let args: any = {};
const argv = process.argv.slice(2);

if (!argv.length) {
  console.error('process.argv need arguments');
  process.exit(1);
}

if (argv.length === 1 && argv[0].startsWith('{') && argv[0].endsWith('}')) {
  args = JSON.parse(argv[0]);
} else {
  args = commandArgvParser(argv) || {};
}

if (args.script && !path.isAbsolute(args.script)) {
  args.script = path.resolve(process.cwd(), args.script);
}

args.kind = args.kind || CHILD_PROCESS_TYPE.MASTER;
args.mpid = args.mpid || process.pid;

const errorHandler = (err: Error) => {
  console.error('[bootstrap error]:', err);
  sendToParent(STATUS.BOOTSTRAP_FAILED);
  process.exit(1);
}

bindError(errorHandler);

const ModuleHandleFile = args.module || args.script;
if (!ModuleHandleFile) throw new Error('cannot find the argument of `module` or `script`');
const sandbox = require(ModuleHandleFile);
class Runtime {
  private processer: processer;
  private sandbox: any;
  private errorHandler: (err: Error) => any;
  private messageHandler: (...args: any[]) => void;

  constructor() {
    this.processer = new processer(args.kind, args.mpid);
    this.processer.onExit((next: () => PromiseLike<void>) => this.destroy().then(next).catch(next));
    this.sandbox = new (sandbox.default || sandbox)(this.processer, args);
  }

  async create() {
    if (typeof this.sandbox.componentWillCreate === 'function') await this.sandbox.componentWillCreate();
    this.createMessager();
    unbindError(errorHandler);
    this.errorHandler = err => this.sandbox.componentCatchError && this.sandbox.componentCatchError(err);
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
    const errorHandler = (err: Error) => console.error('[closing error]:', err);
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