import { Plus, Save, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { BuilderDefinition, EditableFormSummary, FieldType, FormField } from '../../types/forms';

const fieldTypes: FieldType[] = ['text', 'textarea', 'number', 'select', 'checkbox', 'date', 'email'];

const blankField = (): FormField => ({
  key: `field_${Date.now()}`,
  label: 'New field',
  type: 'text',
  placeholder: '',
  options: [],
  validation: { required: false },
});

const initialDefinition: BuilderDefinition = {
  name: 'New dynamic form',
  title: 'New dynamic form',
  description: '',
  submitLabel: 'Submit form',
  fields: [blankField()],
  actions: [{ type: 'store_submission', label: 'Store submission' }],
};

interface FormBuilderProps {
  forms: EditableFormSummary[];
  onSave: (definition: BuilderDefinition, formId?: string) => Promise<void>;
  onPublish: (formId: string) => Promise<void>;
  onDelete: (formId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function FormBuilder({ forms, onSave, onPublish, onDelete, onRefresh }: FormBuilderProps) {
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [definition, setDefinition] = useState<BuilderDefinition>(initialDefinition);
  const [status, setStatus] = useState<string | null>(null);

  function updateField(index: number, patch: Partial<FormField>) {
    setDefinition((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    }));
  }

  function updateValidation(index: number, key: string, value: string | number | boolean) {
    const field = definition.fields[index];
    updateField(index, {
      validation: {
        ...(field.validation ?? {}),
        [key]: value,
      },
    });
  }

  function updateOptions(index: number, rawValue: string) {
    const options = rawValue
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, value] = line.includes(':') ? line.split(':') : [line, line];
        return { label: label.trim(), value: value.trim() };
      });
    updateField(index, { options });
  }

  async function save() {
    setStatus('Saving draft...');
    await onSave(definition, selectedFormId || undefined);
    setStatus('Draft saved');
    await onRefresh();
  }

  async function publish() {
    if (!selectedFormId) {
      setStatus('Save the form before publishing');
      return;
    }
    setStatus('Publishing...');
    await onPublish(selectedFormId);
    setStatus('Published');
    await onRefresh();
  }

  async function deleteSelectedForm() {
    if (!selectedFormId) {
      setStatus('Select a saved form before deleting');
      return;
    }

    const selected = forms.find((form) => form.id === selectedFormId);
    const confirmed = window.confirm(`Delete "${selected?.name ?? 'this form'}"? Existing submissions remain archived for audit history.`);
    if (!confirmed) {
      return;
    }

    setStatus('Deleting...');
    await onDelete(selectedFormId);
    setSelectedFormId('');
    setDefinition(initialDefinition);
    setStatus('Form deleted');
    await onRefresh();
  }

  return (
    <section className="builder-layout">
      <div className="builder-list">
        <h2>Designed forms</h2>
        <button className="secondary-button" type="button" onClick={() => { setSelectedFormId(''); setDefinition(initialDefinition); }}>
          <Plus size={16} /> New form
        </button>
        {forms.map((form) => (
          <button
            key={form.id}
            className={selectedFormId === form.id ? 'form-list-item light active' : 'form-list-item light'}
            type="button"
            onClick={() => {
              setSelectedFormId(form.id);
              setDefinition({
                ...initialDefinition,
                name: form.name,
                title: form.name,
                description: form.description ?? '',
              });
            }}
          >
            <strong>{form.name}</strong>
            <span>{form.status} · v{form.latest_version}</span>
          </button>
        ))}
      </div>

      <div className="builder-panel">
        <div className="builder-header">
          <div>
            <p className="eyebrow">Form designer</p>
            <h2>Build fields, labels, validation, and actions</h2>
          </div>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={save}><Save size={16} /> Save draft</button>
            <button className="primary-button compact" type="button" onClick={publish}><Send size={16} /> Publish</button>
            <button className="secondary-button danger" type="button" onClick={deleteSelectedForm}><Trash2 size={16} /> Delete</button>
          </div>
        </div>

        <div className="builder-grid">
          <label>
            Form name
            <input value={definition.name} onChange={(event) => setDefinition({ ...definition, name: event.target.value, title: event.target.value })} />
          </label>
          <label>
            Slug
            <input value={definition.slug ?? ''} placeholder="auto-generated when empty" onChange={(event) => setDefinition({ ...definition, slug: event.target.value })} />
          </label>
          <label>
            Header title
            <input value={definition.title} onChange={(event) => setDefinition({ ...definition, title: event.target.value })} />
          </label>
          <label>
            Submit label
            <input value={definition.submitLabel ?? ''} onChange={(event) => setDefinition({ ...definition, submitLabel: event.target.value })} />
          </label>
          <label className="wide">
            Description
            <textarea value={definition.description ?? ''} onChange={(event) => setDefinition({ ...definition, description: event.target.value })} />
          </label>
        </div>

        <div className="field-builder-list">
          {definition.fields.map((field, index) => (
            <div className="field-builder" key={`${field.key}-${index}`}>
              <div className="field-builder-top">
                <strong>Field {index + 1}</strong>
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="Remove field"
                  onClick={() => setDefinition((current) => ({ ...current, fields: current.fields.filter((_, itemIndex) => itemIndex !== index) }))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="builder-grid">
                <label>
                  Key
                  <input value={field.key} onChange={(event) => updateField(index, { key: event.target.value })} />
                </label>
                <label>
                  Label
                  <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
                </label>
                <label>
                  Type
                  <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as FieldType })}>
                    {fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  Placeholder
                  <input value={field.placeholder ?? ''} onChange={(event) => updateField(index, { placeholder: event.target.value })} />
                </label>
                <label>
                  Min length
                  <input type="number" value={field.validation?.minLength ?? ''} onChange={(event) => updateValidation(index, 'minLength', Number(event.target.value))} />
                </label>
                <label>
                  Max length
                  <input type="number" value={field.validation?.maxLength ?? ''} onChange={(event) => updateValidation(index, 'maxLength', Number(event.target.value))} />
                </label>
                <label>
                  Minimum
                  <input type="number" value={field.validation?.minimum ?? ''} onChange={(event) => updateValidation(index, 'minimum', Number(event.target.value))} />
                </label>
                <label>
                  Maximum
                  <input type="number" value={field.validation?.maximum ?? ''} onChange={(event) => updateValidation(index, 'maximum', Number(event.target.value))} />
                </label>
                <label className="checkbox-line">
                  <input type="checkbox" checked={field.validation?.required ?? false} onChange={(event) => updateValidation(index, 'required', event.target.checked)} />
                  Required
                </label>
                {field.type === 'select' ? (
                  <label className="wide">
                    Options, one per line as Label:value
                    <textarea
                      value={(field.options ?? []).map((option) => `${option.label}:${option.value}`).join('\n')}
                      onChange={(event) => updateOptions(index, event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <button className="secondary-button" type="button" onClick={() => setDefinition((current) => ({ ...current, fields: [...current.fields, blankField()] }))}>
          <Plus size={16} /> Add field
        </button>
        {status ? <div className="submit-success" role="status">{status}</div> : null}
      </div>
    </section>
  );
}
