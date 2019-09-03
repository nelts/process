import { CHILD_PROCESS_TYPE, STATUS } from './utils';
import Node from './node';
import { Logger } from 'log4js';
export default class Process {
    private _mpid;
    private _agents;
    private _workers;
    private _pids;
    private _kind;
    private _onExit;
    private _closing;
    private _env;
    private _closingAgentsStatus;
    private _closingWorkersStatus;
    private _closingSelfStatus;
    private _timer;
    private _lazyMessager;
    private _logger;
    constructor(logger: Logger, kind: CHILD_PROCESS_TYPE, mpid: number, env: string);
    closingSelfStatus: STATUS;
    readonly workers: Array<Node>;
    readonly agents: {
        [name: string]: Node;
    };
    readonly pids: {
        [id: number]: Node;
    };
    readonly logger: Logger;
    onMessage(callback: Function): void;
    private _onMessage;
    kill(pid?: number): void;
    private _close;
    onExit(callback: Function): void;
    createAgent(cwd: string, name: string, file: string, args?: {
        killSelf?: boolean;
        [name: string]: any;
    }): Promise<unknown>;
    createWorkerForker(cwd: string, name: string, file: string, args?: {
        [name: string]: any;
    }): () => Promise<Node>;
}
