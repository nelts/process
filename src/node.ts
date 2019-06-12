import * as emitter from 'events';
import { CHILD_PROCESS_TYPE, STATUS, AGENT, WORKER } from './utils';
import Processer from './process';

export default class Node extends emitter.EventEmitter {
  private _target: AGENT | WORKER;
  private _status: number;
  private _kind: CHILD_PROCESS_TYPE;
  private _name: string;

  constructor(
    target: AGENT | WORKER, 
    kind: CHILD_PROCESS_TYPE, 
    name: string
  ) {
    super();
    this._target = target;
    this._status = 0;
    this._kind = kind;
    this._name = name;
  }

  get pid(): number | undefined {
    switch (this._kind) {
      case CHILD_PROCESS_TYPE.WORKER: return (this._target as WORKER).process.pid;
      case CHILD_PROCESS_TYPE.AGENT: return (this._target as AGENT).pid;
    }
  }

  get killed(): boolean | undefined {
    switch (this._kind) {
      case CHILD_PROCESS_TYPE.WORKER: return (this._target as WORKER).isDead();
      case CHILD_PROCESS_TYPE.AGENT: return (this._target as AGENT).killed;
    }
  }

  set status(value: STATUS) {
    this._status = value;
    this.emit('status', value);
  }

  get status(): STATUS {
    return this._status;
  }

  onClose(app: Processer) {
    this._target.on('exit', (code: STATUS) => {
      this.status = code ? 4 : 5;
      switch (this._kind) {
        case CHILD_PROCESS_TYPE.WORKER: 
          const index: number = app.workers.indexOf(this);
          if (index > -1) {
            app.workers.splice(index, 1);
            delete app.pids[this.pid];
          }
          break;
        case CHILD_PROCESS_TYPE.AGENT: 
          for (const i in app.agents) {
            if (app.agents[i] === this) {
              delete app.agents[i];
              delete app.pids[this.pid];
            }
          }
          break;
        default:;
      }
    });
  }

  onCreatedReceiveMessage(callback: Function) {
    this._target.on('message', (message, socket) => callback(message, socket));
  }

  close() {
    this.status = 3;
    this._target.send('kill');
    this._target.kill('SIGTERM');
  }

  send(message: any, socket?: any): Node {
    this._target.send(message, socket);
    return this;
  }
}