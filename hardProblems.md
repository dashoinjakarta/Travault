# Hard Problems & Solutions Log

## 1. Unresponsive Delete Buttons

### The Problem
The delete buttons on the document cards in the Dashboard were completely unresponsive. Clicking them yielded no result—no console logs, no browser alerts, and no visual feedback. The UI felt "dead" in that specific area.

### What We Tried / Hypotheses
1.  **Basic Event Handlers:** We initially relied on standard `onClick` handlers.
2.  **Native Confirm:** We used `window.confirm("Are you sure?")`. We suspected this was being silently blocked by the sandboxed preview environment or the browser, causing the function to hang or return false immediately without showing a dialog.
3.  **Z-Index Issues:** We suspected the card's main click area (which opens the document preview) might be overlaying the buttons, effectively "stealing" the clicks.

### The Solution
To achieve 100% certainty and fix the issue, we implemented a multi-layered approach:
*   **Custom Modal:** We completely removed `window.confirm` and replaced it with a custom React state-driven modal (`docToDelete`). This bypasses browser restrictions on native dialogs and guarantees a UI response.
*   **Event Propagation Control:** We added `e.preventDefault()` and `e.stopPropagation()` to the button click handlers. This ensures the click is handled exclusively by the button and doesn't bubble up to the card container.
*   **Z-Index & Layering:** We wrapped the action buttons in a container with `relative z-20`. This explicitly forces the browser to render the buttons on top of any card overlays or background links.
*   **Pointer Events on Icons:** We added `pointer-events-none` to the SVG icons (`<Trash2 />`, `<Edit2 />`). This ensures the click event always registers on the `<button>` element itself, rather than the SVG path, preventing inconsistent event targeting.

---

## 2. Blank Screen / Routing Errors

### The Problem
Upon loading the application in the preview environment, the screen would appear blank (blue background), and the console would throw a warning: *"No routes matched location..."*.

### What We Tried / Hypotheses
1.  **BrowserRouter:** We started with `BrowserRouter`, the standard for React applications.
2.  **Root Path Assumption:** `BrowserRouter` assumes the application is hosted at the root of the domain (`/`). However, cloud preview environments often host applications on sub-paths or use internal routing structures that conflict with client-side history API routing if the server isn't configured to redirect all requests to `index.html`.

### The Solution
*   **Switch to HashRouter:** We replaced `BrowserRouter` with `HashRouter` in `App.tsx`.
    *   **Why it works:** `HashRouter` uses the hash portion of the URL (e.g., `myapp.com/#/dashboard`) to manage navigation. The part of the URL after the `#` is not sent to the server. This makes the routing purely client-side and independent of the server's directory structure or sub-path configuration, ensuring the app loads correctly in any hosting environment.

---

## 3. Zombie Files (Database Deleted, Storage Remains)

### The Problem
When a user deleted a document, the record was removed from the dashboard/database, but the actual file remained in Supabase Storage. This creates "Zombie Files" that clutter storage and cost money.

### What We Tried / Hypotheses
1.  **Silent Failures:** The storage delete operation was wrapped in a `try-catch` block that logged errors as "Non-fatal". This hid the fact that the delete request was actually failing (usually 400 or 401 errors).
2.  **Path Mismatch:** The file path stored in the database sometimes contained leading slashes (e.g., `/user-id/file.pdf`) or full URLs. The Supabase Storage API expects relative paths *without* leading slashes (e.g., `user-id/file.pdf`). If a leading slash is sent, the API often returns success (or fails silently) but deletes nothing because no file matches that exact path string.
3.  **RLS Policy Fragility:** The original RLS policy used `storage.foldername(name)`, which extracts path segments. While technically correct, it can sometimes be brittle depending on how the file path string is formatted in the delete request.

### The Solution
*   **Path Sanitization:** In `storageService.ts`, we added strict logic to strip any leading slashes (`/`) from the file path before sending it to the Supabase SDK.
*   **Robust SQL Policy:** We updated the Storage RLS Delete policy to use a string pattern match (`name LIKE auth.uid() || '/%'`) instead of the helper function. This explicitly allows deletion of any file that starts with the user's ID folder, which is more predictable and robust.
