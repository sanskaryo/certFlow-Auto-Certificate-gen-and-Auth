export type Mode = 'single' | 'bulk' | 'csv';

export type LogoPos = { x: number; y: number; size: number };

/** Normalized layout: x,y are fractions 0–1; y is distance from top (0 = top edge, 1 = bottom). */
export interface CertificateLayout {
  signature: { x: number; y: number; w: number; h: number };
  authorityName: { x: number; y: number; scale: number };
  designation: { x: number; y: number; scale: number };
  recipientName: { x: number; y: number; scale: number };
  bodyBlock: { x: number; y: number; scale: number };
  qr: { x: number; y: number; size: number };
}

export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayout = {
  signature: { x: 0.66, y: 0.66, w: 0.24, h: 0.12 },
  authorityName: { x: 0.78, y: 0.8, scale: 1 },
  designation: { x: 0.78, y: 0.87, scale: 0.95 },
  recipientName: { x: 0.5, y: 0.4, scale: 1 },
  bodyBlock: { x: 0.5, y: 0.52, scale: 1 },
  qr: { x: 0.82, y: 0.7, size: 0.12 },
};

export function mergeCertificateLayout(
  partial?: Partial<CertificateLayout> | Record<string, unknown> | null,
  base: CertificateLayout = DEFAULT_CERTIFICATE_LAYOUT
): CertificateLayout {
  const p = partial as Partial<CertificateLayout> | null | undefined;
  return {
    signature: { ...base.signature, ...p?.signature },
    authorityName: { ...base.authorityName, ...p?.authorityName },
    designation: { ...base.designation, ...p?.designation },
    recipientName: { ...base.recipientName, ...p?.recipientName },
    bodyBlock: { ...base.bodyBlock, ...p?.bodyBlock },
    qr: { ...base.qr, ...p?.qr },
  };
}

export interface SingleFields {
  participant_name: string;
  email: string;
  role: string;
  organization: string;
  date_text: string;
}

export interface ParsedLine {
  raw: string;
  name: string;
  email: string;
  role: string;
  valid: boolean;
  error: string | null;
}

export interface CsvRow extends ParsedLine {
  rowIndex: number;
}

export interface BulkFields {
  rawText: string;
  parsedLines: ParsedLine[];
}

export interface CsvFields {
  file: File | null;
  parsedRows: CsvRow[];
}

export interface BrandingFields {
  templateId: string;
  aiPrompt: string;
  logoFile: File | null;
  logoPreviewUrl: string | null;
  logoPos: LogoPos;
}

export interface AuthorityFields {
  name: string;
  position: string;
  sigFile: File | null;
  sigPreviewUrl: string | null;
}

export interface ValidationErrors {
  participant_name?: string;
  email?: string;
  date_text?: string;
  authority_name?: string;
  authority_position?: string;
}

export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

export interface GenerationResult {
  certificateId: string | null;
  verificationLink: string | null;
  previewLink: string | null;
  successCount: number;
  failedCount: number;
  totalCount: number;
}

export interface StudioState {
  step: number;
  mode: Mode;
  single: SingleFields;
  bulk: BulkFields;
  csv: CsvFields;
  branding: BrandingFields;
  authority: AuthorityFields;
  certificateLayout: CertificateLayout;
  errors: ValidationErrors;
  generationStatus: GenerationStatus;
  result: GenerationResult;
}

export type StudioAction =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_STEP'; step: number }
  | { type: 'ADVANCE_STEP' }
  | { type: 'UPDATE_SINGLE'; field: keyof SingleFields; value: string }
  | { type: 'UPDATE_BULK_TEXT'; text: string }
  | { type: 'SET_CSV_FILE'; file: File | null; rows: CsvRow[] }
  | { type: 'UPDATE_BRANDING'; patch: Partial<BrandingFields> }
  | { type: 'UPDATE_AUTHORITY'; patch: Partial<AuthorityFields> }
  | { type: 'UPDATE_CERTIFICATE_LAYOUT'; patch: Partial<CertificateLayout> }
  | { type: 'SET_ERRORS'; errors: ValidationErrors }
  | { type: 'SET_GENERATION_STATUS'; status: GenerationStatus }
  | { type: 'SET_RESULT'; result: Partial<GenerationResult> }
  | { type: 'RESET' };

export interface PreviewData {
  name: string;
  role: string;
  eventName: string;
  organization: string;
  date: string;
  authorityName: string;
  authorityPosition: string;
  logoUrl: string | null;
  logoPos: LogoPos;
  signatureUrl: string | null;
  templateId: string;
  certificateLayout: CertificateLayout;
}

export interface ChecklistItem {
  label: string;
  filled: boolean;
}

export const initialState: StudioState = {
  step: 0,
  mode: 'single',
  single: {
    participant_name: '',
    email: '',
    role: '',
    organization: '',
    date_text: '',
  },
  bulk: {
    rawText: '',
    parsedLines: [],
  },
  csv: {
    file: null,
    parsedRows: [],
  },
  branding: {
    templateId: '',
    aiPrompt: '',
    logoFile: null,
    logoPreviewUrl: null,
    logoPos: { x: 0.03, y: 0.82, size: 0.18 },
  },
  authority: {
    name: '',
    position: '',
    sigFile: null,
    sigPreviewUrl: null,
  },
  certificateLayout: DEFAULT_CERTIFICATE_LAYOUT,
  errors: {},
  generationStatus: 'idle',
  result: {
    certificateId: null,
    verificationLink: null,
    previewLink: null,
    successCount: 0,
    failedCount: 0,
    totalCount: 0,
  },
};
