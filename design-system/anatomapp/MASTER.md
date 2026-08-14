# AnatomApp — Master Design System

## Direction

An original gamified anatomy-learning interface: tactile and encouraging like a modern language-learning app, but visually rooted in anatomical atlases and medical education. Do not copy Duolingo characters, colors, illustrations, or layouts.

## Visual language

- Muscle burgundy is the primary action and progress color.
- Warm bone white is the background and reading surface.
- Brass gold marks XP, streaks, and exceptional progress.
- Clinical green is reserved for correct answers and completed work.
- Real anatomical imagery provides subject identity; never add skeleton line art, coordinate grids, or decorative Latin labels.
- Use rounded, substantial surfaces with a visible 3–5 px lower edge to make controls feel pressable.

## Core tokens

| Role | Light | Dark | Existing token |
|---|---:|---:|---|
| Background | `#F8F6F3` | `#12100F` | `--bg` |
| Card | `#FFFFFF` | `#1B1816` | `--card` |
| Raised/muted | `#F1EDE8` | `#25211E` | `--card2` |
| Text | `#1B1715` | `#F5F1ED` | `--ink` |
| Secondary text | `#756D67` | `#A89F98` | `--mut` |
| Border/depth | `#E6DFD8` | `#302A26` | `--line` |
| Muscle primary | `#A72636` | `#A72636` | `--red` |
| Muscle depth | `#741923` | `#741923` | `--reddk` |
| Reward gold | `#B57A2B` | `#B57A2B` | `--gold` |
| Correct | `#2D875C` | `#2D875C` | `--green` |

## Typography

- Headings, metrics, button labels: Nunito 800–900.
- Body, helper text, forms: Manrope 500–700.
- Latin anatomical terminology only: Lora italic.
- Maintain a clear 10/12/14/16/18/22/27 px scale; form inputs stay at least 16 px on mobile.

## Components

### Tactile cards

- 18–22 px radius, 2 px border, 4 px lower depth edge.
- Press moves the surface down 3 px and reduces the lower edge to 1 px.
- Use animation only to communicate state or entry; never animate dense data continuously.

### Primary actions

- Burgundy for the main next step; green only for known/correct/complete.
- Minimum touch size 44 px, visible focus ring, concise action-first label.
- One dominant action per screen.

### Progress

- Chunky 12–14 px tracks with a subtle inner highlight.
- Always pair color with a number, label, or icon.
- Keep XP, streak, completion, and correctness semantically separate.

### Personalized preparation

- The saved preparation goal changes the real study plan, not only its label: daily volume, accuracy target, and recommended training mode all follow the selected goal.
- Exam preparation uses 30 items, 80% accuracy, and prioritizes tests; credit preparation uses 20 items, 75% accuracy, and balanced flashcards; practical-class preparation uses 15 items, 70% accuracy, and prioritizes terminology recall.
- Users can review and change the goal from Profile. Changing it updates the current daily plan without discarding completed activity.
- Accounts without a saved goal use an explicit balanced fallback rather than pretending that the plan is personalized.

### Daily missions

- The Home screen shows three measurable tasks: completed training items, one completed session, and the accuracy target defined by the saved preparation goal.
- Mission completion and XP must be derived from saved learning activity; never display invented rewards or progress.
- Rewards are granted once per local calendar day and stored with a day-specific key: training items +30 XP, first session +15 XP, accuracy +25 XP.
- The Result screen separates training XP from mission bonuses and names every completed mission.
- Opening or syncing the app never advances the streak; only a completed learning session can start or extend it.
- Pair completed-green with a checkmark and text so status never relies on color alone.
- The seven-day activity row uses real session dates, highlights today with a gold outline, and remains readable at 320 px.

### Long-term ranks

- XP maps to eight transparent ranks without changing or resetting saved XP: Наблюдатель (0), Исследователь (300), Знаток систем (800), Практик анатомии (1500), Анатом (2500), Эксперт (4000), Наставник (6500), Мастер атласа (10000).
- The Profile screen names the current rank, shows the exact next threshold, and previews the previous/current/next steps.
- Rank-up feedback appears on the Result screen only when a completed session crosses a real XP threshold.
- At the maximum rank, progress stays at 100% and the interface says that the maximum has been reached; it never invents another target.

### Personal learning route

- The Home screen names one honest next action instead of presenting the last opened topic as generic progress.
- The route uses three observable stages: Material, Practice, and Pass. A stage is complete only when saved activity proves it.
- If the last topic is passed, the route advances to the next unfinished topic in the same module, then to the next ready module.
- The primary button opens material, starts a short practice, or launches the test depending on the saved state; users never have to guess what to do next.
- Course completion is derived from real passed-topic counts and receives a distinct completion state rather than an invented next lesson.

### Navigation

- Three top-level destinations: Study, Rating, Profile.
- Active destination uses a soft burgundy pill plus icon and text.
- Training screens hide global navigation and provide a clear close action.

## Motion and accessibility

- Press response: 80–120 ms. Screen/state transition: 180–340 ms.
- Respect `prefers-reduced-motion` and render the final state immediately.
- Normal text contrast is at least 4.5:1; meaningful graphical controls at least 3:1.
- Icon-only controls need accessible names. Decorative SVGs use `aria-hidden="true"`.
- Long names and dynamic values truncate or wrap without horizontal scrolling.
- Validate 320 px, 375 px, and landscape layouts in both themes.

## Avoid

- Duolingo brand green, owl mascot, copied lesson path, or copied reward artwork.
- Emoji as structural navigation or mode icons.
- Purple AI gradients, glass decoration without function, and random shadow scales.
- Skeleton line graphics, coordinate grids, and ornamental Latin labels.
- Flat controls with no press feedback, tiny targets, or color-only answer states.
