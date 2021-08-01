import { useState, useEffect, useCallback, useRef } from 'react';

import { Cmd, Dispatch } from './Cmd';

export type TeaPair<TModel, TMsg> = [TModel, Cmd<TMsg>];
export type TeaUpdate<TMsg, TModel> = (
  msg: TMsg,
  model: TModel,
) => [TModel, Cmd<TMsg>];

export function useTea<TModel, TMsg>(
  init: TeaPair<TModel, TMsg>,
  update: TeaUpdate<TMsg, TModel>,
  deps: any[],
): [TModel, Dispatch<TMsg>] {
  const [initModel, initCmd] = init;

  const modelRef = useRef(initModel);
  const [model, setModel] = useState(initModel);

  // Don't perform React state updates on unmounted components.
  const unmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const dispatch: Dispatch<TMsg> = useCallback(function loop(msg) {
    if (unmountedRef.current) return;
    const [nextModel, nextCmd] = update(msg, modelRef.current);
    for (const sub of nextCmd) {
      sub(loop);
    }
    modelRef.current = nextModel;
    if (unmountedRef.current) return;
    setModel(modelRef.current);
  }, []);

  // Initialize on first rendering and when dependencies change.
  useEffect(() => {
    modelRef.current = initModel;
    if (unmountedRef.current) return;
    setModel(modelRef.current);
    for (const sub of initCmd) {
      sub(dispatch);
    }
  }, deps);

  return [model, dispatch];
}
