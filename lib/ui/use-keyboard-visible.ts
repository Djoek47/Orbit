/**
 * Is the keyboard up, and how tall is it.
 *
 * Screens use this to give the keyboard room rather than fight it: the Poppins dock folds its
 * mic and tier pills away while you're typing, and the tab bar shrinks to its icons. On iOS the
 * `WillShow` events fire before the keyboard animates, so the layout moves with it instead of
 * after it.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export type KeyboardState = { visible: boolean; height: number };

export function useKeyboardState(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ visible: false, height: 0 });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setState({ visible: true, height: event.endCoordinates?.height ?? 0 });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setState({ visible: false, height: 0 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}

export function useKeyboardVisible(): boolean {
  return useKeyboardState().visible;
}
