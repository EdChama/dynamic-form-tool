import type { FieldErrors, FormField, FormSchema, SubmissionPayload } from '../types/forms';

export function initialPayload(schema: FormSchema): SubmissionPayload {
  return schema.fields.reduce<SubmissionPayload>((payload, field) => {
    payload[field.key] = field.type === 'checkbox' ? false : '';
    return payload;
  }, {});
}

export function validateForm(schema: FormSchema, payload: SubmissionPayload): FieldErrors {
  const errors: FieldErrors = {};

  schema.fields.forEach((field) => {
    const value = payload[field.key];
    const rules = field.validation ?? {};

    if (rules.required && isEmpty(value)) {
      errors[field.key] = [`${field.label} is required`];
      return;
    }

    if (isEmpty(value)) {
      return;
    }

    if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.key] = [`${field.label} must be a valid email address`];
    }

    if (field.type === 'number') {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue)) {
        errors[field.key] = [`${field.label} must be a number`];
      } else if (rules.minimum !== undefined && numberValue < rules.minimum) {
        errors[field.key] = [`${field.label} must be at least ${rules.minimum}`];
      } else if (rules.maximum !== undefined && numberValue > rules.maximum) {
        errors[field.key] = [`${field.label} must be no more than ${rules.maximum}`];
      }
    }

    addStringLengthErrors(field, value, errors);
  });

  return errors;
}

function addStringLengthErrors(field: FormField, value: SubmissionPayload[string], errors: FieldErrors): void {
  if (typeof value !== 'string') {
    return;
  }

  const rules = field.validation ?? {};
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    errors[field.key] = [`${field.label} must be at least ${rules.minLength} characters`];
  }

  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    errors[field.key] = [`${field.label} must be no more than ${rules.maxLength} characters`];
  }
}

function isEmpty(value: SubmissionPayload[string]): boolean {
  return value === null || value === '';
}
