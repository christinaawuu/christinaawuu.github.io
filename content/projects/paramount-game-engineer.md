---
title: Junior Game Engineer Intern, Paramount Skydance Games
category: experience
date: "2026-06"
dateLabel: "Jun 2026 - Present"
summary: Unreal Engine C++ gameplay engineering with a team of 10+ engineers in Manhattan.
tags: [Unreal Engine, C++, Agile]
featured: true
alsoIn: [engineering, games]
media:
  - type: video
    src: videos/paramount/spawn-limits.mp4
    poster: videos/paramount/spawn-limits.jpg
    title: Spawn limits by gameplay tag
    work: >-
      Designed a system that caps how many actors with a given gameplay tag can exist in a level at once.
      Designers add a spawn-limit component to an actor Blueprint and set the caps in a tag-to-number map in a Data Asset, with no code changes.
      Before each spawn, the Spawner Subsystem checks the cap and reserves a slot. It refuses once the cap is hit and releases the slot when the actor is gone.
      Actors with no entry stay unlimited.
    caption: I spawn past the cap and the spawner refuses. Then I despawn one, and a new spawn is allowed again.
  - type: note
    src: ""
    title: Mission-gated spawn tables
    work: >-
      Made enemy spawning respond to player progression. Rows in a spawner data table can unlock when a specific mission succeeds,
      or once the player has completed a set number of missions in total, so designers control how the enemy mix escalates.
      I also added a CompleteMission console command so QA and engineers can test progression without playing through each mission.
  - type: video
    src: videos/paramount/spawn-despawn-by-tag.mp4
    poster: videos/paramount/spawn-despawn-by-tag.jpg
    title: Spawn and despawn by tag (debug tooling)
    work: >-
      Built engineer-facing debug tools. SpawnByTag and DespawnByTag console commands spawn near the player or despawn actors by gameplay tag.
      The in-game debug menu builds its Spawn and Despawn buttons from the entries in a config Data Asset, so engineers and designers can add new tags
      without hand-editing a Blueprint or writing UI code. This gives QA and engineers one-click setup and teardown of test scenarios.
    caption: The debug menu and the console commands spawning and despawning actors by tag.
  - type: note
    src: ""
    title: Spawner despawn and respawn in player range
    work: >-
      Fixed and extended how encounter spawners behave when the player leaves and returns.
      A spawner with no leash used to never resume after despawning, so I added a respawn range with a clamped resume radius (no flickering between spawned and despawned),
      and returning players now get the exact wave they left, with wave progression intact.
      I also built a console-variable debug view with distance lines and despawn/resume rings, and made the despawn check interval designer-tunable.
      A teammate integrated and submitted this work.
  - type: video
    src: videos/paramount/inventory-drop.mp4
    poster: videos/paramount/inventory-drop.jpg
    title: Inventory drop system
    work: |-
      Implemented the "inventory to world" path for a record-based inventory.
      - **Drop Record** removes an item record and spawns its actors with launch velocity.
      - **Drop Inventory** drops N items of a class and splits stacked records when only part of a stack is dropped.
      - One shared spawn helper (using the actor pool) serves both commands.
      - Drop styles are an editor-picked, extensible selector with random-cone scatter and a configurable fan spread.
    caption: I use exec commands to drop a single item, then a stack of one class, then the different fan patterns.
  - type: note
    src: ""
    title: Reliability and error-handling pass (AI and animation plugin code)
    work: >-
      Audited shared AI code (formations, controllers, patrol paths, subsystem) and animation code (notifies, anim instances, IK).
      I replaced hard crashes (check and assert-style ensureMsgf) with readable error logs and safe early exits, so bad data no longer takes down the game.
      I also made the patrol-path failure log report the pawn, path actor, status, path IDs and failure reason, so problems can be diagnosed from the log alone.
    code: |-
      // Before: bad data crashes the game
      check(InObserver != nullptr);

      // After: a readable log and a safe early exit
      if (InObserver == nullptr)
      {
          UE_LOG(LogTemp, Error, TEXT("%s: AddObserver - Unable to add Null Observer."),
              *USDIUtil::GetReadableNameSafe(this));
          return;
      }
---

- Architected an Unreal C++ item-drop system, consolidating 5 legacy functions into 3 while preserving object-oriented design.
- Built a cone-based random launch-velocity generator with vector math, enabling scattered loot drops with tunable angle and speed ranges.
- Collaborated with 10+ engineers across 2-week Agile sprints and biweekly standups.
- Eliminated 3 recurring production bugs by rebuilding core gameplay logic.
- Partnered with designers to define technical specifications and delivered a debug menu that operates independently.
