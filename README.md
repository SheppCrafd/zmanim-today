# Zmanim Today

Your personal guide to daily Jewish prayer times. A location-aware PWA that
shows halachic zmanim (prayer times) for any location, with a full siddur,
Kiblah-style compass for Jerusalem, and push reminders before each zman.

## Features

- **Zmanim** — daily halachic times (alot hashachar, sof zman shma, mincha,
  candle lighting, tzeit, etc.) computed via the [Hebcal](https://www.hebcal.com/)
  zmanim API for the user's detected or searched location.
- **Siddur** — Ashkenazi, Sephardic, and Chabad prayer texts with a
  table-of-contents tree and segment navigation.
- **Compass** — device-orientation-based compass pointing toward Jerusalem.
- **Push reminders** — opt-in browser push notifications sent ahead of each
  zman, delivered by a base44 backend function.
- **PWA install + offline shell** via a service worker (`public/sw.js`).

## Stack

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [react-router-dom](https://reactrouter.com/) for routing
- [Tailwind CSS](https://tailwindcss.com/) + a small set of
  [Radix UI](https://www.radix-ui.com/) primitives (dialog, popover, slider,
  tooltip, etc.) styled in `src/components/ui/`
- [TanStack Query](https://tanstack.com/query) for data fetching/caching
- [base44](https://base44.com/) for auth, hosting, and the serverless
  functions in `base44/functions/` (push reminder delivery, account deletion)

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build       # production build to dist/
npm run preview     # preview the production build
npm run lint         # eslint
npm run lint:fix     # eslint --fix
npm run typecheck    # tsc via jsconfig.json
```

## Project structure

```
base44/               base44 backend: app config, entities, serverless functions
src/
  api/                 base44 SDK client
  components/
    home/              Home-page widgets (next-zman card, mini compass, summary)
    siddur/            Siddur rendering (TOC tree, segments, frame)
    zmanim/            Zmanim card, location display, reminders panel
    ui/                 Radix-based primitives actually used by the app
  hooks/               Location, zmanim data, compass heading, push reminders, etc.
  lib/                 Auth/theme context, time/date helpers, schemas
  pages/               Route-level pages (Home, Zmanim, Compass, Settings, Siddurim)
```

## License

All rights reserved — see [LICENSE.md](LICENSE.md).
