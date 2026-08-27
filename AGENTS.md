# AGENTS.md

## Release
- Release only a single `.exe` file. Do not create a portable version.
- The release executable must follow the naming pattern `TaskTracker-vN.exe`, incrementing `N` for each release.
- Before creating a new release, delete the previous `.exe` version from the release folder so that only the latest `TaskTracker-vN.exe` remains.

## Project Folder Safety
- `openProjectFolder` must remain strictly read-only with respect to the project folder.
- It may only open the supplied folder path in the operating system's file explorer using `shell.openPath`.
- It must never create, modify, rename, move, copy, or delete any file or directory inside the project folder.
- Do not add filesystem write operations (`fs.writeFile`, `fs.mkdir`, `fs.rename`, `fs.rm`, `fs.unlink`, `fs.copyFile`, etc.) to `openProjectFolder` or to any function called as part of opening the folder.
- Any future changes to `openProjectFolder` must preserve this behavior: validate the path, open it, return success/error, and perform no other filesystem operation.

## Projects Feature

### Data Model
- The task database is an object with two top-level collections: `projects` and `tasks`.
- `projects` is the canonical project store. It is keyed by stable project id.
- A project record must use this shape:
  - `id`: stable unique id.
  - `projectNumber`: the visible project number shown in the `Number` column.
  - `projectName`: the visible project name shown in the `Name` column.
  - `folderPath`: optional folder path for opening the project folder.
  - `updatedAt`: ISO timestamp used for recency-based suggestions.
- `tasks` is grouped by year. Each task stores `projectId`; task rows should not persist duplicated `projectNumber` or `projectName` fields.
- UI task objects may be hydrated with `projectNumber`, `projectName`, and `folderPath` for rendering. Those hydrated fields must be removed before task persistence.
- Project number uniqueness is case-insensitive and whitespace-trimmed. Use the existing project-number key behavior (`getProjectNumberKey`) when matching or de-duplicating projects.
- Adding a task must reuse the existing project when the entered project number already exists. Only create a new project id when the project number is new.
- Updating a task's project number/name must either attach the task to an existing matching project or upsert the current project. Do not silently create duplicate projects with the same normalized number.
- Updating a project from the project details page must reject an empty number/name and must reject a number already owned by another project.
- Legacy databases may contain tasks with embedded project number/name. The Electron-side normalization must convert those into canonical project records and task `projectId` links.

### Main UI Flow
- The main view tabs are `Table`, `Kanban`, and `Projects`. `Projects` is a task view tab in `App.jsx`, not a `TaskLibrary` add/search/settings tab.
- The year switcher applies to the `Projects` tab. Do not hide the year switcher for Projects.
- The `Projects` tab is year-aware. It must use the same active-year task set as `Table` and `Kanban`.
- In search mode, the `Projects` tab must group and display the matching task results, not all project tasks.
- The project list should be derived from the displayed task set. Projects with no tasks in the active year/search result should not appear in that list.
- The Projects empty state should distinguish normal yearly emptiness from search emptiness, for example `No projects this year` and `No matching projects`.
- The Projects tab is sorted by the `Number` column first and project name second. Use natural/numeric collation so `2` sorts before `10`.
- Do not change the add-task project suggestion ordering when changing the Projects tab ordering. Suggestions may remain recency-based.

### Project List Table UI
- The Projects tab is implemented by `src/components/ProjectList/ProjectList.jsx` and `ProjectList.module.css`.
- The Projects table columns are, in order: `No`, `Week`, `Number`, `Name`, `Description`, `Due`, `Status`.
- A top-level project row represents one project, not one task.
- In a top-level project row:
  - `No` contains the expand/collapse button and the project row number.
  - `Week` is empty.
  - `Number` shows the project number.
  - `Name` shows the project name.
  - `Description` shows the project task count.
  - `Due` and `Status` are empty.
- Clicking a top-level project row's number opens the project details page by setting the selected project id.
- Clicking a top-level project row's name opens the project folder only when `folderPath` exists.
- Project number/name hover highlighting should be visual only. It must not resize cells, move text, or change row height.
- Keep project number/name formatting visually consistent with `TaskRow` in the Table tab unless the user explicitly asks for a different Projects-only treatment.
- Expanded project rows reuse `TaskRow`; avoid creating a second task-row implementation for Projects.
- Expanded project task rows must remain the same height and general formatting as task rows in the Table tab.
- Expanded project task rows must not enable drag reordering unless reordering behavior is intentionally designed for this view.

### Weeks Inside Expanded Projects
- Expanded project tasks are grouped by week before rendering.
- Weeks inside an expanded project should be sorted newest first by `weekStart`.
- Task row numbering inside an expanded project should follow the rendered task order after week grouping.
- The week must be displayed in the dedicated `Week` column of each expanded task row.
- Do not render separate week header rows in the Projects tab unless the user explicitly requests that layout.
- Do not render the week as a badge over the row or inline in the description unless the user explicitly requests that layout.
- The week label should split into two lines in the `Week` column:
  - First line: `Week N,`
  - Second line: `D Mon YYYY`
- Use the existing week utilities (`getMondayWeekStartKey`, `formatWeekLabel`) so week labels match the rest of the app.
- Current-week rows in the Projects tab may highlight the `Week` column text, but the highlight must not change layout.
- The Projects footer should show `Current week` when any displayed project has current-week tasks.
- Clicking `Current week` in the Projects footer should expand projects that have current-week tasks. It should not navigate away or change the active year.
- The Projects footer should keep an expand/collapse all-projects control.

### Project Details Page
- Clicking a project number opens `ProjectTasksPage`.
- The project details page displays all tasks for the selected project across years. It is not limited by the main active-year switcher.
- The project details page uses `TaskTable` for its task list.
- On the project details page, all week groups must be expanded by default. Pass `defaultCollapseToCurrentWeek={false}` to `TaskTable`.
- The main Table tab should keep the default current-week collapse behavior unless the user asks to change it.
- Project details editing must allow project number, project name, and folder path updates.
- Project details editing must preserve duplicate-number validation against the project lookup.
- The project calendar on the project details page should continue to derive worked weeks from that project's tasks.

### Electron and Backend Responsibilities
- Electron owns database reading, writing, selecting a database file, selecting a project folder, opening a project folder, and database normalization.
- Frontend code should call the data-layer functions in `src/data/taskDatabase.js`; it should not call Electron IPC directly.
- `electron/preload.cjs` exposes the task database bridge. Keep the bridge narrow and explicit.
- `readTaskDatabaseFromPath` may create or normalize the database file itself. This is separate from opening a project folder.
- `writeTaskDatabaseToPath` must serialize the normalized database shape with canonical projects and year-grouped tasks.
- `openProjectFolder` must remain the only backend path used for opening a stored project folder from the UI.
- `openProjectFolder` must keep calling `shell.openPath(trimmedFolderPath)` exactly once. The safety script checks this.
- Do not replace `openProjectFolder` with `shell.showItemInFolder`, `explorer.exe` arguments, registry edits, PowerShell, or any other Windows-specific Explorer control unless the safety policy is explicitly changed first.
- Do not add filesystem writes to project folders as part of selecting, opening, rendering, sorting, or expanding projects.

### Build and Verification
- After changing project UI, task-row rendering, project details, database normalization, or folder-opening behavior, run `npm run build`.
- `npm run build` runs the project-folder safety check before the Vite build; a passing build is required before handing off changes.
- If changing Electron main-process code, also run `node --check electron/main.cjs`.
- If changing `openProjectFolder`, run `npm run check:project-folder-safety` directly and confirm it passes.
- Keep new React UI code under `src/components/<ComponentName>/` with a matching CSS module when it follows the existing component pattern.
- Prefer reusing `TaskRow`, `TaskTable`, week utilities, project lookup/index helpers, and existing status constants over duplicating behavior.
- Do not change release behavior while working on Projects unless the user explicitly asks for a release.
