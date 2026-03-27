declare module 'cc' {
  export const _decorator: {
    ccclass(name: string): ClassDecorator;
    property(type?: unknown): PropertyDecorator;
  };

  export class Node {
    active: boolean;
  }

  export class Component {
    readonly node: Node;
  }

  export class Label extends Component {
    string: string;
  }
}
