import Processer from './process';
import { CHILD_PROCESS_TYPE } from './utils';
export default class ProcessComponent {
  private processer: Processer;
  private arguments: { [name:string]: any };

  constructor(processer: Processer, args: { [name:string]: any }) {
    this.processer = processer;
    this.arguments = args;
  }

  kill(pid: number = 0) {
    return this.processer.kill(pid);
  }

  send(message: any, socket: any) {
    const options = {
      message,
      from: process.pid
    }
    if (this.arguments.kind !== CHILD_PROCESS_TYPE.MASTER) {
      process.send(options, socket);
    }
  }

  createAgent(name: string, file: string, _args?: any) {
    if (this.arguments.kind === CHILD_PROCESS_TYPE.WORKER) return;
    return this.processer.createAgent(this.arguments.cwd || process.cwd(), name, file, _args);
  }

  createWorkerForker(file: string, _args?: any) {
    if (this.arguments.kind === CHILD_PROCESS_TYPE.WORKER) return;
    return this.processer.createWorkerForker(this.arguments.cwd || process.cwd(), 'worker', file, _args);
  }
}