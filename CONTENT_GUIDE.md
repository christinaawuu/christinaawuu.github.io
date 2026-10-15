# Content guide: add or edit anything on the site

Everything you see on the site comes from plain text files in the `content/` folder. You never touch code to add work.

| File | What it controls |
|---|---|
| `content/projects/<name>.md` | One project, job, or hobby spot. Each file becomes a building on the map and a card on the career page. |
| `content/neighborhoods/<category>.md` | The sign at each neighborhood's entrance: an explanation of the neighborhood, plus your own recommendations. |
| `content/about.md` | The "About me" panel (the 🏠 pin in Brooklyn). |
| `content/site.json` | Your name, headline, intro, photo, stats, skills, links, and resume links on the career page. |
| `public/images/` | Photos and screenshots. |
| `public/clips/` | Short video files (mp4). |

## 1. Add a project

1. Copy `content/_template.md` to `content/projects/my-new-project.md`. The file name does not matter to visitors.
2. Fill in the top section (between the two `---` lines), then write the description underneath in plain text or Markdown.
3. Save and push. The site rebuilds and updates in about a minute.

### The top section (the "frontmatter")

```yaml
---
title: Project name
category: games           # which neighborhood it lives in (see the list below)
alsoIn: [engineering]     # optional: other career-page categories it also shows under
date: "2026-01"           # YYYY or YYYY-MM. Newest shows first.
dateLabel: "Jan - May 2026"   # optional: what visitors see instead of the date
summary: One sentence shown on the card.
tags: [Unity, C#]
cover: images/my-cover.png    # optional card image (file in public/images/)
featured: false           # true pins it to the top
draft: false              # true hides it everywhere
showIn: [world, career]   # optional: where it appears (default: both)
media:                    # optional photos and videos shown in the project panel
  - type: image
    src: images/screenshot.png
    caption: What this shows
links:
  - label: Play it
    url: https://example.com
---
```

### Categories

| `category` | Neighborhood on the map | Career-page category |
|---|---|---|
| `games` | Times Square | Games |
| `playtesting` | Chelsea | Playtesting & Research |
| `engineering` | Financial District | Software Engineering |
| `apps` | Flatiron | Apps & Web |
| `modeling` | DUMBO | 3D & Animation |
| `design` | SoHo | Design & Marketing |
| `experience` | Midtown | Experience |
| `involvement` | Union Square | Leadership & Involvement |
| `spots` | hobby pins on the map | (map only) |

`category` decides the building's neighborhood. `alsoIn` adds extra career-page categories, for example a job that was also engineering and games work. The neighborhood names show as 📍 tags on the career page.

### Photos and videos

- Put image files in `public/images/` and refer to them as `images/file.png` (no `public/`, no leading slash).
- Video: `type: video` with an mp4 in `public/clips/` (`src: clips/session.mp4`), or `type: youtube` with the YouTube video ID. Keep clips short, since big files slow the site.
- Playtest clips: use `showIn: [career]` so they only appear on the career page. See `content/_playtest-template.md`.

### Brooklyn (hobby spots) extras

Entries with `category: spots` appear in the Brooklyn neighborhood. They can also have:

```yaml
building: gym        # which building to draw: gym, pizza, arcade, lab, bank, gallery, warehouse, office, flatiron, hall, bodega
prop: bike-rack      # or draw a standalone prop instead of a building: bike-rack, picnic, bridge
park: true           # green park-style lot instead of pavement
action: bike         # a little interaction on the F key: bike, reps, photo, or snack:🍕 (any emoji)
```

## Neighborhood signs and your recommendations

Each neighborhood has a sign near the subway entrance. Edit its file in `content/neighborhoods/` (for example `games.md`). The text under the `---` lines is the explanation. To add recommendations, replace `picks: []` with:

```yaml
picks:
  - name: Joe's Pizza
    note: Best classic slice near Times Square
  - name: Bryant Park
    note: Great spot to read in the afternoon
```

They show up on the sign under "My picks".

## 2. Edit an existing project

Open its file in `content/projects/`, change the text, and save and push. To hide it without deleting it, set `draft: true`.

## 3. Edit "About me", your photo, intro, stats, and skills

- `content/about.md`: change the text below the `---` lines.
- `content/site.json`: `headline`, `intro`, `stats`, `skills`, and `links`.
- Photo: put a square-ish photo in `public/images/` (for example `christina.jpg`), then set `"photo": "images/christina.jpg"` in `site.json`.
- Resume buttons: put a PDF in `public/resume/` and add `{ "label": "Resume (Game Dev)", "url": "resume/Christina_Wu_Game_Dev.pdf" }` to `resumes`. Remember a public resume shows whatever contact details are on it.

## 4. Hobby spots

A hobby entry (`category: spots`) gets a pin on the map once it is not a draft. Its location comes from `SPOT_POS` in `src/neighborhoods.ts`, keyed by the file name (without `.md`). To move a pin, ask Claude or edit the latitude and longitude there.

## How to edit from any device

### Option A: GitHub's website (no setup, works on a phone)

1. Open your repo on github.com and go to `content/projects/`.
2. To edit, open a file and click the pencil icon, then **Commit changes**.
3. To add, click **Add file → Create new file**, name it `content/projects/new-name.md`, paste in the template, then **Commit changes**.
4. To add an image, open `public/images/`, click **Add file → Upload files**, drag it in, then **Commit changes**.
5. Check the **Actions** tab. A green check means the site updated.

### Option B: your computer

First time on a new device:

```bash
git clone https://github.com/christinaawuu/christinaawuu.github.io.git
cd christinaawuu.github.io
npm install
```

Every time you work:

```bash
git pull                 # get the latest changes first
npm run dev              # optional: preview at http://localhost:5173
# ...edit or add files in content/ and public/...
git add -A
git commit -m "Add my new project"
git push
```

You need Node.js (version 20 or newer) installed to preview. You do not need it to just edit files and push.

## If something does not show up

- The `---` lines at the top and bottom of the file must be there, and indentation under `links:` and `media:` must match the template.
- `category` must be one of the nine names above, spelled exactly.
- `draft: true` hides an entry.
- Open the repo's **Actions** tab. A red X means the build failed, and its log says which file is wrong.
- Locally, add `?drafts` to the preview URL to see draft entries.

## Contact form

By default the form opens the visitor's email app with the message filled in. To have messages arrive in your inbox without opening an email app, make a free form at formspree.io (or a similar service), then paste its URL into `"contactEndpoint"` in `content/site.json`. Leave it empty to keep the email-app behavior.
