import { describe, expect, it } from 'vitest';
import { initialPayload, validateForm } from '../utils/validation';
import type { FormSchema } from '../types/forms';

const schema: FormSchema = {
  title: 'Example',
  fields: [
    {
      key: 'full_name',
      label: 'Full name',
      type: 'text',
      validation: { required: true, minLength: 2 },
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      validation: { required: true },
    },
  ],
};

describe('form validation helpers', () => {
  it('creates initial payload values from a schema', () => {
    expect(initialPayload(schema)).toEqual({ full_name: '', email: '' });
  });

  it('returns required field errors', () => {
    expect(validateForm(schema, { full_name: '', email: '' })).toEqual({
      full_name: ['Full name is required'],
      email: ['Email is required'],
    });
  });
});
