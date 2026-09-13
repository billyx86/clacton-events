/**
 * Compatibility shim: exposes the app's REACT_APP_* environment variables
 * as a `process.env` object for libraries (and our own code) that read the
 * legacy CRA API. Vite statically inlines `import.meta.env.VAR` at build
 * time — nothing sensitive is sent to the browser beyond what CRA already
 * did.
 *
 * Vite is configured with `envPrefix: 'REACT_APP_'`, so existing .env
 * files keep working unchanged.
 */
const shim = {};
for (const [key, value] of Object.entries(import.meta.env)) {
  if (key.startsWith('REACT_APP_')) {
    shim[key] = value;
  }
}

export default { env: shim };
