alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('member', 'admin', 'super_admin'));

update users
   set role = 'super_admin'
 where email = 'admin@sport.local';
