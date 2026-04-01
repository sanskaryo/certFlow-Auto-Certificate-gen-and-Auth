import { useReducer } from 'react';
import { studioReducer } from './studioReducer';
import { initialState } from './types';

export default function useStudioReducer() {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  return { state, dispatch };
}
