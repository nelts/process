import Component from './component';
import Node from './node';
import Processer from './process';

export {
  Component,
  Node,
  Processer
}

export * from './utils';

export interface ProcessArgvType {
  cwd?: string,
  env?: string,
  script?: string,
  kind?: number,
  mpid?: number,
  module?: string,
  name?: string,
}

export class WidgetComponent extends Component {
  componentWillCreate?(): Promise<any>;
  componentDidCreated?(): Promise<any>;
  componentWillDestroy?(): Promise<any>;
  componentDidDestroyed?(): Promise<any>;
  componentCatchError?(err: Error): void;
  componentReceiveMessage?(message: any, socket?:any): void;
  constructor(processer: Processer, args: ProcessArgvType) {
    super(processer, args);
  }
}