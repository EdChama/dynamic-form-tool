import type { FieldErrors, FormField, SubmissionPayload } from '../../types/forms';

interface FieldRendererProps {
  field: FormField;
  value: SubmissionPayload[string];
  errors: FieldErrors;
  onChange: (key: string, value: string | number | boolean) => void;
}

export function FieldRenderer({ field, value, errors, onChange }: FieldRendererProps) {
  const fieldId = `field-${field.key}`;
  const errorId = `${fieldId}-error`;
  const messages = errors[field.key] ?? [];
  const commonProps = {
    id: fieldId,
    name: field.key,
    'aria-invalid': messages.length > 0,
    'aria-describedby': messages.length > 0 ? errorId : undefined,
  };

  return (
    <div className="form-field">
      <label htmlFor={fieldId}>
        {field.label}
        {field.validation?.required ? <span aria-hidden="true"> *</span> : null}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          {...commonProps}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.key, event.target.value)}
          rows={5}
        />
      ) : null}

      {field.type === 'select' ? (
        <select
          {...commonProps}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          <option value="">Select an option</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === 'checkbox' ? (
        <label className="checkbox-row">
          <input
            {...commonProps}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(field.key, event.target.checked)}
          />
          <span>Yes</span>
        </label>
      ) : null}

      {['text', 'email', 'date'].includes(field.type) ? (
        <input
          {...commonProps}
          type={field.type}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : null}

      {field.type === 'number' ? (
        <input
          {...commonProps}
          type="number"
          placeholder={field.placeholder}
          value={String(value ?? '')}
          min={field.validation?.minimum}
          max={field.validation?.maximum}
          onChange={(event) => onChange(field.key, event.target.value === '' ? '' : Number(event.target.value))}
        />
      ) : null}

      {messages.length > 0 ? (
        <div id={errorId} className="field-error" role="alert">
          {messages.join(', ')}
        </div>
      ) : null}
    </div>
  );
}
