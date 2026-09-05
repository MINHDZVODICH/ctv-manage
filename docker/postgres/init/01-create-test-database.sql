SELECT 'CREATE DATABASE ctv_manage_test OWNER ctv_manage'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ctv_manage_test')\gexec
