-- Must mirror packages/permissions (a test asserts this; seed re-syncs it).
INSERT INTO permissions (code, label, grp) VALUES
 ('org.manage','Manage organisation profile','Organisation'),
 ('unit.manage','Manage units','Organisation'),
 ('member.invite','Invite members','People'),
 ('member.manage','Manage members and unit roles','People'),
 ('role.manage','Manage roles','People'),
 ('record.read','View records','Records'),
 ('record.create','Create records','Records'),
 ('record.update','Edit records','Records'),
 ('record.delete','Delete records','Records'),
 ('audit.read','View audit log','Other'),
 ('billing.read','View billing','Billing'),
 ('billing.manage','Manage billing','Billing'),
 ('chat.use','Use chat','Other'),
 ('settings.manage','Manage settings','Other'),
 ('files.manage','Manage files','Other');

INSERT INTO default_role_permissions (role_name, permission_code)
SELECT 'owner', code FROM permissions
UNION ALL SELECT 'admin', code FROM permissions WHERE code NOT IN ('org.manage','billing.manage')
UNION ALL SELECT 'manager', unnest(ARRAY['record.read','record.create','record.update','record.delete','chat.use','files.manage'])
UNION ALL SELECT 'member', unnest(ARRAY['record.read','record.create','record.update','chat.use'])
UNION ALL SELECT 'viewer', unnest(ARRAY['record.read','chat.use']);
