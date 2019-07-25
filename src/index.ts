import Component from './component';
import Node from './node';
import Processer from './process';
import * as commandArgvParser from 'minimist';

export {
  Component,
  Node,
  Processer
}

export * from './utils';

export type ProcessArgvType = commandArgvParser.ParsedArgs | {
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
  constructor(processer: Processer, args: ProcessArgvType) {
    super(processer, args);
  }
}