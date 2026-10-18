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
Node 18 or newer. Set `DATABASE_URL` and `ADMIN_PASSWORD` (the password is trimmed, and it is the only login check; `ADMIN_USER` is not used). `SESSION_SECRET` is optional on your machine and required in production; without it, a restart logs the admin out.

```
npm install
npm test
npm start
```

PowerShell:

```
$env:DATABASE_URL = "postgres://..."
$env:ADMIN_PASSWORD = "secret"
npm install
npm start
```

Add `PGSSL=1` when `DATABASE_URL` is an external Render connection string. Open `http://localhost:3000`, then **Admin login**.

## News, podcast and Facebook
- Sign in as admin, open **Admin > Auto-fetch feeds**, and add each RSS/Atom feed (type: Drivers Advocate site, News outlet, Other website, or Podcast). The server checks them every 30 minutes; **Fetch now** runs it immediately.
- Stories appear in the **Magazine** tab, on the ticker and in the Feed. Podcast episodes appear in the **Podcast** tab with a player that stays on screen.
- Drivers post and reply on GoRoadHub from the Post tab. Those messages are shared with everyone. Facebook groups still cannot be posted into automatically: use **Copy for Facebook**, or add a group post by hand in the Admin tab.
