/**
 * @jest-environment jsdom
 */

import React, { useCallback, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TeaPair, TeaUpdate, useTea, Cmd, exhaustiveCheck } from '../src/';

type Model = { count: number };

// prettier-ignore
type Msg =
  | 'increment'
  | 'delayed-increment';

const init: TeaPair<Model, Msg> = [{ count: 0 }, Cmd.noneAs()];
const update: TeaUpdate<Msg, Model> = (msg, model) => {
  switch (msg) {
    case 'increment':
      return [{ count: model.count + 1 }, Cmd.noneAs()];
    case 'delayed-increment':
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

function Counter() {
  const [model, dispatch] = useTea(init, update, []);

  const increment = useCallback(() => dispatch('increment'), []);
  const delayedIncrement = useCallback(() => dispatch('delayed-increment'), []);

  return (
    <div>
      <h1>{model.count}</h1>
      <button data-testid='increment' onClick={increment}>
        increment
      </button>
      <button data-testid='delayed-increment' onClick={delayedIncrement}>
        delayed increment
      </button>
    </div>
  );
}

test('The counter should work', async () => {
  render(<Counter />);

  screen.getByText('0');

  screen.getByTestId('increment').click();

  screen.getByText('1');

  screen.getByTestId('delayed-increment').click();

  await waitFor(() => {
    return screen.findByText('2');
  });

  // Combination of async-Cmd followed by sync-Cmd
  screen.getByTestId('delayed-increment').click();
  screen.getByTestId('increment').click();

  await waitFor(() => {
    return screen.findByText('4');
  });
});

function AccordionCounter() {
  const [showCounter, setShowCounter] = useState(true);

  const toggleCounter = useCallback(() => {
    setShowCounter(!showCounter);
  }, [showCounter]);

  return (
    <div>
      <button data-testid='toggle-counter' onClick={toggleCounter}>
        Toggle Counter
      </button>
      {showCounter && <Counter />}
    </div>
  );
}

test('The model should be initialized when it is re-rendered', async () => {
  render(<AccordionCounter />);
  screen.getByText('0');

  screen.getByTestId('delayed-increment').click();

  await waitFor(() => {
    return screen.findByText('1');
  });

  screen.getByTestId('toggle-counter').click();

  screen.getByTestId('toggle-counter').click();

  screen.getByText('0');
});

test('Cmd should be cancelled when unmounted', async () => {
  render(<AccordionCounter />);
  screen.getByText('0');

  screen.getByTestId('delayed-increment').click();

  // unmount
  screen.getByTestId('toggle-counter').click();

  // re-render
  screen.getByTestId('toggle-counter').click();

  await new Promise((resolve) => setTimeout(resolve, 500));

  screen.getByText('0');
});
