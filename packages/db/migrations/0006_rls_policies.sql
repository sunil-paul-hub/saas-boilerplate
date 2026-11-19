-- ENABLE + FORCE RLS everywhere (the table owner is subject to policies too).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','platform_admins','organisations','units','memberships','permissions',
    'default_role_permissions','roles','role_permissions','unit_role_assignments','onboarding_requests',
    'invitations','plans','subscriptions','invoices','audit_events','notifications','conversations',
    'conversation_members','messages','files','org_settings','records']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ===== users =====
CREATE POLICY users_select ON users FOR SELECT TO app_user
  USING (id = app_private.current_user_id() OR app_private.user_in_current_org(id));
CREATE POLICY users_update_self ON users FOR UPDATE TO app_user
  USING (id = app_private.current_user_id()) WITH CHECK (id = app_private.current_user_id());
CREATE POLICY users_platform ON users FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== platform_admins / onboarding_requests / default_role_permissions: platform only =====
CREATE POLICY pa_platform_select ON platform_admins FOR SELECT TO app_platform USING (app_private.is_platform_admin());
CREATE POLICY onboarding_platform ON onboarding_requests FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());
CREATE POLICY drp_platform ON default_role_permissions FOR SELECT TO app_platform USING (app_private.is_platform_admin());

-- ===== permissions / plans: read-only catalogues =====
CREATE POLICY permissions_read ON permissions FOR SELECT TO app_user, app_platform USING (true);
CREATE POLICY plans_read ON plans FOR SELECT TO app_user USING (is_active);
CREATE POLICY plans_platform ON plans FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== organisations =====
CREATE POLICY org_select ON organisations FOR SELECT TO app_user USING (app_private.is_member_of(id));
CREATE POLICY org_update ON organisations FOR UPDATE TO app_user
  USING (id = app_private.current_org_id() AND app_private.has_org_permission('org.manage'))
  WITH CHECK (id = app_private.current_org_id() AND app_private.has_org_permission('org.manage'));
CREATE POLICY org_platform ON organisations FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== units =====
CREATE POLICY units_select ON units FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.can_see_unit(id));
CREATE POLICY units_insert ON units FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('unit.manage'));
CREATE POLICY units_update ON units FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_permission(id, 'unit.manage'))
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_permission(id, 'unit.manage'));
CREATE POLICY units_delete ON units FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_permission(id, 'unit.manage'));
CREATE POLICY units_platform ON units FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== memberships =====
CREATE POLICY memberships_select ON memberships FOR SELECT TO app_user
  USING ((org_id = app_private.current_org_id() AND app_private.is_org_member())
         OR user_id = app_private.current_user_id());
CREATE POLICY memberships_insert ON memberships FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.manage'));
CREATE POLICY memberships_update ON memberships FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.manage'))
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.manage'));
CREATE POLICY memberships_delete ON memberships FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.manage'));
CREATE POLICY memberships_platform ON memberships FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== roles / role_permissions =====
CREATE POLICY roles_select ON roles FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_org_member());
CREATE POLICY roles_insert ON roles FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND NOT is_system AND app_private.has_org_permission('role.manage'));
CREATE POLICY roles_update ON roles FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND NOT is_system AND app_private.has_org_permission('role.manage'))
  WITH CHECK (org_id = app_private.current_org_id() AND NOT is_system AND app_private.has_org_permission('role.manage'));
CREATE POLICY roles_delete ON roles FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND NOT is_system AND app_private.has_org_permission('role.manage'));
CREATE POLICY roles_platform ON roles FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

CREATE POLICY rp_select ON role_permissions FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_org_member());
CREATE POLICY rp_insert ON role_permissions FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND NOT app_private.role_is_system(role_id)
              AND app_private.has_org_permission('role.manage'));
CREATE POLICY rp_delete ON role_permissions FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND NOT app_private.role_is_system(role_id)
         AND app_private.has_org_permission('role.manage'));
CREATE POLICY rp_platform ON role_permissions FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== unit_role_assignments =====
CREATE POLICY ura_select ON unit_role_assignments FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_org_member()
         AND (user_id = app_private.current_user_id() OR app_private.has_org_permission('member.manage')));
CREATE POLICY ura_insert ON unit_role_assignments FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.manage'));
CREATE POLICY ura_delete ON unit_role_assignments FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.manage'));
CREATE POLICY ura_platform ON unit_role_assignments FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== invitations (token_hash is not selectable by app_user) =====
CREATE POLICY inv_select ON invitations FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.invite'));
CREATE POLICY inv_insert ON invitations FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND invited_by = app_private.current_user_id()
              AND app_private.has_org_permission('member.invite'));
CREATE POLICY inv_delete ON invitations FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('member.invite'));
CREATE POLICY inv_platform ON invitations FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== billing (read-only for tenants; the operator writes) =====
CREATE POLICY subs_select ON subscriptions FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('billing.read'));
CREATE POLICY subs_platform ON subscriptions FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());
CREATE POLICY inv_select_billing ON invoices FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('billing.read'));
CREATE POLICY invoices_platform ON invoices FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== audit_events: INSERT + SELECT only =====
CREATE POLICY audit_select ON audit_events FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('audit.read'));
CREATE POLICY audit_insert ON audit_events FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.is_org_member()
              AND actor_id = app_private.current_user_id());
CREATE POLICY audit_platform_select ON audit_events FOR SELECT TO app_platform USING (app_private.is_platform_admin());
CREATE POLICY audit_platform_insert ON audit_events FOR INSERT TO app_platform
  WITH CHECK (app_private.is_platform_admin() AND actor_id = app_private.current_user_id());

-- ===== notifications (own, in current org) =====
CREATE POLICY notif_select ON notifications FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND user_id = app_private.current_user_id());
CREATE POLICY notif_insert ON notifications FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.is_org_member());
CREATE POLICY notif_update ON notifications FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND user_id = app_private.current_user_id())
  WITH CHECK (org_id = app_private.current_org_id() AND user_id = app_private.current_user_id());
CREATE POLICY notif_delete ON notifications FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND user_id = app_private.current_user_id());

-- ===== chat =====
CREATE POLICY conv_select ON conversations FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id()
         AND (app_private.is_conversation_member(id) OR created_by = app_private.current_user_id()));
CREATE POLICY conv_insert ON conversations FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND created_by = app_private.current_user_id()
              AND app_private.has_org_permission('chat.use'));
CREATE POLICY cm_select ON conversation_members FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_conversation_member(conversation_id));
CREATE POLICY cm_insert ON conversation_members FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('chat.use')
              AND (app_private.is_conversation_member(conversation_id)
                   OR app_private.conversation_created_by_me(conversation_id)));
CREATE POLICY cm_delete ON conversation_members FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND user_id = app_private.current_user_id());
CREATE POLICY msg_select ON messages FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_conversation_member(conversation_id));
CREATE POLICY msg_insert ON messages FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND sender_id = app_private.current_user_id()
              AND app_private.is_conversation_member(conversation_id) AND app_private.has_org_permission('chat.use'));

-- ===== files =====
CREATE POLICY files_select ON files FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_org_member());
CREATE POLICY files_insert ON files FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND uploaded_by = app_private.current_user_id()
              AND app_private.has_org_permission('files.manage'));
CREATE POLICY files_update ON files FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('files.manage'))
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('files.manage'));
CREATE POLICY files_delete ON files FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('files.manage'));

-- ===== org_settings =====
CREATE POLICY os_select ON org_settings FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.is_org_member());
CREATE POLICY os_update ON org_settings FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_org_permission('settings.manage'))
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_org_permission('settings.manage'));
CREATE POLICY os_platform ON org_settings FOR ALL TO app_platform
  USING (app_private.is_platform_admin()) WITH CHECK (app_private.is_platform_admin());

-- ===== records (unit-scoped example module) =====
CREATE POLICY records_select ON records FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_permission(unit_id, 'record.read'));
CREATE POLICY records_insert ON records FOR INSERT TO app_user
  WITH CHECK (org_id = app_private.current_org_id() AND created_by = app_private.current_user_id()
              AND app_private.has_permission(unit_id, 'record.create'));
CREATE POLICY records_update ON records FOR UPDATE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_permission(unit_id, 'record.update'))
  WITH CHECK (org_id = app_private.current_org_id() AND app_private.has_permission(unit_id, 'record.update'));
CREATE POLICY records_delete ON records FOR DELETE TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_permission(unit_id, 'record.delete'));
