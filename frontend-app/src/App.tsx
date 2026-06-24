import { FileText, Lock, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from './api/client';
import { DynamicForm } from './components/forms/DynamicForm';
import { FormBuilder } from './components/forms/FormBuilder';
import type { AuthUser, BuilderDefinition, EditableFormSummary, FormSummary, PublicForm, SubmissionPayload } from './types/forms';

export function App() {
  const [mode, setMode] = useState<'submit' | 'builder'>('submit');
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [editableForms, setEditableForms] = useState<EditableFormSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [selectedForm, setSelectedForm] = useState<PublicForm | null>(null);
  const [token, setToken] = useState(() => localStorage.getItem('dynamic-form-token') ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadForms();
  }, []);

  useEffect(() => {
    if (token) {
      void restoreSession(token);
    }
  }, [token]);

  useEffect(() => {
    if (selectedSlug) {
      void loadForm(selectedSlug);
    }
  }, [selectedSlug]);

  async function loadForms() {
    setIsLoadingForms(true);
    setError(null);

    try {
      const data = await apiClient.listForms();
      setForms(data);
      setSelectedSlug((current) => current || data[0]?.slug || '');
    } catch {
      setError('Unable to load forms. Check that the backend and database containers are running.');
    } finally {
      setIsLoadingForms(false);
    }
  }

  async function restoreSession(activeToken: string) {
    try {
      setUser(await apiClient.me(activeToken));
      await loadEditableForms(activeToken);
    } catch {
      localStorage.removeItem('dynamic-form-token');
      setToken('');
      setUser(null);
    }
  }

  async function login() {
    setError(null);
    try {
      const session = await apiClient.login(email, password);
      localStorage.setItem('dynamic-form-token', session.token);
      setToken(session.token);
      setUser(session.user);
      await loadEditableForms(session.token);
    } catch {
      setError('Login failed. Use the seeded admin or manager credentials.');
    }
  }

  async function loadEditableForms(activeToken = token) {
    if (!activeToken) {
      return;
    }
    setEditableForms(await apiClient.listEditableForms(activeToken));
  }

  async function loadForm(slug: string) {
    setIsLoadingForm(true);
    setError(null);

    try {
      setSelectedForm(await apiClient.getForm(slug));
    } catch {
      setError('Unable to load the selected form.');
    } finally {
      setIsLoadingForm(false);
    }
  }

  async function submitSelectedForm(payload: SubmissionPayload) {
    if (!selectedForm) {
      throw new Error('No form selected');
    }

    return apiClient.submitForm(selectedForm.slug, payload);
  }

  async function saveBuilderForm(definition: BuilderDefinition, formId?: string) {
    if (!token) {
      throw new Error('Login required');
    }
    if (formId) {
      await apiClient.updateForm(token, formId, definition);
    } else {
      await apiClient.createForm(token, definition);
    }
    await loadForms();
  }

  async function publishBuilderForm(formId: string) {
    if (!token) {
      throw new Error('Login required');
    }
    await apiClient.publishForm(token, formId);
    await loadForms();
  }

  async function deleteBuilderForm(formId: string) {
    if (!token) {
      throw new Error('Login required');
    }
    await apiClient.deleteForm(token, formId);
    await loadForms();
  }

  async function loadBuilderVersions(formId: string) {
    if (!token) {
      throw new Error('Login required');
    }

    return apiClient.listFormVersions(token, formId);
  }

  async function loadBuilderVersion(formId: string, versionId: string) {
    if (!token) {
      throw new Error('Login required');
    }

    return apiClient.getFormVersion(token, formId, versionId);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Available forms">
        <div className="brand">
          <FileText aria-hidden="true" size={24} />
          <div>
            <h1>Dynamic Forms</h1>
            <p>Schema-driven submissions</p>
          </div>
        </div>

        <button className="icon-button" type="button" onClick={loadForms} aria-label="Refresh forms">
          <RefreshCcw aria-hidden="true" size={18} />
        </button>

        <div className="mode-switch">
          <button className={mode === 'submit' ? 'active' : ''} type="button" onClick={() => setMode('submit')}>
            Submit
          </button>
          <button className={mode === 'builder' ? 'active' : ''} type="button" onClick={() => setMode('builder')}>
            Builder
          </button>
        </div>

        {mode === 'submit' ? <div className="form-list">
          {isLoadingForms ? <div className="muted">Loading forms...</div> : null}
          {!isLoadingForms && forms.length === 0 ? <div className="muted">No active forms found.</div> : null}
          {forms.map((form) => (
            <button
              key={form.slug}
              className={form.slug === selectedSlug ? 'form-list-item active' : 'form-list-item'}
              type="button"
              onClick={() => setSelectedSlug(form.slug)}
            >
              <strong>{form.name}</strong>
              <span>Version {form.version_number}</span>
            </button>
          ))}
        </div> : null}
      </aside>

      <section className="content">
        {error ? <div className="page-error">{error}</div> : null}
        {mode === 'submit' ? (
          <>
            {isLoadingForm ? <div className="loading-panel">Loading selected form...</div> : null}
            {!isLoadingForm && selectedForm ? (
              <DynamicForm form={selectedForm} onSubmit={submitSelectedForm} />
            ) : null}
          </>
        ) : null}

        {mode === 'builder' && !user ? (
          <div className="login-panel">
            <Lock size={22} />
            <h2>Admin login</h2>
            <p>Seeded development credentials are prefilled.</p>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button className="primary-button" type="button" onClick={login}>Login</button>
          </div>
        ) : null}

        {mode === 'builder' && user ? (
          <>
            <div className="user-strip">
              Signed in as <strong>{user.name}</strong> · {user.role}
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  localStorage.removeItem('dynamic-form-token');
                  setToken('');
                  setUser(null);
                }}
              >
                Logout
              </button>
            </div>
            <FormBuilder
              forms={editableForms}
              onSave={saveBuilderForm}
              onPublish={publishBuilderForm}
              onDelete={deleteBuilderForm}
              onLoadVersions={loadBuilderVersions}
              onLoadVersion={loadBuilderVersion}
              onRefresh={() => loadEditableForms()}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}
