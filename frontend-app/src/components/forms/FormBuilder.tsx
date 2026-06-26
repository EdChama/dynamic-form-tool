import { ArrowDown, ArrowUp, Eye, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { BuilderDefinition, EditableFormSummary, FieldType, FormAccessLevel, FormField, FormLifecycleStatus, FormVersionDetail, FormVersionSummary } from '../../types/forms';

const fieldTypes: FieldType[] = ['text', 'textarea', 'number', 'select', 'checkbox', 'date', 'email'];
const lifecycleStatuses: FormLifecycleStatus[] = ['draft', 'completed', 'archived', 'expired'];
const accessLevels: FormAccessLevel[] = ['public', 'private', 'restricted'];

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
  status: 'draft',
  accessLevel: 'public',
  accessKey: '',
  title: 'New dynamic form',
  description: '',
  versionDescription: 'Initial draft version',
  submitLabel: 'Submit form',
  fields: [blankField()],
  actions: [{ type: 'store_submission', label: 'Store submission' }],
};

interface FormBuilderProps {
  forms: EditableFormSummary[];
  onSave: (definition: BuilderDefinition, formId?: string) => Promise<void>;
  onPublish: (formId: string) => Promise<void>;
  onDelete: (formId: string) => Promise<void>;
  onLoadVersions: (formId: string) => Promise<FormVersionSummary[]>;
  onLoadVersion: (formId: string, versionId: string) => Promise<FormVersionDetail>;
  onRefresh: () => Promise<void>;
  onSelectedFormChange?: (formId: string) => void;
}

export function FormBuilder({ forms, onSave, onPublish, onDelete, onLoadVersions, onLoadVersion, onRefresh, onSelectedFormChange }: FormBuilderProps) {
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [definition, setDefinition] = useState<BuilderDefinition>(initialDefinition);
  const [versions, setVersions] = useState<FormVersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<FormVersionDetail | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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

  function moveField(index: number, direction: -1 | 1) {
    setDefinition((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.fields.length) {
        return current;
      }

      const fields = [...current.fields];
      [fields[index], fields[targetIndex]] = [fields[targetIndex], fields[index]];

      return { ...current, fields };
    });
  }

  async function save() {
    setStatus('Saving draft...');
    await onSave(definition, selectedFormId || undefined);
    setStatus('Draft saved');
    await onRefresh();
    if (selectedFormId) {
      setVersions(await onLoadVersions(selectedFormId));
    }
  }

  async function publish() {
    if (!selectedFormId) {
      setStatus('Save the form before publishing');
      return;
    }
    setStatus('Publishing...');
    await onPublish(selectedFormId);
    setDefinition((current) => ({ ...current, status: 'completed' }));
    setStatus('Published');
    await onRefresh();
    setVersions(await onLoadVersions(selectedFormId));
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
    setVersions([]);
    setSelectedVersion(null);
    setDefinition(initialDefinition);
    setStatus('Form deleted');
    await onRefresh();
  }

  async function selectForm(form: EditableFormSummary) {
    setSelectedFormId(form.id);
    onSelectedFormChange?.(form.id);
    setSelectedVersion(null);
    setDefinition({
      ...initialDefinition,
      name: form.name,
      status: form.status,
      accessLevel: form.access_level,
      accessKey: form.access_key,
      title: form.name,
      description: form.description ?? '',
      versionDescription: '',
    });

    const loadedVersions = await onLoadVersions(form.id);
    setVersions(loadedVersions);

    if (loadedVersions[0]) {
      await selectVersion(form.id, loadedVersions[0].id);
    }
  }

  async function selectVersion(formId: string, versionId: string) {
    const version = await onLoadVersion(formId, versionId);
    setSelectedVersion(version);
    setDefinition({
      ...version.definition,
      versionDescription: version.definition.versionDescription ?? `Copy of version ${version.version_number}`,
    });
    setStatus(`Loaded version ${version.version_number} as an editable copy`);
  }

  return (
    <section className="builder-layout">
      <div className="builder-list">
        <h2>Designed forms</h2>
        <button className="secondary-button" type="button" onClick={() => { setSelectedFormId(''); onSelectedFormChange?.(''); setVersions([]); setSelectedVersion(null); setDefinition(initialDefinition); }}>
          <Plus size={16} /> New form
        </button>
        {forms.map((form) => (
          <button
            key={form.id}
            className={selectedFormId === form.id ? 'form-list-item light active' : 'form-list-item light'}
            type="button"
            onClick={() => void selectForm(form)}
          >
            <strong>{form.name}</strong>
            <span>{form.status} - {form.access_level} - v{form.latest_version}</span>
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
            <button className="secondary-button" type="button" onClick={() => setIsPreviewOpen(true)}><Eye size={16} /> Preview</button>
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
            Status
            <select value={definition.status ?? 'draft'} onChange={(event) => setDefinition({ ...definition, status: event.target.value as FormLifecycleStatus })}>
              {lifecycleStatuses.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
            </select>
          </label>
          <label>
            Access
            <select value={definition.accessLevel ?? 'public'} onChange={(event) => setDefinition({ ...definition, accessLevel: event.target.value as FormAccessLevel })}>
              {accessLevels.map((accessLevel) => <option key={accessLevel} value={accessLevel}>{formatAccessLabel(accessLevel)}</option>)}
            </select>
          </label>
          <label>
            Submit label
            <input value={definition.submitLabel ?? ''} onChange={(event) => setDefinition({ ...definition, submitLabel: event.target.value })} />
          </label>
          {definition.accessLevel === 'restricted' ? (
            <label>
              Restricted link key
              <input value={definition.accessKey ?? ''} placeholder="generated when empty" onChange={(event) => setDefinition({ ...definition, accessKey: event.target.value })} />
            </label>
          ) : null}
          {definition.accessLevel === 'restricted' && definition.slug && definition.accessKey ? (
            <div className="restricted-link wide">
              <strong>Shareable restricted link</strong>
              <code>{`${window.location.origin}/?form=${definition.slug}&access_key=${definition.accessKey}`}</code>
            </div>
          ) : null}
          <label className="wide">
            Description
            <textarea value={definition.description ?? ''} onChange={(event) => setDefinition({ ...definition, description: event.target.value })} />
          </label>
          <label className="wide">
            Version description
            <textarea
              value={definition.versionDescription ?? ''}
              placeholder="Describe what changed or what this version is for"
              onChange={(event) => setDefinition({ ...definition, versionDescription: event.target.value })}
            />
          </label>
        </div>

        {selectedFormId ? (
          <div className="version-panel">
            <div className="version-panel-header">
              <div>
                <p className="eyebrow">Version tracking</p>
                <h3>Saved copies</h3>
              </div>
              <Eye size={18} aria-hidden="true" />
            </div>
            <label>
              Select version to preview or copy into editor
              <select
                value={selectedVersion?.id ?? ''}
                onChange={(event) => void selectVersion(selectedFormId, event.target.value)}
              >
                <option value="" disabled>Select a version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version_number}{version.is_published ? ' published' : ' draft'} - {version.version_description || 'No description'}
                  </option>
                ))}
              </select>
            </label>
            {selectedVersion ? (
              <div className="version-preview">
                <strong>Previewing version {selectedVersion.version_number}</strong>
                <p>{selectedVersion.version_description || 'No version description provided.'}</p>
                <div className="preview-fields">
                  {selectedVersion.schema.fields.map((field, index) => (
                    <div className="preview-field" key={`${selectedVersion.id}-${field.key}`}>
                      <span className="preview-order">{index + 1}</span>
                      <div>
                        <strong>{field.label}</strong>
                        <p>{field.key} - {field.type}</p>
                        <small>{formatValidation(field)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="field-builder-list">
          {definition.fields.map((field, index) => (
            <div className="field-builder" key={`${field.key}-${index}`}>
              <div className="field-builder-top">
                <strong>Field {index + 1}</strong>
                <div className="field-actions">
                  <button className="icon-button light" type="button" aria-label="Move field up" disabled={index === 0} onClick={() => moveField(index, -1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-button light" type="button" aria-label="Move field down" disabled={index === definition.fields.length - 1} onClick={() => moveField(index, 1)}>
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label="Remove field"
                    onClick={() => setDefinition((current) => ({ ...current, fields: current.fields.filter((_, itemIndex) => itemIndex !== index) }))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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

      {isPreviewOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Form preview">
          <div className="preview-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>{definition.title || definition.name}</h2>
                {definition.description ? <p>{definition.description}</p> : null}
              </div>
              <button className="icon-button light" type="button" onClick={() => setIsPreviewOpen(false)} aria-label="Close preview">
                <X size={18} />
              </button>
            </div>
            <div className="fields-grid">
              {definition.fields.map((field) => (
                <div className="form-field" key={`preview-${field.key}`}>
                  <label>{field.label}{field.validation?.required ? ' *' : ''}</label>
                  {renderPreviewField(field)}
                  <small>{formatValidation(field)}</small>
                </div>
              ))}
            </div>
            <button className="primary-button" type="button" disabled>{definition.submitLabel || 'Submit form'}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function renderPreviewField(field: FormField) {
  if (field.type === 'textarea') {
    return <textarea placeholder={field.placeholder} disabled />;
  }

  if (field.type === 'select') {
    return (
      <select disabled defaultValue="">
        <option value="">Select an option</option>
        {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    return <input type="checkbox" disabled />;
  }

  return <input type={field.type} placeholder={field.placeholder} disabled />;
}

function formatValidation(field: FormField): string {
  const validation = field.validation ?? {};
  const rules = Object.entries(validation)
    .filter(([, value]) => value !== undefined && value !== false && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`);

  if (field.type === 'select' && field.options?.length) {
    rules.push(`options: ${field.options.map((option) => option.value).join(', ')}`);
  }

  return rules.length > 0 ? rules.join(' | ') : 'No validation rules set';
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAccessLabel(accessLevel: FormAccessLevel): string {
  if (accessLevel === 'restricted') {
    return 'Restricted link';
  }

  return formatLabel(accessLevel);
}
