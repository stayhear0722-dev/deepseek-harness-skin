# Agent Note: Ambient conversation atmosphere for the web client

Status: implemented

English | [中文](2026-08-16-web-conversation-atmosphere.zh.md)

## Problem

The default conversation column is intentionally neutral, but it gives an idle Harness workspace no visual sense of presence and offers little separation while a long-running task is streaming. The desired experience is an interactive, calm background when the conversation is waiting and a readable glass surface when a task is active, without changing the session protocol or competing with conversation controls.

## Decision

`@deepseek-ai/dsh-client-ui-conversation` renders `HarnessAtmosphere` inside `ConversationRoot`. The component owns one non-interactive OGL canvas, samples pointer position only while it is inside the conversation column, and reads the existing projected `session.running` value. The shader renders a low-density blue particle field with drifting haze; pointer movement creates a local ripple. It is disabled when reduced motion is requested or WebGL is unavailable.

The conversation slots stay together in the existing foreground layer. When the projected session is running, the root adds `data-running` and raises a translucent, blurred CSS panel between that content and the canvas. The adjacent sidebar uses a deeper blue shell with light navigation controls, so the application frame reads as one surface rather than a white panel beside the atmosphere. This is presentation-only: it adds no slot, configuration key, event, persistence record, or model-visible state.

The shader samples a rasterization of the exact official DeepSeek fish SVG already rendered by the HeroShell, then layers a denser cyan particle distribution into that mark behind the idle composer. It remains part of the same pointer-distorted field, rather than an image asset or a separate scene, so the mark appears to drift and locally disperse with the existing ripple interaction.

## Alternatives considered

- **A stock particle component.** Declined because the available presets produce a generic starfield and would add interaction behavior not tied to the conversation state. The small OGL shader keeps the aesthetic and motion model local to the only surface that needs it.
- **A full Three.js scene.** Declined because this needs a single background plane, not a scene graph, camera, or asset pipeline. OGL is substantially smaller and avoids another React rendering abstraction.
- **A separate loading overlay.** Declined because it would create a new layer with focus and layout ownership. The root-owned pseudo-element uses the already-projected running state and leaves the transcript and composer in their existing tree.

## Consequences

Idle and blank conversation surfaces gain an interactive visual anchor, while running tasks gain stronger legibility without blocking input, selection, or extension slots. The canvas is capped at device-pixel-ratio 1.5 and removed cleanly on unmount to bound graphics cost.

The effect depends on a browser WebGL implementation. A browser without it, or a user who prefers reduced motion, keeps the ordinary themed background and receives no animation. OGL becomes a bundled permissively licensed third-party dependency of the conversation package.

## Testing

`skeleton.client.spec.tsx` asserts that the already-projected running state raises and clears the visual state without changing the resident conversation behavior. The package bundle compiles the OGL layer with the client entry.
