"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const childProcess = require("child_process");
const utils_1 = require("./utils");
const node_1 = require("./node");
const cluster = require("cluster");
const scriptFilename = path.resolve(__dirname, './runtime');
class Process {
    constructor(logger, kind = utils_1.CHILD_PROCESS_TYPE.MASTER, mpid = process.pid, env) {
        this._logger = logger;
        this._mpid = mpid;
        this._agents = {};
        this._workers = [];
        this._pids = {};
        this._env = env;
        this._kind = kind;
        this._onExit = null;
        this._closing = false;
        this._closingAgentsStatus = 0;
        this._closingWorkersStatus = 0;
        this._closingSelfStatus = 1;
        this._timer = setInterval(() => { }, 7 * 24 * 60 * 1000);
        utils_1.safeClose(() => this._close());
    }
    set closingSelfStatus(value) {
        this._closingSelfStatus = value;
    }
    get workers() {
        return this._workers;
    }
    get agents() {
        return this._agents;
    }
    get pids() {
        return this._pids;
    }
    get logger() {
        return this._logger;
    }
    onMessage(callback) {
        this._lazyMessager = callback;
    }
    _onMessage(message, socket) {
        if (typeof message === 'object') {
            const to = message.to;
            if (typeof to === 'number' && to === process.pid)
                return this._lazyMessager && this._lazyMessager(message, socket);
            if (typeof to === 'number' && this._pids[to])
                return this._pids[to].send(message, socket);
            if (typeof to === 'string' && this._agents[to])
                return this._agents[to].send(message, socket);
            if (this._kind !== utils_1.CHILD_PROCESS_TYPE.MASTER)
                process.send(message, socket);
        }
        else {
        }
    }
    kill(pid = 0) {
        if (!pid)
            pid = this._kind !== utils_1.CHILD_PROCESS_TYPE.MASTER
                ? this._mpid
                : process.pid;
        process.kill(pid, 'SIGTERM');
    }
    _close() {
        this._closing = true;
        if (this._closingWorkersStatus === 0) {
            for (let i = 0; i < this._workers.length; i++) {
                const worker = this._workers[i];
                worker.close();
            }
            this._closingWorkersStatus = 1;
            return;
        }
        else if (this._closingWorkersStatus === 1) {
            for (let i = 0; i < this._workers.length; i++) {
                const worker = this._workers[i];
                if (worker.status <= 3)
                    return;
            }
            this._closingWorkersStatus = 2;
        }
        if (this._closingAgentsStatus === 0) {
            for (const agentName in this._agents) {
                this._agents[agentName].close();
            }
            this._closingAgentsStatus = 1;
            return;
        }
        else if (this._closingAgentsStatus === 1) {
            for (const agentName in this._agents) {
                if (this._agents[agentName].status <= 3)
                    return;
            }
            this._closingAgentsStatus = 2;
        }
        if ([0, 2].indexOf(this._closingSelfStatus) > -1) {
            return;
        }
        else if (this._closingSelfStatus === 1) {
            this._closingSelfStatus = 2;
            if (this._onExit) {
                this._onExit(() => {
                    clearInterval(this._timer);
                    this._closingSelfStatus = 3;
                });
            }
            else {
                this._closingSelfStatus = 3;
            }
            return;
        }
        return true;
    }
    onExit(callback) {
        if (typeof callback === 'function') {
            this._onExit = callback;
        }
    }
    createAgent(cwd = process.cwd(), name, file, args = {
        killSelf: false,
    }) {
        if (this._agents[name])
            throw new Error('agent is already exist: ' + name);
        const opts = {
            cwd: cwd,
            env: Object.create(process.env),
            stdio: 'inherit',
            execArgv: process.execArgv.slice(0),
        };
        args.cwd = opts.cwd;
        args.env = this._env;
        args.script = file;
        args.name = name;
        args.kind = utils_1.CHILD_PROCESS_TYPE.AGENT;
        args.mpid = this._mpid;
        const agent = childProcess.fork(scriptFilename, [JSON.stringify(args)], opts);
        const node = new node_1.default(agent, args.kind, name);
        agent.node = node;
        const bootstrap_exit_listener = () => node.status = utils_1.STATUS.BOOTSTRAP_FAILED;
        agent.on('exit', bootstrap_exit_listener);
        const bootstrap_message_handler = (status) => {
            if (typeof status !== 'number')
                return;
            node.status = status;
        };
        agent.on('message', bootstrap_message_handler);
        return new Promise((resolve, reject) => {
            const node_status_handler = (value) => {
                switch (value) {
                    case utils_1.STATUS.BOOTSTRAP_FAILED:
                        agent.off('exit', bootstrap_exit_listener);
                        agent.off('message', bootstrap_message_handler);
                        node.off('status', node_status_handler);
                        this.kill(args.killSelf ? node.pid : undefined);
                        reject();
                        break;
                    case utils_1.STATUS.BOOTSTRAP_SUCCESS:
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
            };
            node.on('status', node_status_handler);
        });
    }
    createWorkerForker(cwd = process.cwd(), name, file, args = {}) {
        const opts = {
            exec: scriptFilename,
            stdio: [0, 1, 2, 'ipc'],
            execArgv: process.execArgv.slice(0)
        };
        opts.args = [JSON.stringify(Object.assign(args, {
                cwd,
                env: this._env,
                script: file,
                name: name,
                kind: utils_1.CHILD_PROCESS_TYPE.WORKER,
                mpid: this._mpid,
            }))];
        cluster.setupMaster(opts);
        const fork = () => new Promise((resolve, reject) => {
            const node_handler = (node) => (value) => {
                switch (value) {
                    case utils_1.STATUS.BOOTSTRAP_FAILED:
                        cluster
                            .removeListener('fork', fork_handler)
                            .removeListener('exit', exit_handler)
                            .removeListener('message', msg_handler);
                        node.off('status', node_handler);
                        this.kill();
                        reject();
                        break;
                    case utils_1.STATUS.BOOTSTRAP_SUCCESS:
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
            };
            const fork_handler = (worker) => {
                const node = new node_1.default(worker, utils_1.CHILD_PROCESS_TYPE.WORKER, 'WORKER');
                worker.node = node;
                node.on('status', node_handler(node));
            };
            const exit_handler = (worker) => {
                const node = worker.node;
                if (node) {
                    node.status = utils_1.STATUS.BOOTSTRAP_FAILED;
                }
                if (!this._closing)
                    fork();
            };
            const msg_handler = (worker, code) => {
                if (typeof code !== 'number')
                    return;
                const node = worker.node;
                if (node) {
                    node.status = code;
                }
            };
            cluster.fork();
            cluster
                .on('fork', fork_handler)
                .on('exit', exit_handler)
                .on('message', msg_handler);
        });
        return fork;
    }
}
exports.default = Process;
