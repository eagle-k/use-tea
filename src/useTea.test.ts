import { renderHook, act } from '@testing-library/react-hooks/native';

import { Cmd } from './Cmd';
import { useTea, TeaPair, TeaUpdate } from './useTea';
import { exhaustiveCheck } from './helper';

type CounterModel = { count: number };

// prettier-ignore
type CounterMsg =
  | "increment"
  | "decrement"
  | "delay-increment";

const counterInit: TeaPair<CounterModel, CounterMsg> = [
  { count: 0 },
  Cmd.noneAs(),
];

const counterUpdate: TeaUpdate<CounterMsg, CounterModel> = (msg, model) => {
  switch (msg) {
    case 'increment':
      return [{ count: model.count + 1 }, Cmd.noneAs()];
    case 'decrement':
      return [{ count: model.count - 1 }, Cmd.noneAs()];
    case 'delay-increment':
      return [
        model,
        Cmd.ofSub((dispatch) => {
          setTimeout(() => {
            dispatch('increment');
          }, 500);
        }),
      ];
  }
  exhaustiveCheck(msg);
};

test('The hook should return an initial model and a dispatch function', () => {
  const { result } = renderHook(() => useTea(counterInit, counterUpdate, []));

  expect(result.current[0]).toStrictEqual({ count: 0 });
  expect(typeof result.current[1]).toBe('function');
});

test('Synchronous dispatching should be reflected in the model', () => {
  const { result } = renderHook(() => useTea(counterInit, counterUpdate, []));

  expect(result.current[0]).toStrictEqual({ count: 0 });

  act(() => {
    result.current[1]('increment');
  });

  expect(result.current[0]).toStrictEqual({ count: 1 });

  act(() => {
    result.current[1]('increment');
  });

  expect(result.current[0]).toStrictEqual({ count: 2 });

  act(() => {
    result.current[1]('decrement');
  });

  expect(result.current[0]).toStrictEqual({ count: 1 });
});

test('Asynchronous dispatching should be reflected in the model', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useTea(counterInit, counterUpdate, []),
  );

  expect(result.current[0]).toStrictEqual({ count: 0 });

  act(() => {
    result.current[1]('delay-increment');
  });

  expect(result.current[0]).toStrictEqual({ count: 0 });

  await waitForNextUpdate();

  expect(result.current[0]).toStrictEqual({ count: 1 });

  act(() => {
    result.current[1]('delay-increment');
    result.current[1]('increment');
  });

  await waitForNextUpdate();

  expect(result.current[0]).toStrictEqual({ count: 3 });
});

class FakeLocalStorage {
  private store: { [key: string]: string } = {};

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }
}

type LoginFormModel = {
  username: string;
  password: string;
  loading: boolean;
  message: string;
};

// prettier-ignore
type LoginFormMsg =
  | { type: "set-username", username: string }
  | { type: "set-password", password: string }
  | { type: "login" }
  | { type: "login-succeeded", message: string }
  | { type: "login-failed", err: Error }

test('Initial Cmd and promise-based Cmd should work', async () => {
  const fakeLocalStorage = new FakeLocalStorage();
  fakeLocalStorage.setItem('username', 'Alice');

  const loginFormInit: TeaPair<LoginFormModel, LoginFormMsg> = [
    { username: '', password: '', loading: false, message: '' },
    Cmd.ofSub((dispatch) => {
      const username = fakeLocalStorage.getItem('username');
      if (username !== null) {
        dispatch({ type: 'set-username', username });
      }
    }),
  ];

  const fakeLoginFetch = jest.fn((username: string, password: string) =>
    Promise.resolve({
      json() {
        if (username === 'Alice' && password === 'pwd') {
          return Promise.resolve({ message: 'login succeeded' });
        }
        throw new TypeError('Failed to fetch');
      },
    }),
  );

  const loginFormUpdate: TeaUpdate<LoginFormMsg, LoginFormModel> = (
    msg,
    model,
  ) => {
    switch (msg.type) {
      case 'set-username':
        return [{ ...model, username: msg.username }, Cmd.noneAs()];
      case 'set-password':
        return [{ ...model, password: msg.password }, Cmd.noneAs()];
      case 'login':
        return [
          { ...model, loading: true, message: '' },
          Cmd.ofPromiseBuilder(
            () =>
              fakeLoginFetch(model.username, model.password)
                .then((response) => response.json())
                .then((data) => ({
                  type: 'login-succeeded',
                  message: data.message,
                })),
            (err) => ({ type: 'login-failed', err }),
          ),
        ];
      case 'login-succeeded':
        return [
          { ...model, loading: false, message: msg.message },
          Cmd.noneAs(),
        ];
      case 'login-failed':
        return [
          { ...model, loading: false, message: msg.err.message },
          Cmd.noneAs(),
        ];
    }
    // exhaustiveCheck(msg.type)
  };

  const { result, waitForNextUpdate } = renderHook(() =>
    useTea(loginFormInit, loginFormUpdate, []),
  );

  expect(result.current[0]).toStrictEqual({
    username: 'Alice',
    password: '',
    loading: false,
    message: '',
  });

  act(() => {
    result.current[1]({ type: 'set-password', password: 'pwd' });
  });

  expect(result.current[0]).toStrictEqual({
    username: 'Alice',
    password: 'pwd',
    loading: false,
    message: '',
  });

  act(() => {
    result.current[1]({ type: 'login' });
  });

  expect(result.current[0]).toStrictEqual({
    username: 'Alice',
    password: 'pwd',
    loading: true,
    message: '',
  });

  await waitForNextUpdate();

  expect(result.current[0]).toStrictEqual({
    username: 'Alice',
    password: 'pwd',
    loading: false,
    message: 'login succeeded',
  });

  expect(fakeLoginFetch.mock.calls.length).toBe(1);
  expect(fakeLoginFetch.mock.calls[0][0]).toBe('Alice');
  expect(fakeLoginFetch.mock.calls[0][1]).toBe('pwd');

  act(() => {
    result.current[1]({ type: 'set-username', username: 'fake-network-error' });
    result.current[1]({ type: 'login' });
  });

  await waitForNextUpdate();

  expect(result.current[0]).toStrictEqual({
    username: 'fake-network-error',
    password: 'pwd',
    loading: false,
    message: 'Failed to fetch',
  });

  expect(fakeLoginFetch.mock.calls.length).toBe(2);
});

type BatchCounterModel = { count: number };
type BatchCounterMsg = 'increment' | 'delay-ten-thousand';

const batchCounterInit: TeaPair<BatchCounterModel, BatchCounterMsg> = [
  { count: 0 },
  Cmd.noneAs(),
];

const batchCounterUpdate: TeaUpdate<BatchCounterMsg, BatchCounterModel> = (
  msg,
  model,
) => {
  switch (msg) {
    case 'increment':
      return [{ count: model.count + 1 }, Cmd.noneAs()];
    case 'delay-ten-thousand':
      const createDelayedIncrementCmd = (delay: number) =>
        Cmd.ofSub<BatchCounterMsg>((dispatch) => {
          setTimeout(dispatch, delay, 'increment');
        });
      return [
        model,
        Cmd.batch(
          Array(10000)
            .fill(() => Math.random() * 1000)
            .map((f) => createDelayedIncrementCmd(f())),
        ),
      ];
  }
  exhaustiveCheck(msg);
};

test('All Cmds should be executed', async () => {
  const { result, waitFor } = renderHook(() =>
    useTea(batchCounterInit, batchCounterUpdate, []),
  );

  expect(result.current[0]).toStrictEqual({ count: 0 });

  act(() => {
    result.current[1]('delay-ten-thousand');
  });

  await waitFor(() => {
    result.current[0].count === 10000;
  });

  act(() => {
    for (let i = 0; i < 100; i++) {
      result.current[1]('delay-ten-thousand');
    }
  });

  await waitFor(() => {
    result.current[0].count === 10000 + 100 * 10000;
  });
});
