import { Send, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type { ApiFailure, FieldErrors, PublicForm, SubmissionPayload } from '../../types/forms';
import { initialPayload, validateForm } from '../../utils/validation';
import { FieldRenderer } from './FieldRenderer';

interface DynamicFormProps {
  form: PublicForm;
  onSubmit: (payload: SubmissionPayload) => Promise<{ submission_reference: string }>;
}

export function DynamicForm({ form, onSubmit }: DynamicFormProps) {
  const basePayload = useMemo(() => initialPayload(form.schema), [form]);
  const [payload, setPayload] = useState<SubmissionPayload>(basePayload);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReference, setSuccessReference] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateValue(key: string, value: string | number | boolean) {
    setPayload((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSuccessReference(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessReference(null);

    const clientErrors = validateForm(form.schema, payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit(payload);
      setSuccessReference(result.submission_reference);
      setPayload(basePayload);
      setErrors({});
    } catch (error) {
      const apiError = error as ApiFailure;
      setErrors(apiError.errors ?? {});
      setSubmitError(apiError.message ?? 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <div className="form-panel-header">
        <div>
          <p className="eyebrow">Version {form.version}</p>
          <h2>{form.schema.title}</h2>
          {form.schema.description ? <p>{form.schema.description}</p> : null}
        </div>
        <span className="trust-badge">
          <ShieldCheck aria-hidden="true" size={18} />
          Version locked
        </span>
      </div>

      <div className="fields-grid">
        {form.schema.fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={payload[field.key]}
            errors={errors}
            onChange={updateValue}
          />
        ))}
      </div>

      {submitError ? <div className="submit-error">{submitError}</div> : null}
      {successReference ? (
        <div className="submit-success" role="status">
          Submission saved as {successReference}
        </div>
      ) : null}

      <button className="primary-button" type="submit" disabled={isSubmitting}>
        <Send aria-hidden="true" size={18} />
        {isSubmitting ? 'Submitting...' : form.ui_schema?.submitLabel ?? 'Submit form'}
      </button>
    </form>
  );
}
