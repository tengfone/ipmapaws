---
name: IPMapAWS
description: AWS address space drawn as surveyed land; a lookup answers with the parcel that contains the address.
colors:
  ground: "#eef0ec"
  paper: "#f8f9f6"
  ink: "#1d2b36"
  ink-2: "#4f5d67"
  on-ink: "#eef0ec"
  rule: "#c3cac2"
  rule-2: "#dde1da"
  mark: "#c2410c"
  mark-ink: "#b13a0a"
  sage: "#7c8a6e"
  sage-ink: "#4e5b43"
  sage-tint: "#dfe5d6"
  danger: "#a3222d"
  ground-dark: "#11181d"
  paper-dark: "#162026"
  ink-dark: "#d9dfd8"
  ink-2-dark: "#9ba79f"
  rule-dark: "#34434c"
  rule-2-dark: "#212c33"
  mark-ink-dark: "#f07a45"
  sage-ink-dark: "#a9b998"
  sage-tint-dark: "#222d22"
  danger-dark: "#f08a90"
typography:
  display:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  prefix-hero:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontFeature: "'zero' 1, 'tnum' 1"
  headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  note:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'zero' 1, 'tnum' 1"
  plat-label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "2px"
  md: "3px"
  lg: "4px"
spacing:
  gutter-phone: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "48px"
  column-gap: "48px"
  section-gap: "56px"
  control: "40px"
  control-sm: "32px"
  control-lookup: "48px"
  register-row: "42px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.sage-tint}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-stamped:
    backgroundColor: "transparent"
    textColor: "{colors.sage-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  input-lookup:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  region-label:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    width: "8.5rem"
  region-chip-selected:
    backgroundColor: "{colors.sage-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "2px 4px 2px 8px"
  register-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    height: "42px"
  register-row-matched:
    backgroundColor: "{colors.sage-tint}"
    textColor: "{colors.mark-ink}"
  matched-lot-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px 16px"
  plat-figure:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  page-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.md}"
    height: "32px"
    width: "32px"
---

# Design System: IPMapAWS

## Overview

**Creative North Star: "The Cadastral Plat"**

AWS address space is surveyed land. A lookup is answered the way a land registry answers a parcel query: by drawing which lot, inside which larger block, contains the address, to scale. The interface is a drafting sheet on a cool film ground, ruled in 1px survey ink, with one survey-orange mark for the point in question and sage for the lots that exist. Everything else is the register: numbered lots, mono figures, plain labels.

Density is operational, not decorative. The reader is mid-task next to a terminal or a firewall console, so the answer sits at the top left, the plat sits beside it, and the lot register runs full width below. Hierarchy comes from ruling weight (ink rules divide sections, pale rules divide rows), from type weight, and from the one reserved color, never from cards, shadows or tinted panels stacked on each other.

The system refuses the category default of a search bar floating over an undifferentiated table. Neutrals are a fixed tonal ramp; linework is 1px; lots are hatched or tinted, never shadowed.

**Key Characteristics:**
- Cool drafting-film ground (not cream) with survey-ink linework, and a night-ink dark theme on the same roles.
- Survey orange is reserved for the queried point and the matched lot, nothing else.
- Every prefix, address, count and figure is set in a tabular, slashed-zero mono.
- Sections are divided by full-width 1px ink rules; rows by pale rules.
- Flat: depth is drawn (hatching, outlined windows, dashed fans), not cast.

## Colors

A cool grey-green survey sheet in two values of ink, one reserved orange, and a sage family for everything AWS publishes.

### Primary
- **Survey Orange** (mark): the fill of the queried point, the matched lot's position inside each block band, the CIDR query span (at 22% tint with a 1.5px orange stroke) and the legend swatches for those two things. Identical in both themes.
- **Survey Orange, text weight** (mark-ink; mark-ink-dark in the dark theme): the same reservation set as text: the matched lot's band label in the plat, the queried address label under its leader, the "Matched lot" label in the result record, and the prefix of the matched row in the register. The dark value is a contrast lift of the fill, not a second accent.

### Secondary
- **Lot Sage** (sage): published AWS prefixes. Hatch strokes in the plat, the 1.5px outline of the lot band, region-label borders, link underline decoration, selection highlight (38% mix).
- **Sage Ink** (sage-ink / sage-ink-dark): sage as text. Lot numbers in the register, stamped "Copied" and "Exported N rows" states, method and success-status badges in the API docs, checked checkboxes.
- **Sage Tint** (sage-tint / sage-tint-dark): the hatch ground, the lot band body, the matched register row, hover fill for outline buttons, menu options and index cells.

### Neutral
- **Drafting Film** (ground / ground-dark): page background, scrollbar track, theme-color meta.
- **Sheet** (paper / paper-dark): surfaces that hold drawn or entered matter: the plat figure, the matched-lot record, inputs, popovers, the block band body.
- **Survey Ink** (ink / ink-dark): primary text, section rules, block band outlines, primary button fill, focus outline.
- **Second Ink** (ink-2 / ink-2-dark): secondary text, sizes and tick addresses in the plat, placeholders, inactive sort headers, the dashed enlargement fans.
- **Ruling** (rule / rule-dark): default border colour for every element, quarter lines inside block bands, input and quiet-button strokes.
- **Pale Ruling** (rule-2 / rule-2-dark): register row dividers and skeleton bars.
- **On Ink** (on-ink): text on ink fills; equals the ground of its theme.
- **Danger** (danger / danger-dark): error borders, error headings, failed export state. Never used decoratively.

### Named Rules
**The Survey Orange Rule.** Orange marks exactly two things: the queried point and the matched lot (with its "Matched lot" label and its row in the register). Fills use mark; orange text uses mark-ink, which lifts to mark-ink-dark on the night ground. If something orange is neither the point nor the lot, it is wrong.

**The Sage Is Published Rule.** Sage means "AWS publishes this": lots, regions, stamped success. Sage never marks the query and never decorates.

**The Fixed Ramp Rule.** Neutrals come from the ramp (ground, paper, ink, ink-2, rule, rule-2). Do not invent intermediate greys; a new surface picks a ramp step. The one sanctioned derivative is the 85% ink hover on ink fills.

## Typography

**Display Font:** Public Sans (with ui-sans-serif, system-ui)
**Body Font:** Public Sans
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** A plain public-sector workhorse sans for words, a tabular mono for every number a reader might copy. The pairing reads like a registry sheet: labels in sans, values in mono.

### Hierarchy
- **Display** (700, 26px on phones to 28px, 1.2, -0.015em): one per page, the page question or title ("Which AWS prefix contains this IP?", region titles, Page not found). Region names inside it switch to mono.
- **Prefix Hero** (mono 600, 26px to 30px, tight, -0.02em): the matched lot's prefix in the result record. The largest figure on the page.
- **Headline** (700, 1.125rem, -0.01em): section heads above an ink rule (Prefix register, Regions, endpoint summaries), paired on the baseline with a mono count.
- **Body** (400, 0.9375rem, 1.5): running copy, capped near 60 to 72ch.
- **Control** (600, 0.875rem): buttons and actions; 13px for small buttons and text actions.
- **Note** (400, 13px; 12px for legends, column heads and field labels): captions, hints, freshness line, breadcrumbs.
- **Data** (mono, 13px; 14px in lot rows, 18px to 20px in the lookup input): prefixes, addresses, regions, border groups, counts, page numbers.
- **Plat Label** (700, 11px, 0.08em, uppercase): block and lot names in the plat label row only ("BLOCK", "LOT", "IPV4 SPACE"), followed by the CIDR in mono 600 with no tracking.

### Named Rules
**The Mono Figure Rule.** Every prefix, address, count, region code and figure is mono, with tabular numerals and a slashed zero. Words are sans.

**The Region Label Rule.** Region labels are mono 12px in a 1px sage border, at least 8.5rem wide, and never shrink or wrap.

## Layout

A centred column up to 1440px with 16px gutters on phones, 24px from 40rem and 48px from 64rem. Lookup surfaces use a 12-column grid at lg: the question, input and result record take 5 columns, the plat takes 7, with a 48px column gap; below lg they stack, answer first. A single freshness line runs under both columns.

Below the fold, each section opens with a full-width 1px ink rule, 56px above it (48px on region pages) and 24px of air under it, then a headline row with its count and action aligned on the baseline. The register is full width; filters sit in one wrapping row (search 22rem, selects 13rem at lg). Index grids (regions, services) are auto-fill grids of whole cells (11.5rem and 16rem minimums) ruled on all sides, so they reflow by whole cells rather than squeezing.

Controls are 40px tall, small controls 32px, the lookup input and its button 48px. Register rows are 42px.

### Named Rules
**The Whole Cell Rule.** Index grids reflow in whole ruled cells; a cell never narrows below its minimum to fit one more column.

## Elevation & Depth

Flat. Surfaces sit on the ground with a 1px rule and nothing beneath them; depth inside the plat is drawn: 45-degree sage hatching for published lots, an ink outline for the window the next band enlarges, and dashed ink-2 fans leading down to the enlargement.

### Shadow Vocabulary
- **Open popover** (`box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.35)`): the multi-select dropdown while open. The only shadow in the system.

### Named Rules
**The Drawn Depth Rule.** Lots are hatched or tinted, never shadowed. The single permitted shadow belongs to a popover that is open over other content.

## Shapes

Near-square drafting corners: 2px for labels, chips and text-action focus rings, 3px for buttons, inputs and pagination cells, 4px for record cards and the plat figure. Everything is outlined with 1px linework; the lot band carries a 1.5px sage stroke and the CIDR query span a 1.5px orange stroke. The lookup input and its button join into one 48px bar, square on the inside edge. The only round shapes are the queried point (r 4.5 with a paper halo) and the loading pulse dot.

## Components

### Buttons
Squared, inked and quiet.
- **Shape:** drafting corner (3px).
- **Primary:** ink fill, on-ink text, 600 weight, 40px tall with 16px padding; hover lightens to 85% ink.
- **Outline:** 1px ink stroke on transparent, hover fills sage tint.
- **Quiet:** 1px rule stroke, hover darkens the stroke to ink. Used for the theme toggle and pagination arrows.
- **Text action:** 13px semibold ink with a sage underline (4px offset) that darkens to ink on hover ("Copy", "Show in register", "Try" queries).
- **Focus:** 2px ink outline, 2px offset, on every interactive element.

### Copy and Export (stamp in place)
- Copy stamps "Copied" in sage ink in the same spot for two seconds; the button variant turns its stroke sage ink, the text variant drops its underline.
- Export CSV is a primary button that becomes an outline stamp in place: "Exporting…" with a spinner, then "Exported N rows" in sage ink, or the error in danger. It never opens a toast.

### Chips
- **Region chip (selected filter):** mono 12px, 1px sage border, sage-tint fill, 2px corner, with a remove control.
- **Service chip:** the same in rule border on paper.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** paper on ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px ink for the answer (matched lot, not-found note), 1px rule for supporting matter (plat figure, inside-range list, region footprint notes), 1px danger for errors.
- **Internal Padding:** 12px top, 16px sides; internal sections split by 1px rule lines.

### Inputs / Fields
- **Style:** paper fill, 1px rule stroke, 3px corner, 40px tall; hover darkens to ink-2, focus to ink. Placeholders in ink-2.
- **Lookup input:** mono 18px to 20px, 48px tall, ink stroke, joined to the Look up button.
- **Error:** danger stroke and a danger-bordered alert under it.
- **Selects:** the same field shape with a chevron; the open list is a paper popover with an ink border, mono options and sage-ink checkboxes.

### Navigation
- 56px header ruled underneath. Wordmark "IPMap" bold plus "AWS" regular, 17px. Nav links are 14px medium ink with a sage underline on hover (6px offset); GitHub collapses to its mark on phones; the theme toggle is a quiet 36px square.
- Breadcrumbs: 13px ink-2, slash separators, the current page in mono ink.
- Pagination: 32px mono cells; the current page is an ink-filled cell; arrows are quiet cells.

### Lot Register (signature)
A ruled table, ink rules top and bottom and under the head, pale rules between 42px rows. The first column is "Lot no.", a sage-ink running number that continues across pages. Prefixes are mono medium; regions use the region label; versions and border groups are ink-2. The matched row fills sage tint and sets its prefix in survey orange text. Column heads are 12px semibold with sort arrows; the active one goes ink.

### Matched Lot Record (signature)
The answer card: the prefix in Prefix Hero, a line under it with "Matched lot" in orange text then the first-to-last address range and size in mono, a Copy prefix button, then a ruled definition grid (region labels, services joined by middots, border group in mono), then text actions. Records that share a prefix are grouped into this one lot, with their services and regions listed together; further containing lots follow as compact ruled rows, most specific first.

### Parcel Strip (signature)
The plat. Bands stack top to bottom, each the outlined window of the band above enlarged to full width, drawn to scale at the measured width so text stays at its real size. Each band has a label row above it (plat label plus mono CIDR on the left, size in mono on the right, then services and regions for the lot), the band body (paper with ink stroke for blocks, sage tint with a 1.5px sage stroke for the lot), quarter lines, hatched published prefixes, the orange matched-lot position, and mono quarter addresses below. The queried point settles onto the last band (6px drop, 520ms, cubic-bezier(0.16, 1, 0.3, 1)), its only authored motion, removed under reduced motion. A legend and a scale note sit under the drawing.

### Named Rules
**The Label Row Rule.** Plat labels sit in a row above each band, never inside it. A tick label that would collide with a leader line or a neighbour is dropped, never overlapped or shrunk.

**The One Lot Rule.** Records that share a prefix are one lot. Group them; list their services and regions together; never repeat the prefix as separate answers.

**The Numbered Lot Rule.** Register rows are numbered as lots, in sage ink, continuing across pages.

**The Stamp In Place Rule.** Copy and export report their state in the control that was pressed, in sage ink or danger, and then return to rest. No toasts.

## Do's and Don'ts

### Do:
- **Do** reserve survey orange for the queried point and the matched lot, its "Matched lot" label and its register row; fills in mark, text in mark-ink (the lifted mark-ink-dark on the night ground).
- **Do** group records that share a prefix into one lot.
- **Do** put plat labels in a row above each band and drop a colliding tick label rather than overlap it.
- **Do** number register rows as lots, in sage ink.
- **Do** set every prefix, address, count and figure in the mono with tabular numerals and slashed zero.
- **Do** open each section with a full-width 1px ink rule and a headline paired with its mono count.
- **Do** keep region labels at their full width (8.5rem minimum, no wrap) and let index grids reflow in whole cells.
- **Do** stamp copy and export results in place.

### Don't:
- **Don't** use orange for links, hovers, focus, headings, badges or any status other than the point and the matched lot.
- **Don't** cast shadows on cards, bands, lots or rows; the open popover is the only shadow.
- **Don't** set labels or figures inside a plat band, and don't scale the plat down so its text shrinks.
- **Don't** introduce warm or cream grounds, or greys outside the fixed neutral ramp.
- **Don't** use uppercase tracked labels outside the plat label row.
- **Don't** use corners larger than 4px on surfaces or controls.
