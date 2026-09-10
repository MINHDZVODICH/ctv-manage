require('../dist/scripts/bootstrap-admin.js').bootstrapAdmin().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
