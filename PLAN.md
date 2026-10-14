# Plan

## Decisions
- 2D top-down cozy illustrated NYC, crisp vector art (not pixelated), ambient animation
- Phaser 3 + Vite + TypeScript, HTML/CSS overlays for panels
- Markdown file per project in `content/projects/` is the database
- GitHub Pages at christinaawuu.github.io, deployed by GitHub Actions
- Two modes: Explore (game) and Browse (scrollable list with filters)
- Desktop keyboard, mobile tap-to-move or joystick

## World
Central Park is spawn and About Me. Neighborhoods map to categories:
Times Square (games), Chelsea (playtesting), Financial District (data), SoHo (design), DUMBO (3D modeling).
Landmarks glow when near and pulse until opened. The subway is fast travel.

## Phases
1. [x] Foundation: Vite, content schema, sample projects, Pages deploy, Browse mode
2. [x] Art kit: palette, building and prop SVGs, player character (see `/art-kit.html`; awaiting look approval)
3. [ ] Playable world: Times Square with movement, collision, glowing landmarks
4. [ ] Landmarks auto-generated from content files, with panels
5. [ ] All neighborhoods, subway, mini-map, mobile controls
6. [ ] Polish: animation, audio (muted by default), share previews, accessibility
7. [ ] Real content, including 3D modeling work
