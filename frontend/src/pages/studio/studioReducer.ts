import { StudioState, StudioAction, initialState, mergeCertificateLayout } from './types';
import { parseBulkText } from './utils';

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        step: 0,
        single: { ...initialState.single },
        bulk: { ...initialState.bulk },
        csv: { ...initialState.csv },
      };

    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'ADVANCE_STEP':
      return { ...state, step: state.step + 1 };

    case 'UPDATE_SINGLE':
      return {
        ...state,
        single: { ...state.single, [action.field]: action.value },
      };

    case 'UPDATE_BULK_TEXT':
      return {
        ...state,
        bulk: { rawText: action.text, parsedLines: parseBulkText(action.text) },
      };

    case 'SET_CSV_FILE':
      return {
        ...state,
        csv: { file: action.file, parsedRows: action.rows },
      };

    case 'UPDATE_BRANDING':
      return {
        ...state,
        branding: { ...state.branding, ...action.patch },
      };

    case 'UPDATE_AUTHORITY':
      return {
        ...state,
        authority: { ...state.authority, ...action.patch },
      };

    case 'UPDATE_CERTIFICATE_LAYOUT':
      return {
        ...state,
        certificateLayout: mergeCertificateLayout(action.patch, state.certificateLayout),
      };

    case 'SET_ERRORS':
      return { ...state, errors: action.errors };

    case 'SET_GENERATION_STATUS':
      return { ...state, generationStatus: action.status };

    case 'SET_RESULT':
      return {
        ...state,
        result: { ...state.result, ...action.result },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
