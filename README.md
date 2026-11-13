# The Corner Florist

Make a custom bouquet and send it to someone you love.

## Put it online (pick one)

**GitHub Pages**: create a public repo named `corner-florist`, upload everything in this folder, then Settings > Pages > Deploy from branch `main` / root. It goes live at `https://<you>.github.io/corner-florist/`.

**Netlify Drop**: drag this folder onto https://app.netlify.com/drop.

If the address isn't `https://awwwnuj.github.io/corner-florist/`, replace that address in the `og:` / `twitter:` / `canonical` tags at the top of `index.html` (and in `gift/index.html` and `group/index.html`) so link previews show the picture.

## Group bouquets

One link goes into a group chat. Every friend pulls one flower and writes one line. The person who started it wraps the bouquet and sends it, and the recipient taps any flower to see who picked it and what they wrote. They can save a Story-sized card with everyone's notes.

| Link | Who it's for |
| --- | --- |
| `group/#grp.<id>` | friends adding a flower (the `group/` page gives WhatsApp its own preview, `og-group.jpg`) |
| `#grp.<id>.<key>` | the organizer: invite, remove flowers, wrap and deliver. The key only lives in this link and the organizer's browser |
| `gift/#gg.<id>` | the recipient, once it's delivered |

Unlike a regular gift, a group bouquet can't live inside the link, so it is kept by a small API in `server/`:

- `server/api/group.js` is a Vercel function; `server/lib/group.js` has the rules (40 flowers max, names 24 characters, lines 120, only the organizer delivers, delivered bouquets are sealed).
- Each record is its own JSON file in a private Vercel Blob store, so friends adding at the same moment never overwrite each other.
- Live at `https://corner-florist-api.vercel.app/api/group` (project `corner-florist-api`, region `bom1`). `GROUP_API` near the top of `index.html` points at it.
- Only `https://awwwnuj.github.io` and `https://rupam870.github.io` may call it from a browser (`ALLOWED_ORIGINS` on the Vercel project, comma-separated). Add any new address there before hosting the site somewhere else.
- The project needs `BLOB_READ_WRITE_TOKEN` (added when the Blob store is connected) and `NODEJS_HELPERS=0` (the function reads its own request bodies).

**Try it locally**: `cd server && npm install && node dev.mjs`, then open http://localhost:8787. It serves the site and an in-memory copy of the API together.

**Redeploy the API**: from `server/`, `npx vercel deploy --prod` (or connect the repo to the Vercel project with `server` as the root directory).

## Sharing

Every link people send (a gift, a group invite, a finished group bouquet) gets **WhatsApp**, **Instagram** and, on phones, **More** buttons.

- WhatsApp opens with the message and link already typed: pick a chat and tap send.
- Instagram doesn't let websites pre-fill messages, so its button copies the message and opens the Instagram inbox to paste it.
- More opens the phone's share sheet; on a computer it's Copy.

Whoever receives a bouquet gets **Share picture** on their phone. It sends the bouquet card to an Instagram Story, WhatsApp status or any chat, with a caption linking back here, and copies the site link for an Instagram link sticker. On a computer it saves the image instead.

## Count visits (Mixpanel)

1. Create a free project at mixpanel.com and copy its Project Token.
2. In `index.html`, set `const MIXPANEL_TOKEN = 'your-token';`
3. Redeploy. Tracking stays off on localhost.

Events: Page Viewed (role: sender / recipient), Occasion Started, First Stem Picked, Wrap Started, Wrap Completed, Note Chosen, Gift Link Created, Gift Shared (method: whatsapp / instagram / share / copy), Preview Opened, Gift Opened, Flowers Taken, Ribbon Untied, Flower Fact Viewed, Image Saved, Image Shared, Make One Back Clicked. Each gift link carries a `gift_id`, so you can see how many sent gifts got opened.

Group bouquets add: Group Start Clicked (from: stall / gift / contributed / delivered / problem), Group Created, Group Viewed (role: organizer / friend), Group Flower Picked, Group Flower Added, Group Flower Removed, Group Invite Shared, Group Delivered, Group Result Shared, Group Note Viewed and Group Link Problem, all with a `group_id`. Page Viewed gets `group` and the roles `organizer` / `friend`; Gift Opened and Gift Shared get `group: true`. The viral loop to watch: invites shared per group, friends added per invite, and recipients who start one of their own.
