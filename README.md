# GoRoadHub

Express + Postgres app. Posts and ticker headlines are public to read; only the admin (password login) can add, edit, delete, pin and reorder.

## Deploy on Render
1. Create a new GitHub repo and upload everything in this folder (keep `public/` and `render.yaml` at the top level).
2. In Render: **New + > Blueprint**, pick the repo. Render reads `render.yaml` and creates the web service and the Postgres database.
3. When prompted, set `ADMIN_PASSWORD` to a strong password you choose. Do not commit it to GitHub.
4. Deploy. Open the `.onrender.com` URL, click **Admin login**, and sign in.
5. Optional: add your own domain under the service's Settings > Custom Domains.

Check Render's current plan limits: free web services sleep when idle and free databases may expire. Use a paid plan for a live community site.

## Local run
`DATABASE_URL=postgres://... ADMIN_PASSWORD=secret npm install && npm start` (add `PGSSL=1` for an external Render database URL).
