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