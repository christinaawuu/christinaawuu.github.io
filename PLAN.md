# Plan (v2)

## Two experiences, one dataset

1. **My NYC (the world).** Personality, experiences, work, hobbies. Explore an illustrated NYC.
2. **Career (the page).** A scrollable, candidate-focused page: headline, resume download,
   skills, experience timeline, featured projects, playtest research, contact.
   Possible tabs: Game Dev | Software Engineering.

Both read the same content files in `content/`, so adding an entry updates both.

## The world: zoom from city to neighborhood to street

- **Level 1, city map.** A stylized overview of Manhattan and Brooklyn (rivers, bridges, Central Park,
  clusters of small buildings). Neighborhoods with work in them show a glowing beacon.
- **Level 2, zoom transition.** Click or tap a beacon (or pinch-zoom) and the camera zooms in.
- **Level 3, neighborhood scene.** Walk around. Projects of the same kind sit together as landmarks,
  with generous spacing, traffic, and street life. Walk up, press E or tap, and a panel opens.

## Proposed neighborhoods (real geography, editable)

| Neighborhood | Holds |
|---|---|
| Times Square | Games: Lucy, Twist Tile Golf, board games |
| Chelsea | Professional playtesting: a lab with a room per session (video + notes + player reactions) |
| Financial District | Software engineering and data: Cathartic Health, Find Your Spot, telemetry |
| Flatiron | iOS and web projects: Dishcovery, websites |
| DUMBO | Maya: 3D modeling, rendering, animation |
| SoHo | Design and marketing: level design, Own It, MoCADA, Figma |
| Midtown | Career: Paramount Skydance Games, Unchained |
| Union Square | Involvement: WiE, Own It leadership, residential advisor |
| Hobby spots | Citi Bike rack (West Side Highway), DUMBO walks, picnic in Central/Prospect Park, gym, iconic food spots |

## Content model

- `content/projects/*.md`: type project (add `neighborhood`, `media`, `featured`)
- `content/experience/*.md`: jobs and involvement (feeds the Career page timeline too)
- `content/playtests/*.md`: one per session: game, date, anonymized player, video, notes, feel/rating, quotes
- `content/spots/*.md`: hobby spots with a short story and a photo

Participant video needs consent from the players before publishing.

## Performance plan

- Rasterize art to WebP atlases at build time, with SVG as the source.
- Load each neighborhood on demand, so the first screen only loads the city map.
- Move to Phaser (canvas/WebGL) before the map gets large. Cull off-screen objects.
- Videos live on YouTube/Vimeo/itch embeds, lazy-loaded on click. Images are compressed WebP.
- Budget: first interactive under 3s on a mid-range phone, under 2 MB initial.

## Phases

1. [x] Foundation: Vite, content schema, deploy workflow
2. [x] Art direction: first-style buildings with depth, new character
3. [x] Content rework: nine neighborhoods, involvement and hobby entries, media and showIn fields
4. [x] City overview map with beacons, pan, pinch and wheel zoom, and the zoom-in transition
5. [x] Neighborhood scenes: spaced-out walkable streets generated from each neighborhood's entries
6. [x] Career page: grouped by category, neighborhood shown as a tag
7. [ ] Hobby spots with real photos and stories (pins already appear on the map once an entry is live)
8. [ ] Polish: performance pass, audio (muted by default), share previews, accessibility, see-through outline behind buildings
9. [ ] Real content: Maya renders, playtest clips, board games, Lucy details, food spots
