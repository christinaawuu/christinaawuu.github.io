# Christina Wu: NYC Portfolio

An interactive, Stardew-style New York portfolio. Work lives in `content/projects/*.md`.

## Add or remove work

1. Copy `content/_template.md` to `content/projects/<name>.md`.
2. Fill in the header (`category` picks the neighborhood) and write the description.
3. Push to `main`. GitHub Actions rebuilds and redeploys in about a minute.

To remove work, delete the file or set `draft: true`. Images go in `public/images/`.

| category | neighborhood | holds |
|---|---|---|
| games | Times Square | Games |
| playtesting | Chelsea | Professional playtests |
| engineering | Financial District | Software engineering and data |
| apps | Flatiron | iOS apps and websites |
| modeling | DUMBO | Maya modeling, rendering, animation |
| design | SoHo | Design and marketing |
| experience | Midtown | Jobs |
| involvement | Union Square | Leadership and community |
| spots | My Spots | Hobbies and favorite places |

## Run locally

Requires Node 20+.

```
npm install
npm run dev
```

## Deploy

1. Create a GitHub repo. Naming it `christinaawuu.github.io` gives the URL `https://christinaawuu.github.io/`. Any other name gives `https://christinaawuu.github.io/<name>/`.
2. Push this folder to its `main` branch.
3. In the repo, go to Settings, then Pages, and set Source to **GitHub Actions**.

See `PLAN.md` for the roadmap.
