# Marquee

**Live demo:** https://marquee-1088237017332.us-central1.run.app (open a sample venue for an instant replay; live plans are limited to 3 per visitor a day)

A programming assistant for independent venues. Tell it what kind of venue you run, where, what recently filled the room and, if you like, the titles you can actually book. An agent asks Qloo what people with your regulars' taste gravitate to, checks which titles land in your city, and returns a month of dated events, a verdict on every title you could book, local places to co-promote with, and the evidence behind each choice. Then it plans the same month again without Qloo and shows where the two plans part ways, so you can see what Qloo changed.

## The problem

Independent cinemas, bookshops and music bars programme by instinct. Their owners know what worked last month but not what the people who came would like next, and a night that misses costs them a month's margin. The taste data that would help lives in tools built for chains and brands. Marquee gives a one-person venue the same read in about a minute, and says plainly what that read can and cannot tell them.

## How Qloo is used

Marquee is an agent (Claude) that calls Qloo through the event's supported `qloo mcp` server.

| Step | Qloo tool | What it answers |
|---|---|---|
| Resolve the recent hits | `qloo_describe` | Which Qloo entity "Aftersun" is, when three films share the title. |
| Discover by taste | `qloo_recommend` with the hits as `signals` and no location | What people who liked these titles gravitate to: the core of the programme. |
| Check locally | `qloo_rank` of that shortlist with `signal_location` and an optional broad `demographic` | Which of the taste picks also score in the venue's city. |
| Judge what the venue can book | `qloo_rank` of the venue's own shortlist, once on taste and once with the location | The decision the owner actually makes: which of the titles on offer this month suit these regulars, and which suit the city. |
| Fill broader slots | `qloo_recommend` with `signal_location` and tag filters only | A family matinee or crowd night, labelled as a local crowd-pleaser rather than a pick for this audience. |
| Find co-promotion partners | `qloo_recommend` with `target_type: "place"`, the hits as signals, `filter_location` and a place-category tag | Bars and cafés in the city whose audiences share the venue's taste: film to cocktail, book to bar. |
| Check the audience | `qloo_audience_demographics` for the lead picks | Whether the picks' audiences lean towards the venue's own audience. |
| Suggest a soundtrack | `qloo_recommend` with `target_type: "artist"` and the hits as signals | Musicians the audience over-indexes on, for a pre-show playlist or a themed night. |
| Show the difference | none: the same model, with the same programme rules, plans twice with no tools | Where the plans differ beyond the run-to-run noise, with Marquee's cited reason for each differing verdict. |
| Check timing and place (optional) | `qloo_trends`, `qloo_where_popular` | Available to the agent for a rising title or where in the city an audience sits; the sample runs do not need them. |

Taste comes first because of what the live data showed. Asked for films like *Past Lives*, *Perfect Days* and *Aftersun* with Madrid as the location plus the venue's audience and two mood tags, Qloo returned the city's most popular titles: all twenty scored within 0.03 of each other, every one with a popularity above 0.97. With Madrid alone the list was less extreme but still leaned popular; with no location, it returns twenty arthouse dramas. So Marquee uses taste to find candidates and the city to test them.

## What the venue sees

- **A three-line summary for the owner**: what the month is, which bookable titles to take or pass, and the one night to push hardest. The reasoning behind it is one click away.
- **A dated month of events** with start and end times that fit local custom (a late show at 22:30, a family matinee at 17:00) and, for cinemas where films are usually dubbed, the version (original with subtitles or dubbed). Each is labelled by where it came from: the venue's list, a taste pick (with a reminder to check availability), a local crowd-pleaser or a reprise, plus a confidence level and its evidence.
- **A verdict on every bookable title**: programmed, reserve, skip or not found, with one sentence of reasons citing the Qloo calls.
- **Taste against city, per title.** A dumbbell chart puts each title's position by taste (ring) and in the city (dot) on the same axis. Positions come from one ranking each, so it never compares scores across calls, and a title Qloo has no local data for says so instead of looking weak. A table carries the same numbers.
- **With and without Qloo.** The same model, with the same programme rules and no tools, plans the month twice. The page first lists what Qloo told Marquee that the control could not know (how many bookable titles it ranked in the city, which audiences it profiled, the places and musicians it found), then how much the two control runs differ from each other, and only the differences both control runs agree on, each with Marquee's cited reason. It grades neither plan: ranking the control by Qloo would only measure agreement with Qloo. For the cinema sample the two control runs agreed on all nine of their titles, and both booked three films Marquee held in reserve; Marquee programmed three taste picks the control never chose.
- **Co-promotion partners, a soundtrack and an audience check**: two or three local bars or cafés chosen by address for nearness (the agent is told never to suggest a competitor), each with a concrete offer tied to an event; five musicians the audience over-indexes on; and, in plain words, who the lead picks' audiences lean towards and what that changes in the plan.
- **The research trail.** Every Qloo call with its parameters, a plain-language label, the scores as bars (blue for taste-only calls, amber for calls with a location, near-ties marked), and the raw result behind a toggle.
- **Exports**: an `.ics` calendar and the programme as text.

Every event cites the calls that support it (q1, q2, …), and each citation links to its step in the trail. Code then checks the programme before it is accepted: the number of events, dates inside the month on the weekday named, featured titles that Qloo actually returned, and citations of calls that actually happened. A programme that fails goes back to the agent once with the problems listed; if it fails again, it is shown with those problems at the top of its limits.

## From request to result

One live run, from 15 October 2026, step by step: the cinema sample the demo opens on. It shows the requests and the agent's decisions; Qloo's results stay on the server (its terms keep response data out of public repositories), and the demo replays this run, results included.

**Input.** A cinema in Lavapiés, Madrid; recent hits *Past Lives*, *Perfect Days* and *Aftersun*; audience "people 25-34"; eight events in November 2026, Thursday to Sunday evenings, one family matinee; and ten films it can book: *Anora*, *The Brutalist*, *Conclave*, *The Substance*, *Robot Dreams*, *Flow*, *Society of the Snow*, *Wicked*, *Inside Out 2* and *Challengers*.

| Call | Tool and parameters | Outcome | What the agent did with it |
|---|---|---|---|
| q1, q2 | `qloo_describe` `{entity: "Past Lives" / "Perfect Days", type: "movie"}` | ok, one exact match each | Kept their handles for every later call. |
| q3 | `qloo_describe` `{entity: "Aftersun", type: "movie"}` | needs_input: three films share the title | Chose the 2022 film that fits the venue, and said so. |
| q4 | `qloo_recommend` `{target_type: "movie", signals: [3 hits], limit: 20}` | ok, 20 films | The taste discovery list. |
| q5, q6 | `qloo_rank` of the ten bookable films by name | needs_input: *Anora* and *Wicked* each match several films | Picked the recent releases and asked again. |
| q7 | `qloo_recommend` `{target_type: "place", filter_location: "Madrid", include_tags: ["urn:tag:category:place:bar"]}` | ok, 10 places | Kept two in Centro, near Lavapiés, each with an offer tied to an event. |
| q8 | `qloo_recommend` `{target_type: "artist", signals: [3 hits], limit: 10}` | ok, 10 musicians | Five for the pre-show soundtrack. |
| q9 | `qloo_rank` of the bookable films on taste, no location | ok, all ten | The shortlist's taste order. |
| q10 | the same with `signal_location: "Lavapiés, Madrid"` | no results | Followed the result's note: Qloo does not resolve this neighbourhood, so it used the city. |
| q11 | the same with `signal_location: "Madrid"`, `demographic: "people 25-34"` | ok, six of ten ranked | The shortlist's local order; the other four have no signal there, which it did not count against them. |
| q12–q15 | `qloo_audience_demographics` for four lead picks | two with profiles | Sold the opener broadly rather than as a 25-34 draw, and put the film that leans young on a Friday date night. |

**Programme.** Eight dated events, Thursday to Sunday: six from the venue's list, a discovery pick and a double bill of two more, both marked "check availability". All are original version; the family matinee is a shortlisted animation with no dialogue, at noon on a Sunday, and the shortlisted title that tops the Madrid ranking gets the 22:30 late show on the Saturday before Madrid's 9 November holiday. Six bookable films are programmed and four held in reserve. Partners: two places near the venue, with addresses. Soundtrack: five musicians.

**Without Qloo.** The same model, with the same rules and no Qloo, planned the month twice. Its two plans agreed on all nine of their titles: nine of the ten bookable films, including three that Marquee held in reserve. Neither chose the three taste picks Marquee programmed.

**Cost.** Fifteen Qloo calls, about 133,000 input tokens (80% read from the prompt cache) and 15,000 output tokens, both control runs included: $0.23 of Claude usage. A run costs about $0.22–0.33.

## What we learned

- **Location and audience signals pull towards the popular.** With Madrid, a 25-34 audience and mood tags, Qloo returns the city's most popular titles; on taste alone, arthouse dramas. Marquee uses taste to find candidates and the city to test them.
- **On taste alone, a frontier model is about as good as Qloo for well-known titles.** We hid one of each sample venue's three hits and asked both to find it from the other two: Qloo placed the hidden hit at an average of #6.2 in its top 20, Claude alone at #4.8 (nine cases). So Marquee does not lean on Qloo for "what is similar". It leans on what a model cannot know: how titles land in a given city and age group, who their audiences are, how widely known an act is, and which local places share the taste, all as numbers the code can check and the page can cite.
- **New releases have no taste data yet.** In October 2026 Qloo resolved ten 2025 films by name but ranked none of them, on taste or in Madrid. Marquee says so instead of guessing; the cinema sample uses 2024 titles, the newest Qloo can score.
- **Missing is not low.** Qloo ranks only the titles it has a local signal for, and niche titles often have none (2 of 10 arthouse films in Madrid, 8 of 10 jazz artists in London). Marquee shows them as not ranked, never as weak.

## Run it

Requirements: Node.js 22.19 or newer, a Qloo hackathon key, and an Anthropic API key.

```bash
git clone https://github.com/guillermo-delrio/marquee.git && cd marquee
cp .env.example .env            # then add QLOO_API_KEY and ANTHROPIC_API_KEY
cd server && npm install && cd ..
cd web && npm install && npm run build && cd ..
cd server && npm start          # http://localhost:8787
```

Or with Docker, which serves the same app on port 7860 and runs each sample venue once at start-up so it replays instantly:

```bash
docker build -t marquee . && docker run --env-file .env -p 7860:7860 marquee
```

Without `QLOO_API_KEY` (or with `QLOO_MOCK=1`) the app runs on clearly labelled mock data, so the interface can be tried without a Qloo key. Tests: `npm test` in `server/` and in `web/`; with the server running, `npm run check-phone` in `web/` checks the phone layout.

Keys stay on the server: the Qloo key reaches only the `qloo mcp` child process, and neither key is sent to the browser, the model or a log. Daily caps bound what a public demo can spend: `MARQUEE_DAILY_RUNS` (default 25) in total and `MARQUEE_RUNS_PER_VISITOR` (default 3) per visitor. A run stops when its visitor leaves or its model cost passes $0.50, and identical requests are served from a cache.

## Limits

- Qloo results describe what groups of people tend to like in aggregate. They are not predictions about any person and say nothing certain about attendance.
- Marquee has no ticket-sales, capacity, rights or pricing data; the programme is a starting point to test, not a forecast of revenue.
- Scores from separate Qloo calls are not on a common scale. Marquee never ranks titles across calls, and its taste-versus-city chart compares positions within each ranking, not scores.
- Qloo has no taste data yet for recent releases (none of ten 2025 films was ranked in October 2026) and matches some 2025 books to the wrong title, so plans for brand-new titles rest on the agent's judgement, and it says so.
- Popularity is how widely known a title is in Qloo's catalogue; it says nothing about availability, and Marquee uses it only as a hint of an act's fee.
- Location signals work at the granularity Qloo resolves. Lavapiés and Peckham return nothing, so Marquee retries at city level and says the evidence is for the city; Brooklyn resolves.
- Qloo has local data for fewer niche titles than popular ones: in Madrid it scored two of ten arthouse films, in London eight of ten jazz artists. A taste pick without local data is shown as such, not dropped.
- Qloo trend data on the event API needs a window of about six months or more and does not cover books, so bookshop programmes skip the momentum check.
- The agent's formats, pairings and dates are its own judgement, and the app labels them that way.

## Responsible use

Marquee sends Qloo only places, titles, artists, tags and broad audience descriptions such as "students" or "people 25-34". It never sends or asks for personal data, and it does not infer anything about individuals. Qloo results are cached privately on the server to save repeat calls and are never committed to this repository; the sample venues in `samples/venues.json` are inputs only.

## Licence

MIT. See [LICENSE](LICENSE).
