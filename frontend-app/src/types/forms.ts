export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'email';

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: SelectOption[];
  validation?: FieldValidation;
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
  actions?: FormAction[];
}

export interface FormAction {
  type: 'store_submission' | 'show_success_message';
  label: string;
}

export interface PublicForm {
  id: string;
  slug: string;
  name: string;
  description?: string;
  version: number;
  version_id: string;
  schema: FormSchema;
  ui_schema?: {
    layout?: string;
    submitLabel?: string;
  } | null;
}

export interface FormSummary {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: string;
  form_template_version_id: string;
  version_number: number;
  published_at: string;
}

export type SubmissionPayload = Record<string, string | number | boolean | null>;

export type FieldErrors = Record<string, string[]>;

export interface ApiSuccess<T> {
  status: 'success';
  message: string;
  data: T;
}

export interface ApiFailure {
  status: 'error';
  message: string;
  errors?: FieldErrors;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'form_manager' | 'viewer';
}

export interface AuthSession {
  token: string;
  expires_in_seconds: number;
  user: AuthUser;
}

export interface EditableFormSummary {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  created_by: string;
  latest_version: number;
}

export interface BuilderDefinition {
  name: string;
  slug?: string;
  title: string;
  description?: string;
  versionDescription?: string;
  submitLabel?: string;
  fields: FormField[];
  actions: FormAction[];
}

export interface FormVersionSummary {
  id: string;
  form_template_id: string;
  version_number: number;
  version_description?: string | null;
  checksum: string;
  is_published: boolean;
  published_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface FormVersionDetail extends FormVersionSummary {
  schema: FormSchema;
  ui_schema?: {
    layout?: string;
    submitLabel?: string;
  } | null;
  definition: BuilderDefinition;
}
