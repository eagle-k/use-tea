export type Dispatch<TMsg> = (msg: TMsg) => void;

export type Sub<TMsg> = (dispatch: Dispatch<TMsg>) => void;

export type Cmd<TMsg> = Sub<TMsg>[];

export function noneAs<TMsg>(): Cmd<TMsg> {
  return [];
}

export function ofSub<TMsg>(sub: Sub<TMsg>): Cmd<TMsg> {
  return [sub];
}

export function ofPromiseBuilder<TMsg>(
  promiseBuilder: () => Promise<TMsg>,
  fail: (err: Error) => TMsg,
): Cmd<TMsg> {
  return [
    (dispatch) => {
      promiseBuilder()
        .then(dispatch)
        .catch((err) => dispatch(fail(err)));
    },
  ];
}

export function batch<TMsg>(cmds: Cmd<TMsg>[]) {
  const batchCmd: Cmd<TMsg> = [];
  for (const cmd of cmds) {
    for (const sub of cmd) {
      batchCmd.push(sub);
    }
  }
  return batchCmd;
}

export const Cmd = { noneAs, ofSub, ofPromiseBuilder, batch };
