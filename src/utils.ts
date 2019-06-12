import { ChildProcess } from "child_process";
import { Worker } from 'cluster';
import Node from './node';

export enum STATUS {
  BOOTSTRAPING = 0,
  BOOTSTRAP_FAILED = 1,
  BOOTSTRAP_SUCCESS = 2,
  CLOSING = 3,
  CLOSE_FAILED = 4,
  CLOSE_SUCCESS = 5,
}

export enum CHILD_PROCESS_TYPE {
  MASTER = 0,
  WORKER = 1,
  AGENT = 2,
}

export function safeClose(callback: Function): void {
  let closing = false;
  process.on('SIGTERM', delayUntil);
  process.on('SIGINT', delayUntil);
  process.on('SIGQUIT', delayUntil);
  function delayUntil(): void {
    if (closing) return;
    closing = true;
    const timer = setInterval(() => {
      if (callback()) {
        clearInterval(timer);
        process.exit(0);
      }
    }, 33.33);
  }
}

export interface AGENT extends ChildProcess {
  node?: Node;
}

export interface WORKER extends Worker {
  node?: Node
}