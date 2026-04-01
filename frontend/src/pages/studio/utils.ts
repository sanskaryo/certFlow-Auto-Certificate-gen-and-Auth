import { ParsedLine, CsvRow, StudioState, ValidationErrors } from './types';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseBulkLine(line: string): ParsedLine {
  // Split on first 2 commas only (to allow commas in role)
  const firstComma = line.indexOf(',');
  const secondComma = firstComma >= 0 ? line.indexOf(',', firstComma + 1) : -1;

  let name = '';
  let email = '';
  let role = '';

  if (firstComma === -1) {
    name = line.trim();
  } else if (secondComma === -1) {
    name = line.slice(0, firstComma).trim();
    email = line.slice(firstComma + 1).trim();
  } else {
    name = line.slice(0, firstComma).trim();
    email = line.slice(firstComma + 1, secondComma).trim();
    role = line.slice(secondComma + 1).trim();
  }

  const emailValid = !email || EMAIL_REGEX.test(email);
  const valid = name.length > 0 && emailValid;

  let error: string | null = null;
  if (!name) {
    error = 'Name is required';
  } else if (!emailValid) {
    error = 'Invalid email format';
  }

  return { raw: line, name, email, role, valid, error };
}

export function parseBulkText(text: string): ParsedLine[] {
  return text
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(parseBulkLine);
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const dataLines = lines.slice(1);

  const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const roleIdx = headers.indexOf('role');

  return dataLines
    .filter(line => line.trim().length > 0)
    .map((line, i) => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

      if (nameIdx === -1) {
        return {
          rowIndex: i + 2,
          raw: line,
          name: '',
          email: '',
          role: '',
          valid: false,
          error: 'Missing required "name" column',
        };
      }

      const name = cols[nameIdx] ?? '';
      const email = emailIdx >= 0 ? (cols[emailIdx] ?? '') : '';
      const role = roleIdx >= 0 ? (cols[roleIdx] ?? '') : '';

      const emailValid = !email || EMAIL_REGEX.test(email);
      const valid = name.length > 0 && emailValid;

      let error: string | null = null;
      if (!name) {
        error = 'Name is required';
      } else if (!emailValid) {
        error = 'Invalid email format';
      }

      return { rowIndex: i + 2, raw: line, name, email, role, valid, error };
    });
}

export function validateStep(step: number, state: StudioState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (step === 2 && state.mode === 'single') {
    if (!state.single.participant_name.trim()) {
      errors.participant_name = 'Participant name is required';
    }
    if (state.single.email && !EMAIL_REGEX.test(state.single.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!state.single.date_text) {
      errors.date_text = 'Issue date is required';
    }
  }

  if (step === 3) {
    if (!state.authority.name.trim()) {
      errors.authority_name = 'Authority name is required';
    }
    if (!state.authority.position.trim()) {
      errors.authority_position = 'Authority position is required';
    }
  }

  return errors;
}
