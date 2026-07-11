INSERT INTO users (
    id,
    name,
    email,
    password_hash,
    role,
    is_active
)
VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Admin User',
        'admin@example.com',
        '$2y$10$Me5mwjP9a8twCJG0m9SgguhTnPbTmDFb2RMTJ5Pfmq7462I/w5XYe',
        'admin',
        TRUE
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Form Manager',
        'manager@example.com',
        '$2y$10$Me5mwjP9a8twCJG0m9SgguhTnPbTmDFb2RMTJ5Pfmq7462I/w5XYe',
        'form_manager',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    is_active = VALUES(is_active),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO form_templates (
    id,
    slug,
    name,
    description,
    status,
    access_level,
    access_key,
    created_by
)
VALUES
    (
        '11111111-1111-4111-8111-111111111111',
        'beneficial-ownership-declaration',
        'Beneficial Ownership Declaration Form',
        'Collects beneficial ownership and politically exposed person declaration details.',
        'completed',
        'public',
        'beneficial-ownership-public',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'draft-vendor-intake',
        'Draft Vendor Intake Form',
        'Draft example form reserved for schema editing workflows.',
        'draft',
        'private',
        'draft-vendor-private',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
ON DUPLICATE KEY UPDATE
    slug = VALUES(slug),
    name = VALUES(name),
    description = VALUES(description),
    status = VALUES(status),
    access_level = VALUES(access_level),
    access_key = VALUES(access_key),
    created_by = VALUES(created_by),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO form_template_versions (
    id,
    form_template_id,
    version_number,
    schema_json,
    ui_schema_json,
    validation_schema_json,
    version_description,
    checksum,
    is_published,
    published_at
)
VALUES (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    1,
    '
    {
      "title": "Beneficial Ownership Declaration Form",
      "description": "Provide ownership, identity, and relationship details for compliance review.",
      "fields": [
        {
          "key": "full_name",
          "label": "Full name",
          "type": "text",
          "placeholder": "Jane M. Banda",
          "validation": { "required": true, "minLength": 2, "maxLength": 150 }
        },
        {
          "key": "email",
          "label": "Email address",
          "type": "email",
          "placeholder": "jane@example.com",
          "validation": { "required": true, "maxLength": 255 }
        },
        {
          "key": "date_of_birth",
          "label": "Date of birth",
          "type": "date",
          "validation": { "required": true }
        },
        {
          "key": "nationality",
          "label": "Nationality",
          "type": "select",
          "options": [
            { "label": "Zambian", "value": "ZM" },
            { "label": "South African", "value": "ZA" },
            { "label": "Kenyan", "value": "KE" },
            { "label": "Other", "value": "OTHER" }
          ],
          "validation": { "required": true }
        },
        {
          "key": "ownership_percentage",
          "label": "Ownership percentage",
          "type": "number",
          "validation": { "required": true, "minimum": 0, "maximum": 100 }
        },
        {
          "key": "is_politically_exposed",
          "label": "Politically exposed person",
          "type": "checkbox",
          "validation": { "required": false }
        },
        {
          "key": "relationship_to_company",
          "label": "Relationship to company",
          "type": "select",
          "options": [
            { "label": "Shareholder", "value": "shareholder" },
            { "label": "Director", "value": "director" },
            { "label": "Trust beneficiary", "value": "trust_beneficiary" },
            { "label": "Other", "value": "other" }
          ],
          "validation": { "required": true }
        },
        {
          "key": "supporting_notes",
          "label": "Supporting notes",
          "type": "textarea",
          "validation": { "required": false, "maxLength": 1000 }
        }
      ]
    }
    ',
    '
    {
      "layout": "single-column",
      "submitLabel": "Submit declaration"
    }
    ',
    NULL,
    'Initial published beneficial ownership declaration version with identity, ownership, PEP, and relationship fields.',
    'beneficial-ownership-v1-checksum',
    TRUE,
    CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
    schema_json = VALUES(schema_json),
    ui_schema_json = VALUES(ui_schema_json),
    version_description = VALUES(version_description),
    checksum = VALUES(checksum),
    is_published = VALUES(is_published),
    published_at = VALUES(published_at);

INSERT INTO form_fields (
    form_template_version_id,
    field_key,
    label,
    field_type,
    is_required,
    sort_order,
    config_json
)
VALUES
    ('33333333-3333-4333-8333-333333333333', 'full_name', 'Full name', 'text', TRUE, 10, '{"minLength":2,"maxLength":150}'),
    ('33333333-3333-4333-8333-333333333333', 'email', 'Email address', 'email', TRUE, 20, '{"maxLength":255}'),
    ('33333333-3333-4333-8333-333333333333', 'date_of_birth', 'Date of birth', 'date', TRUE, 30, '{}'),
    ('33333333-3333-4333-8333-333333333333', 'nationality', 'Nationality', 'select', TRUE, 40, '{"options":["ZM","ZA","KE","OTHER"]}'),
    ('33333333-3333-4333-8333-333333333333', 'ownership_percentage', 'Ownership percentage', 'number', TRUE, 50, '{"minimum":0,"maximum":100}'),
    ('33333333-3333-4333-8333-333333333333', 'is_politically_exposed', 'Politically exposed person', 'checkbox', FALSE, 60, '{}'),
    ('33333333-3333-4333-8333-333333333333', 'relationship_to_company', 'Relationship to company', 'select', TRUE, 70, '{"options":["shareholder","director","trust_beneficiary","other"]}'),
    ('33333333-3333-4333-8333-333333333333', 'supporting_notes', 'Supporting notes', 'textarea', FALSE, 80, '{"maxLength":1000}')
ON DUPLICATE KEY UPDATE
    label = VALUES(label),
    field_type = VALUES(field_type),
    is_required = VALUES(is_required),
    sort_order = VALUES(sort_order),
    config_json = VALUES(config_json);

INSERT INTO form_submissions (
    id,
    form_template_id,
    form_template_version_id,
    submission_reference,
    payload_json,
    validation_snapshot_json,
    status,
    client_ip,
    user_agent
)
VALUES
    (
        '44444444-4444-4444-8444-444444444444',
        '11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333',
        'SUB-SEED-0001',
        '{"full_name":"Jane Banda","email":"jane.banda@example.com","date_of_birth":"1988-04-12","nationality":"ZM","ownership_percentage":42.5,"is_politically_exposed":false,"relationship_to_company":"shareholder","supporting_notes":"Founding shareholder."}',
        '{"schema_checksum":"beneficial-ownership-v1-checksum","version_number":1}',
        'validated',
        '127.0.0.1',
        'seed-data'
    ),
    (
        '55555555-5555-4555-8555-555555555555',
        '11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333',
        'SUB-SEED-0002',
        '{"full_name":"Michael Phiri","email":"michael.phiri@example.com","date_of_birth":"1979-11-03","nationality":"OTHER","ownership_percentage":18,"is_politically_exposed":true,"relationship_to_company":"director","supporting_notes":"Director appointed by shareholder resolution."}',
        '{"schema_checksum":"beneficial-ownership-v1-checksum","version_number":1}',
        'validated',
        '127.0.0.1',
        'seed-data'
    )
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    new_values,
    metadata,
    client_ip,
    user_agent
)
VALUES
    ('form_template', '11111111-1111-4111-8111-111111111111', 'form.created', '{"slug":"beneficial-ownership-declaration"}', '{"source":"seed"}', '127.0.0.1', 'seed-data'),
    ('form_template_version', '33333333-3333-4333-8333-333333333333', 'form.version.published', '{"version_number":1}', '{"source":"seed"}', '127.0.0.1', 'seed-data')
ON DUPLICATE KEY UPDATE id = id;
