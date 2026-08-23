# Task Tracker

A simple React and Electron desktop app for tracking project tasks in a table.

Tasks are stored in a plain JSON file. Use `Choose Database` in the app to select the JSON file to read and write. The selected path is remembered automatically.
Tasks are grouped by week, with each week starting on Monday.

## Run

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Windows Release

```bash
npm run dist:win
```

The Windows release number is stored in `build/release-number.txt` and increases by 1 after each successful Windows build.
Each Windows release produces one installer named `TaskTracker-vN.exe`.
