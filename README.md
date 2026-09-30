# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local development

Use Node.js 20.19 or newer. Install packages with `npm ci`, then run the API and Vite in separate terminals:

```text
npm run api
npm run dev
```

The API listens on `127.0.0.1:3001`; Vite proxies `/api` requests to it. Set `OPENAI_API_KEY` in the API process environment to enable replies. `OPENAI_MODEL` optionally selects a different OpenAI chat-completions model; the default is `gpt-4o-mini`.

## Ubuntu deployment

The current app uses a small Node API and does not require Supabase or Docker. Vercel CLI deploys to Vercel's hosted platform; it is not a self-hosted production runtime. On this server, Nginx keeps TLS and serves the frontend while Node handles `/api/echo-mother` on localhost.

Build locally with Node.js 20.19 or newer, then stage only the runtime files (never `.ssh`, `.env`, or `node_modules`):

```powershell
npm ci
npm run build
ssh jklair@hive "mkdir -p /home/jklair/echomother-release"
scp -r server.js package.json dist deploy jklair@hive:/home/jklair/echomother-release/
```

Run the installer from a visible PowerShell terminal so you can enter the Ubuntu sudo password at its prompt:

```powershell
ssh -t jklair@hive "sudo bash /home/jklair/echomother-release/deploy/install-ubuntu.sh"
```

The installer backs up the current Nginx site and web root under `/home/jklair/echomother-backups/`, installs a restricted systemd service, copies the built site into the existing document root, and adds an API-only Nginx proxy. It does not install Docker or alter TLS certificates. The model API returns a configuration message until a key is set.

To enable model replies, edit `/etc/echomother/echomother.env` on the server with `sudoedit`, add `OPENAI_API_KEY=...` and optionally `OPENAI_MODEL=...`, then run `sudo systemctl restart echomother`. The default model is `gpt-4o-mini`. Keep the key in that root-only file, never in a `VITE_` variable or the browser bundle. Messages are sent to OpenAI and are not persisted by the Echo interface.
