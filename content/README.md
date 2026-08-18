# Editing this site

Everything you can read on the site lives in this folder. Nothing here is
code — change a file, and that part of the site changes. You never need to
open the `app/` or `components/` folders to change words.

## The fastest way to edit

1. Go to this folder on GitHub
2. Click the file you want to change
3. Click the pencil icon
4. Edit, then click **Commit changes**

The site rebuilds and goes live on its own, usually within a minute. That
is the whole loop — no terminal, no local setup, no cost.

## What each file does

| File | Section | Format |
|---|---|---|
| `intro.md` | Intro | Markdown — just write |
| `projects.json` | Projects | A list of projects |
| `learnings.json` | Stuff I learned | A list, newest shown first |
| `thoughts.md` | Train of thought | Markdown — use `##` for separate pieces |
| `contact.json` | Sticky note + email | Note, email, and links |

## The `.md` files

Write normally. Blank line between paragraphs. `**bold**`, `*italic*`,
`[link text](https://url.com)`, `- bullet`, `## heading`. That is most of it.

## The `.json` files

These are stricter — they need their punctuation exactly right:

- Every piece of text goes in `"double quotes"`
- Items are separated by commas, but the **last** item has no comma after it
- `null` means "nothing here" and does **not** take quotes

To add a project, copy an existing block and change the text:

```json
{
  "name": "Thing I made",
  "description": "One line about it.",
  "href": "https://link-to-it.com",
  "thumbnail": null
}
```

`href` can be `null` if there is nowhere to link. `thumbnail` can be `null`,
or the name of an image you put in `public/images/` — for example
`"/images/my-project.jpg"`.

### Adding to "Stuff I learned"

Add a block at the top of `learnings.json`:

```json
{
  "title": "The thing you learned",
  "href": "https://where-you-learned-it.com",
  "date": "2026-08-17",
  "note": null
}
```

The date must be `YYYY-MM-DD`. You do not need to touch the "last updated"
line on the site — it reads the newest date in this file and works itself
out. Order in the file does not matter either; the site sorts by date.

## If something breaks

A missing comma or quote in a JSON file will stop the site from building.
GitHub shows a red ✗ next to your commit if that happens. The fix is
almost always a comma — either one missing, or one too many after the last
item. Your previous version stays live until the new one builds cleanly, so
a typo can't take the site down — it just means your edit hasn't appeared yet.
