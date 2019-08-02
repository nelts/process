import * as path from 'path';
import * as childProcess from 'child_process';
import { CHILD_PROCESS_TYPE, STATUS, safeClose, AGENT, WORKER } from './utils';
import Node from './node';
import * as cluster from 'cluster';
const scriptFilename = path.resolve(__dirname, './runtime');
import { Logger } from 'log4js';

export default class Process {
  private _mpid: number;
  private _agents: { [name: string]: Node };
  private _workers: Array<Node>;
  private _pids: { [id: number]: Node };
  private _kind: CHILD_PROCESS_TYPE;
  private _onExit: Function;
  private _closing: boolean;
  private _closingAgentsStatus: STATUS;
  private _closingWorkersStatus: STATUS;
  private _closingSelfStatus: STATUS;
  private _timer: NodeJS.Timeout;
  private _lazyMessager: Function;
  private _logger: Logger;

  constructor(
    logger: Logger,
    kind: CHILD_PROCESS_TYPE = CHILD_PROCESS_TYPE.MASTER, 
    mpid: number = process.pid
  ) {
    this._logger = logger;
    this._mpid = mpid;
    this._agents = {};
    this._workers = [];
    this._pids = {};
    this._kind = kind;
    this._onExit = null;
    this._closing = false;
    this._closingAgentsStatus = 0;
    this._closingWorkersStatus = 0;
    // this._closingSelfStatus = kind === CHILD_PROCESS_TYPE.MASTER ? 1 : 0;
    this._closingSelfStatus = 1;
    this._timer = setInterval(() => {}, 7 * 24 * 60 * 1000);
    safeClose(() => this._close());
  }

  set closingSelfStatus(value: STATUS) {
    this._closingSelfStatus = value;
  }

  get workers(): Array<Node> {
    return this._workers;
  }

  get agents(): { [name: string]: Node } {
    return this._agents;
  }

  get pids(): { [id: number]: Node } {
    return this._pids;
  }

  get logger() {
    return this._logger;
  }

  onMessage(callback: Function) {
    this._lazyMessager = callback;
  }

  // 从子进程收到的消息
  // 需要我们转发
  private _onMessage(message: any, socket: any) {
    if (typeof message === 'object') {
      const to = message.to;
      if (typeof to === 'number' && to === process.pid) return this._lazyMessager && this._lazyMessager(message, socket);
      if (typeof to === 'number' && this._pids[to]) return this._pids[to].send(message, socket);
      if (typeof to === 'string' && this._agents[to]) return this._agents[to].send(message, socket);
      if (this._kind !== CHILD_PROCESS_TYPE.MASTER) process.send(message, socket);
    } else {
      // TODO: typeof string's operation
    }
  }

  kill(pid: number = 0) {
    if (!pid) pid = this._kind !== CHILD_PROCESS_TYPE.MASTER
      ? this._mpid
      : process.pid;
    process.kill(pid, 'SIGTERM');
  }

  private _close() {
    this._closing = true;
    if (this._closingWorkersStatus === 0) {
      for (let i = 0; i < this._workers.length; i++) {
        const worker = this._workers[i];
        worker.close();
      }
      this._closingWorkersStatus = 1;
      return;
    } else if (this._closingWorkersStatus === 1) {
      for (let i = 0; i < this._workers.length; i++) {
        const worker = this._workers[i];
        if (worker.status <= 3) return;
      }
      this._closingWorkersStatus = 2;
    }

    if (this._closingAgentsStatus === 0) {
      for (const agentName in this._agents) {
        this._agents[agentName].close();
      }
      this._closingAgentsStatus = 1;
      return;
    } else if (this._closingAgentsStatus === 1) {
      for (const agentName in this._agents) {
        if (this._agents[agentName].status <= 3) return;
      }
      this._closingAgentsStatus = 2;
    }

    if ([0, 2].indexOf(this._closingSelfStatus) > -1) { return; } 
    else if (this._closingSelfStatus === 1) {
      this._closingSelfStatus = 2;
      if (this._onExit) {
        this._onExit(() => {
          clearInterval(this._timer);
          this._closingSelfStatus = 3;
        });
      } else {
        this._closingSelfStatus = 3;
      }
      return;
    }

    return true;
  }

  onExit(callback: Function) {
    if (typeof callback === 'function') {
      this._onExit = callback;
    }
  }

  createAgent(
    cwd: string = process.cwd(), 
    name: string, 
    file: string, 
    args: { 
      killSelf?: boolean,
      [name:string]: any,
    } = {
      killSelf: false,
    }
  ) {
    if (this._agents[name]) throw new Error('agent is already exist: ' + name);

    const opts: childProcess.ForkOptions = {
      cwd: cwd,
      env: Object.create(process.env),
      stdio: 'inherit',
      execArgv: process.execArgv.slice(0),
    };

    args.cwd = opts.cwd;
    args.env = opts.env.NODE_ENV || 'production';
    args.script = file;
    args.name = name;
    args.kind = CHILD_PROCESS_TYPE.AGENT;
    args.mpid = this._mpid;

    const agent: AGENT = childProcess.fork(scriptFilename, [JSON.stringify(args)], opts);
    const node = new Node(agent, args.kind, name);
    agent.node = node;

    // 启动时候进程退出事件
    const bootstrap_exit_listener = () => node.status = STATUS.BOOTSTRAP_FAILED;
    agent.on('exit', bootstrap_exit_listener);

    // 启动时候接受消息事件
    const bootstrap_message_handler = (status: STATUS) => {
      if (typeof status !== 'number') return;
      node.status = status;
    }
    agent.on('message', bootstrap_message_handler);

    return new Promise((resolve, reject) => {
      // node 子进程节点状态改变事件
      const node_status_handler = (value: STATUS) => {
        switch (value) {
          case STATUS.BOOTSTRAP_FAILED: 
            agent.off('exit', bootstrap_exit_listener);
            agent.off('message', bootstrap_message_handler);
            node.off('status', node_status_handler);
            this.kill(args.killSelf ? node.pid : undefined);
            reject();
            break;
          case STATUS.BOOTSTRAP_SUCCESS: 
            agent.off('exit', bootstrap_exit_listener);
            agent.off('message', bootstrap_message_handler);
            node.off('status', node_status_handler);
            this._agents[name] = node;
            this._pids[node.pid] = node;
            node.onClose(this);
            node.onCreatedReceiveMessage(this._onMessage.bind(this));
            resolve(node);
            break;
        }
      }
      node.on('status', node_status_handler);
    });
  }

  createWorkerForker(
    cwd: string = process.cwd(), 
    name: string, 
    file: string, 
    args: { [name:string]: any } = {}
  ) {

    const opts: cluster.ClusterSettings = {
      exec: scriptFilename,
      stdio: [0, 1, 2, 'ipc'],
      execArgv: process.execArgv.slice(0)
    };

    opts.args = [JSON.stringify(Object.assign(args, {
      cwd,
      env: process.env.NODE_ENV || 'production',
      script: file,
      name: name,
      kind: CHILD_PROCESS_TYPE.WORKER,
      mpid: this._mpid,
    }))];

    cluster.setupMaster(opts);

    const fork: () => Promise<Node> = () => new Promise((resolve, reject) => {
      const node_handler = (node: Node) => (value: STATUS) => {
        switch (value) {
          case STATUS.BOOTSTRAP_FAILED: 
            cluster
              .removeListener('fork', fork_handler)
              .removeListener('exit', exit_handler)
              .removeListener('message', msg_handler);
            node.off('status', node_handler);
            this.kill();
            reject(); 
            break;
          case STATUS.BOOTSTRAP_SUCCESS: 
            cluster
              .removeListener('fork', fork_handler)
              .removeListener('exit', exit_handler)
              .removeListener('message', msg_handler);
            node.off('status', node_handler);
            this._workers.push(node);
            this._pids[node.pid] = node;
            node.onClose(this);
            node.onCreatedReceiveMessage(this._onMessage.bind(this));
            resolve(node); 
            break;
        }
      }

      const fork_handler = (worker: WORKER) => {
        const node = new Node(worker, CHILD_PROCESS_TYPE.WORKER, 'WORKER');
        worker.node = node;
        node.on('status', node_handler(node));
      }

      const exit_handler = (worker: WORKER) => {
        const node = worker.node;
        if (node) {
          node.status = STATUS.BOOTSTRAP_FAILED;
        }
        if (!this._closing) fork();
      }

      const msg_handler = (worker: WORKER, code: number) => {
        if (typeof code !== 'number') return;
        const node = worker.node;
        if (node) {
          node.status = code;
        }
      }

      cluster.fork();

      cluster
        .on('fork', fork_handler)
        .on('exit', exit_handler)
        .on('message', msg_handler);
    });

    return fork;
  }
}