# Hospital Appointments System: Full System Redesign Prompt

This document applies to the **whole system**: every page, every user role, and every device. It is not limited to one page or one type of user.

**Design direction:** deep navy, white and black, in a single mode only (no Light mode or Dark mode switch).

---

## 1. Ready-to-use prompt

> Redesign the entire Hospital Appointments System so that every page looks professional, calm, consistent and trustworthy, like modern healthcare software. Apply the same design to all user roles (for example patients, doctors, staff and administrators) and to all pages: landing page, login and registration, dashboards, appointments, booking, records and lists, notifications, reports, user management, profile and settings, and error pages.
>
> **Colors:** Use only deep navy (`#0B1F3A`), white and black. Use a white page background, white cards with thin light-grey borders, and black text. Use deep navy for the sidebar or top navigation, primary buttons, active menu items, selected options, table headers and badges. Do not use other accent colors (no teal, green, orange or purple).
>
> **Mode:** Build one single mode only. Do not include a Light/Dark mode switch, theme settings, or any code that follows the device theme.
>
> **Layout:** Use one shared page layout everywhere: a deep navy sidebar (collapsing to a menu button on phones), a top bar with the page title and the user's name and photo, and a white content area with cards. Keep content in clear sections with generous spacing and no decorative background patterns. Remove repeated or duplicate information, fix typos, and keep captions short.
>
> **Components:** Use the same buttons, forms, tables, cards, badges, modals, alerts and empty states on every page. Buttons and inputs must be at least 44px tall. Use the Inter font.
>
> **Landing page:** Make it fast and light. Resize, compress and convert all images to WebP, lazy-load images below the first screen, and replace decorative images with small SVGs or plain CSS.
>
> **Uploads:** Increase the allowed file upload size (profile photos and documents) so users can upload normal phone photos and files without errors, with clear messages for file type and size.
>
> **Responsive:** Every page must work on phones, tablets and desktops. On phones, stack content in a single column and make tables scroll or turn into cards.

---

## 2. Design specification (applies to all pages)

### Colors

| Use | Color |
|---|---|
| Deep navy (sidebar, header cards, primary buttons, active items, table headers, badge text) | `#0B1F3A` |
| White (page background, cards, text on navy) | `#FFFFFF` |
| Black (main text) | `#0A0A0A` |
| Secondary text | `#4A5058` |
| Card and table border | `#D5D9E0` |
| Input border | `#B8BEC8` |
| Badge, hover and selected background | `#E6EAF1` |
| Light info background | `#F2F4F7` |
| Secondary text on navy | `#C9D3E3` |

### Typography

Inter. Page title 28px, card title 17px, body 14–15px, labels 12px.

### Spacing and shape

20px gap between cards, 24px card padding, 14px card corner radius, 10px button and input corner radius, 44px minimum height for buttons and inputs.

### Mode

One single mode only. No Light/Dark switch, and no `prefers-color-scheme` rules.

### Status and feedback (without extra colors)

Show status with text and an icon, not with new colors.

| Status | How to show it |
|---|---|
| Active / Confirmed / Verified | Navy-tint badge with navy text and a check icon |
| Pending | Outlined badge with a clock icon |
| Cancelled / Failed | Black text badge with a cross icon |
| Error message | White box with a thick navy or black border, an icon, and clear text |

If your team later decides that errors need a stronger signal, add one single warning color for errors and destructive actions only.

---

## 3. Shared layout for every page

```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │ Top bar: page title        name · photo  │
│ (navy)   ├──────────────────────────────────────────┤
│          │ Content area (white)                     │
│ Menu     │   Cards, tables, forms                   │
│ items    │                                          │
└──────────┴──────────────────────────────────────────┘
Phones: the sidebar becomes a menu button, and content stacks in one column.
```

---

## 4. Pages and how the design applies

| Page | Design instructions |
|---|---|
| Landing page | Navy top bar, a short hero section with a lightweight image, a clear "Book appointment" button, simple service cards, and a footer in navy |
| Login / Register | A centered white card on a white page, with a navy primary button and short helpful messages |
| Dashboards (every role) | Summary cards in a row, an upcoming appointments table, and quick action buttons |
| Appointments (list) | A table with a navy header row, search and filter bar, and status badges |
| Book / schedule appointment | A step-by-step form in cards: choose department or doctor, date and time, confirm |
| Records and documents | A list or table with file type icons, upload button and download buttons |
| Notifications | A simple list with unread items marked by a navy dot and bold text |
| Reports and statistics | White cards with charts in navy and grey shades, and clear labels |
| User and staff management | A table with search, role badges, and edit and delete actions in modals |
| Profile and settings | A navy profile header card, a contact and account details card, a language card and a security card (see section 5) |
| Error and empty pages | A short message, a simple icon and one clear button |

---

## 5. Profile and settings page (example of the new design)

```
Settings
├── Profile header card (full width, deep navy)
│   ├── Photo / initials
│   ├── Name, Active badge, role · email
│   ├── ID | Record or account status | Member since
│   └── [Edit profile] [Upload photo]
├── Left column
│   └── Contact & Account Details
│       ├── Email (Verified)
│       ├── Phone (Verified)
│       ├── National ID
│       ├── Role
│       └── Account status
└── Right column
    ├── Language (English, Français, Kinyarwanda)
    └── Security (Current, New, Confirm, [Change password])
```

Live design boards for this page (desktop and mobile): https://claude.ai/artifact/Qjjdu4oEYLvrV2eRY2FVr2

---

## 6. Apply the colors across the whole system

Put every color in one shared file and import it on every page.

```css
/* theme.css */
:root {
  color-scheme: light;
  --navy: #0B1F3A;
  --white: #FFFFFF;
  --black: #0A0A0A;
  --text-muted: #4A5058;
  --border: #D5D9E0;
  --tint: #E6EAF1;
  --chip: #F2F4F7;
}
body { background: var(--white); color: var(--black); font-family: Inter, sans-serif; }
.card { background: var(--white); border: 1px solid var(--border); border-radius: 14px; padding: 24px; }
.btn-primary { background: var(--navy); color: var(--white); min-height: 44px; border-radius: 10px; }
thead th { background: var(--navy); color: var(--white); }
```

Checklist:

- Search the whole project for the old colors (teal, green, any hardcoded hex codes) and replace them with these variables.
- Delete every `@media (prefers-color-scheme: dark)` block, every `.dark` class, and the theme toggle button and its code.
- Check every area: sidebar, navbar, tables, forms, modals, alerts, charts, emails and printed pages, as well as the landing page.
- Use the same components (buttons, cards, badges, tables) everywhere, rather than page-by-page styles.

---

## 7. Make the landing page lighter

- **Resize** each image to the size it is actually shown at. A hero image rarely needs more than 1600px wide, and a card image 600px.
- **Convert to WebP or AVIF.** This usually cuts size by 50–80%. Aim for under 200 KB for the hero image and under 80 KB for other images.
- **Lazy-load** everything below the first screen: `<img loading="lazy" width="600" height="400" ...>`.
- **Use `srcset`** so phones download smaller versions.
- **Replace decorative images** (such as the medical icon pattern) with a small SVG or plain CSS.
- Turn on **gzip or Brotli** on the server, and minify CSS and JavaScript.

Batch conversion example:

```bash
npx sharp-cli -i "images/*.{jpg,png}" -o optimized/ resize 1600 --format webp --quality 75
```

---

## 8. Increase the file upload size

The limit usually exists in several places. Raise all of them to the same value (for example 5–10 MB for photos, more for documents), or the smallest one will still block uploads.

| Layer | Setting |
|---|---|
| Frontend | The size check in the upload code, e.g. `file.size > 10 * 1024 * 1024` |
| Nginx | `client_max_body_size 10M;` |
| Node/Express (multer) | `limits: { fileSize: 10 * 1024 * 1024 }` |
| PHP | `upload_max_filesize = 10M` and `post_max_size = 12M` |
| Laravel | The `max:10240` validation rule (in KB) |
| Django | `DATA_UPLOAD_MAX_MEMORY_SIZE` and `FILE_UPLOAD_MAX_MEMORY_SIZE` |

Also:

- Keep checking file type and size on the server, not only in the browser (photos: JPG, PNG, WebP).
- Show a clear message when a file is too large or the wrong type, and show upload progress.
- Resize or compress profile photos after upload so storage and page loads stay fast.

---

## 9. Summary of all changes

| Area | Change |
|---|---|
| Scope | The design applies to the whole system and all roles, not one page |
| Colors | Deep navy, white and black only |
| Mode | One single mode, no Light/Dark switch |
| Layout | One shared sidebar, top bar and content layout on every page |
| Components | The same buttons, forms, tables, cards, badges and modals everywhere |
| Landing page | Smaller, compressed WebP images, lazy-loading and lighter decoration |
| Uploads | Larger file size limit, applied at every layer, with clear messages |
| Responsive | Works on phones, tablets and desktops |
