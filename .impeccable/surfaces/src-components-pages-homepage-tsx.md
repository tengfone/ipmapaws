---
version: 1
slug: "src-components-pages-homepage-tsx"
primary_target: "src/components/pages/HomePage.tsx"
related_targets: ["src/components/pages/RegionPage.tsx","src/components/pages/RegionServicePage.tsx"]
---

# Surface: IPMapAWS home, region and region/service pages

Mode: Operate. Audience: engineers identifying an IP, people building allow-lists, API consumers. Task order: answer "which AWS prefix contains this IP/CIDR?" first, then filter, copy and export. The owner approved trimming the API promo banner and the export summary statistics; every capability stays. Owner delegated the direction choice ("decide which is most impressive"); chosen: Cadastral Plat (pick card).

## Direction contract

THESIS: AWS address space is surveyed land. The page answers a lookup by drawing which parcel, inside which larger block, contains the address. It refuses the category default of a search bar over an undifferentiated table.

OWN-WORLD: Cool drafting-film ground #eef0ec (not cream), survey ink #1d2b36, survey orange #c2410c for the queried point and the matched lot only, sage #7c8a6e (with a light tint) for lots and region labels. Dark theme: night ink ground #11181d, chalk lines #d9dfd8, same orange and sage. Rules are 1px survey linework; lots are hatched or tinted, never shadowed. Workhorse sans for UI, a tabular mono for every prefix and figure, small caps for lot and block labels.

STORY: The visitor pastes an address, sees its lot drawn to scale inside its block, reads region, service and border group, copies the prefix, then filters the lot register below and exports CSV, or follows API docs.

FIRST VIEWPORT: Top nav (IPMapAWS wordmark, Regions, API docs, GitHub, theme toggle). Left 5/12: H1 "Which AWS prefix contains this IP?", input with Look up, the result record (prefix, region, service, border group, Copy) and further matches. Right 7/12: the parcel strip SVG, bands from the containing ranges down to the matched lot with the IP as an orange point. One freshness line under both ("AWS data from <createDate> UTC · refreshed hourly"). Below the fold: filter row, then the lot register table with count and Export CSV.

FORM: Cadastral Plat, position 1 on my ordered list (IMPECCABLE'S PICK). seed:24486bac1f1409e3. Raises kept: fixed tonal ramp for neutrals; 1px ruling; copy and export stamp their state in place; region labels never shrink; region index reflows in whole cells.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
