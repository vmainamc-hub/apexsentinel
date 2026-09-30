-- Apex Sentinel tenant template. Replace every placeholder before execution.
insert into public.organisations (id,name,slug,owner_user_id,status) values ('<ORGANISATION_UUID>','Apex Sentinel','apex-sentinel','<AUTH_USER_UUID>','active');
insert into public.sites (id,user_id,name,status) values ('<SITES_ROW_UUID>','<AUTH_USER_UUID>','Apex Sentinel','active');
insert into public.site_domains (site_id,hostname,is_primary,is_verified,status) values ('<SITES_ROW_UUID>','<APEX_HOSTNAME>',true,true,'active');
insert into public.deriv_applications (organisation_id,site_id,app_id,oauth_client_id,environment,callback_uri,configured_scopes,verification_status) values ('<ORGANISATION_UUID>','<SITES_ROW_UUID>','<YOUR_DERIV_APP_ID>','<YOUR_DERIV_OAUTH_CLIENT_ID>','production','https://<APEX_HOSTNAME>/api/deriv-oauth-callback',array['trade'],'configured');
