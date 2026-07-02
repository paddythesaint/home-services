# Homeowner Dashboard

A homeowner dashboard for a single property (895 Old Ballard Road,
Charlottesville, VA), modeled on the Charlottesville Home & Property
Services business plan. React + Vite + Tailwind frontend, Firebase
(Authentication + Firestore) as the backend, deployed to GitHub Pages.

- **Auth**: Google sign-in, restricted to one owner email.
- **Data**: Firestore, fully editable through the UI — no data is
  hardcoded. Property info plus four sections: Property Health Report,
  Annual Care Calendar, 90-Day Priority List, Job History.
- **Hosting**: static site on GitHub Pages, built and deployed by
  `.github/workflows/deploy.yml` on every push to `main`.

## One-time setup

### 1. Firebase project

In the [Firebase console](https://console.firebase.google.com/):

1. Open your project → gear icon → **Project settings** → "Your apps" →
   if there's no web app yet, click **`</>`** to add one (any nickname,
   skip Firebase Hosting). Copy the `firebaseConfig` values shown
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`).
2. **Build → Authentication → Get started → Sign-in method** → enable
   **Google** → set a support email → Save.
3. **Build → Firestore Database → Create database** → Production mode →
   pick a region → Enable.
4. **Firestore → Rules** → paste in the contents of `firestore.rules`
   (in this folder) → Publish. This locks all reads/writes to a single
   owner email.
5. **Authentication → Settings → Authorized domains** → add your GitHub
   Pages domain (e.g. `paddythesaint.github.io`) so Google sign-in works
   from the deployed site.

### 2. GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository
secret**. Add each of these (values from step 1.1, plus your email):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_OWNER_EMAIL
```

`VITE_OWNER_EMAIL` is the only account allowed to see or edit the data —
it must match the `firestore.rules` file and the Google account you
sign in with.

### 3. Enable GitHub Pages

Repo → **Settings → Pages** → under "Build and deployment", set
**Source** to **GitHub Actions**. The `deploy.yml` workflow handles the
rest automatically on every push to `main` that touches `dashboard/`.

Once deployed, the site is available at
`https://<your-username>.github.io/home-services/`.

## Local development

```
cd dashboard
npm install
cp .env.example .env   # fill in the same Firebase values as above
npm run dev
```

`.env` is git-ignored — never commit real Firebase values in it (though
they aren't secret in the traditional sense, since real security is
enforced by `firestore.rules`, not by hiding the config).
