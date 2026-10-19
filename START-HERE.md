# START HERE (5 easy steps)

## Step 1 - Put the files on GitHub
1. Unzip this folder.
2. Go to github.com -> click **+** (top right) -> **New repository** -> type a name -> **Create repository**.
3. Click **uploading an existing file**.
4. Open the unzipped folder, select EVERYTHING inside it, drag it into the browser page.
5. Click **Commit changes**.

## Step 2 - Make the database (Supabase)
1. supabase.com -> **New project** (free). Wait 2 minutes.
2. Left menu **SQL Editor** -> **New query**.
3. Open the file `supabase/schema.sql`, copy all of it, paste, click **Run**.
4. **Project Settings -> API**: keep this page open, you need the *Project URL* and the *anon public* key.
5. **Authentication -> Users -> Add user -> Create new user**: your email + password, tick **Auto Confirm**. (This first account becomes the ADMIN.)
6. **Authentication -> Sign In / Providers -> Email**: turn OFF "Allow new users to sign up".

## Step 3 - Put the website online (Vercel, free)
1. vercel.com -> **Sign up with GitHub**.
2. **Add New -> Project** -> choose your repository -> **Import**.
3. Open **Environment Variables** and add these two:
   - `VITE_SUPABASE_URL`  = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy**. After about 1 minute you get a link like `https://your-project.vercel.app`. That is your website. No domain needed.

## Step 4 - Tell Supabase your website link
Supabase -> **Authentication -> URL Configuration**:
- **Site URL** = your vercel link
- **Redirect URLs** -> add your vercel link followed by `/**`

Then log in to your website and open **Admin Panel -> Branding -> Website URL** and paste the same link.

## Step 5 (later, optional) - Player accounts and Gmail reminders
Creating players and sending reminder e-mails needs 2 small functions.
Ask Claude: "help me deploy the Supabase functions" and it will walk you through it.
The rest of the site works without this step.
