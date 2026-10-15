# Marquee

**Live demo:** https://marquee-1088237017332.us-central1.run.app (open a sample venue for an instant replay; live plans are limited to 3 per visitor a day)

A programming assistant for independent venues. Tell it what kind of venue you run, where, what recently filled the room and, if you like, the titles you can actually book. An agent asks Qloo what people with your regulars' taste gravitate to, checks which titles land in your city, and returns a month of dated events, a verdict on every title you could book, local places to co-promote with, and the evidence behind each choice. Then it plans the same month again without Qloo and shows where the two plans part ways, so you can see what Qloo changed.

## The problem

Independent cinemas, bookshops and music bars programme by instinct. Their owners know what worked last month but not what the people who came would like next, and a night that misses costs them a month's margin. The taste data that would help lives in tools built for chains and brands. Marquee gives a one-person venue the same read in about two minutes, and says plainly what that read can and cannot tell them.

## How Qloo is used

Marquee is an agent (Claude) that calls Qloo through the event's supported `qloo mcp` server.

| Step | Qloo tool | What it answers |
|---|---|---|
| Resolve the recent hits | `qloo_describe` | Which Qloo entity "Aftersun" is, when three films share the title. |
| Discover by taste | `qloo_recommend` with the hits as `signals` and no location | What people who liked these titles gravitate to: the core of the programme. |
| Check locally | `qloo_rank` of the taste picks with the hits as signals plus `signal_location`, no audience signal | Your regulars' taste as it plays in the venue's city. A programme with a taste pick that never went through this check is sent back. |
| Judge what the venue can book | `qloo_rank` of the venue's own shortlist, once on taste and once with the location | The decision the owner actually makes: which of the titles on offer this month suit these regulars, and which suit the city. A resolved title that is not the work the venue meant is marked "check the title", not judged. |
| Fill broader slots | `qloo_recommend` with `signal_location` and tag filters only | A family matinee or crowd night, labelled as a local crowd-pleaser rather than a pick for this audience. |
| Find co-promotion partners | `qloo_recommend` with `target_type: "place"`, the hits as signals, `filter_location` and a place-category tag | Bars and cafés in the city whose audiences share the venue's taste: film to cocktail, book to bar. |
| Check the audience | `qloo_audience_demographics` for the lead picks | Whether the picks' audiences lean towards the venue's own audience (kept out of the local ranking, so the city ranking is about taste and place, not age). |
| Suggest a soundtrack (cinemas and bookshops) | `qloo_recommend` with `target_type: "artist"` and the hits as signals | Musicians with high affinity for the taste, for a pre-show playlist or a themed night. A music bar's own programme is already artists, so it gets none. |
| Show the difference | none: the same model, with the same programme rules, plans twice with no Qloo tools | Where the plans differ beyond the run-to-run noise, the night each plan pushes, and Marquee's cited reason for each differing verdict. Marquee alone also gets the instructions for using Qloo's data (research order, how to read scores, ties and audience skews, the push night as a strong taste fit) and the code checks that can send its plan back up to twice, so a difference measures Qloo's data together with those. |
| Check timing and place (optional) | `qloo_trends`, `qloo_where_popular` | Available to the agent for a rising title or where in the city an audience sits; trend series whose values never move are flagged as missing data. |

Taste comes first because of what the live data showed. Asked for films like *Past Lives*, *Perfect Days* and *Aftersun* with Madrid as the location plus the venue's audience and two mood tags, Qloo led with summer blockbusters. With no location, it returns twenty arthouse dramas. Both lists are made of widely known titles; what separates them is the kind of film. So Marquee uses taste to find candidates and the city to test them.

## What the venue sees

- **A three-line summary for the owner**: what the month is, which bookable titles to take or pass, and the one night to push hardest.
- **A verdict on every bookable title**: programmed, featured (played, not booked), reserve, skip or check the title, each with a plain reason citing the Qloo calls. The reasoning behind it is one click away.
- **A dated month of events** with start and end times (trailers and intervals included) that fit local custom and the calendar: public holidays, festivals in the venue's field, local retail peaks and, for cinemas where films are usually dubbed, the version (original with subtitles or dubbed). Each is labelled by where it came from: the venue's list, a taste pick (with a reminder to check availability), a local crowd-pleaser or a reprise, plus a confidence level and its evidence.
- **Taste against city, per title.** A dumbbell chart puts each title's position by taste (ring) and in the city (dot) on the same axis. Positions come from one ranking each, so it never compares scores across calls, and a title Qloo has no local data for says so instead of looking weak. A table carries the same numbers.
- **With and without Qloo.** The same model, with the same programme rules and no Qloo tools, plans the month twice. The page first lists what Qloo told Marquee that the control could not know (how many bookable titles it ranked in the city, which audiences it profiled, the places and musicians it found), then how much the two control runs differ from each other, and only the differences both control runs agree on, each with Marquee's cited reason. It grades neither plan: ranking the control by Qloo would only measure agreement with Qloo. The two control runs often differ from each other (different push nights, different titles from outside the list): that is the noise the page shows before any difference.
- **Co-promotion partners, a soundtrack (cinemas and bookshops) and an audience check**: two or three local bars, cafés or restaurants. Qloo's place search takes the venue's location and returns places across the area; the agent keeps those whose addresses are nearby and is told never to suggest a competitor (no bars for a bar). Each partner has a concrete offer tied to an event; five musicians with high affinity for the taste; and, in plain words, who the lead picks' audiences lean towards and what that changes in the plan.
- **The research trail.** Every Qloo call with its parameters, a plain-language label, the scores as bars (blue for taste-only calls, amber for calls with a location, near-ties marked), and the raw result behind a toggle.
- **Exports**: an `.ics` calendar and the programme as text.

Every event cites the calls that support it (q1, q2, …), and each citation links to its step in the trail. Code then checks the programme before it is accepted: the number of events, dates inside the month on the weekday named, featured titles that Qloo actually returned, citations of calls that actually happened, and a hold reason for every held title that checks out against the rankings, audience profiles or popularity (a title no ranking scored can be held only as Marquee's labelled judgement, never because others have data). A programme that fails goes back to the agent up to twice with the problems listed; if it fails a third time, it is shown with those problems at the top of its limits.

## From request to result

One live run, from 15 October 2026, step by step: the cinema sample the demo opens on. It shows the requests and the agent's decisions. Qloo's results are cached privately on the server and shown in the app's research trail, never stored in this repository (Qloo's terms keep response data out of public repositories); the demo replays this run, results included.

**Input.** A cinema in Lavapiés, Madrid; recent hits *Past Lives*, *Perfect Days* and *Aftersun*; audience "people 25-34"; eight events in November 2026, Thursday to Sunday evenings, one family matinee; and ten films it can book: *Anora*, *The Brutalist*, *Conclave*, *The Substance*, *Robot Dreams*, *Flow*, *Society of the Snow*, *Wicked*, *Inside Out 2* and *Challengers*.

| Call | Tool and parameters | Outcome | What the agent did with it |
|---|---|---|---|
| q1, q2 | `qloo_describe` `{entity: "Past Lives" / "Perfect Days", type: "movie"}` | ok, one exact match each | Kept their handles for every later call. |
| q3 | `qloo_describe` `{entity: "Aftersun", type: "movie"}` | needs_input: several films share the title | Chose the 2022 drama the venue meant, and said so. |
| q4 | `qloo_recommend` `{target_type: "movie", signals: [3 hits], limit: 20}` | ok, 20 films | The taste discovery list. |
| q5, q6 | `qloo_rank` of the ten bookable films by name, on taste and in Lavapiés | needs_input: two titles each match several films | Picked the recent releases and asked again. |
| q7 | `qloo_recommend` `{target_type: "place", filter_location: "Lavapiés, Madrid", include_tags: ["urn:tag:category:place:bar"], limit: 10}` | ok, 10 places | Kept three whose addresses are in Centro, near the venue, each with an offer tied to a dated event. |
| q8 | `qloo_recommend` `{target_type: "artist", signals: [3 hits], limit: 10}` | ok, 10 musicians | Five for the pre-show soundtrack. |
| q9 | `qloo_rank` of the bookable films on taste, no location | ok, all ten | The shortlist's taste order. |
| q10 | the same with `signal_location: "Madrid"`, no audience signal | ok, six of ten ranked | The shortlist's taste as it plays in Madrid; the four with no signal there were not held against it. |
| q11 | the strongest discovery picks, same signals and city | ok, two ranked | One became the month's off-list pick, marked "check availability". |
| q12, q13 | `qloo_audience_demographics` for two lead picks | two profiles | Pitched the push night at the younger end of the venue's 25-34 audience, and sold the other pick, whose audience is below average at 25-34, as the family matinee. |

**Programme.** Eight dated events, six of them on a Friday or Saturday and one Sunday family matinee: seven from the venue's list and one taste pick from outside it. The push night is a Saturday, a strong fit both on taste and in Madrid. The long film gets an early Saturday slot with an interval, and the wordless animation plays at Sunday midday with no dubbing needed. Seven bookable films are programmed and three held in reserve, each with a hold reason the code checked against the rankings. Partners: three places near the venue. Soundtrack: five musicians.

**Without Qloo.** The same model, with the same programme rules and no Qloo, planned the month twice. Both runs booked a film Marquee holds in reserve, neither chose Marquee's off-list pick, and the two runs pushed two different nights, neither of them Marquee's.

**Cost.** Thirteen Qloo calls, about 200,000 input tokens (76% read from the prompt cache) and 28,000 output tokens, both control runs included: $0.43 of Claude usage. A run takes about two minutes; the three samples cost $0.31–0.43 each.

## What we learned

- **Location, audience and mood-tag signals pull towards the mainstream.** With Madrid, a 25-34 audience and mood tags, Qloo leads with blockbusters; on taste alone, arthouse dramas. Marquee uses taste to find candidates and the city to test them.
- **On taste alone, a frontier model is about as good as Qloo for well-known titles.** We hid one of each sample venue's three hits and asked both to find it from the other two: Qloo placed the hidden hit at an average of #6.2 in its top 20 (median #5), Claude alone at #4.8 (median #2), nine cases; Claude alone did better. So Marquee does not lean on Qloo for "what is similar". It leans on what a model cannot know: how titles land in a given city and age group, who their audiences are, how widely known an act is, and which local places share the taste, all as numbers the code can check and the page can cite.
- **New releases are thin.** In October 2026 Qloo resolved ten 2025 films by name but ranked none of them, on taste or in Madrid (it does score some 2025 titles). Marquee says so instead of guessing; the cinema sample uses 2024 titles, which Qloo scores reliably.
- **Missing is not low.** Qloo ranks only the titles it has a local signal for, and niche titles often have none (in the samples, Madrid ranks 6 of 10 bookable films; London ranks 5 of 10 bookable jazz acts but 9 of 10 discovery picks; New York ranks none of the bookshop's 10 bookable titles and 4 of 10 discovery picks). Marquee shows them as not ranked, never as weak.

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

Keys stay on the server: the Qloo key reaches only the `qloo mcp` child process, and neither key is sent to the browser, the model or a log. Daily caps bound what a public demo can spend: `MARQUEE_DAILY_RUNS` (default 25) in total and `MARQUEE_RUNS_PER_VISITOR` (default 3) per visitor. A run stops when its visitor leaves, and its planning stops once the model cost passes $0.50 (the two control runs, about $0.10 more, follow a finished plan); and identical requests are served from a cache.

## Limits

- Qloo results describe what groups of people tend to like in aggregate. They are not predictions about any person and say nothing certain about attendance.
- Marquee has no ticket-sales, capacity, rights or pricing data; the programme is a starting point to test, not a forecast of revenue.
- Scores from separate Qloo calls are not on a common scale. Marquee never ranks titles across calls, and its taste-versus-city chart compares positions within each ranking, not scores.
- Qloo ranked none of the ten 2025 films we tried (in October 2026), though it does score some 2025 titles, and it matched some 2025 books to the wrong work; plans for brand-new titles rest on the agent's judgement, and it says so.
- Popularity is how widely known a title is in Qloo's catalogue; it says nothing about availability, and Marquee uses it only as a hint of an act's fee.
- Neighbourhoods such as Lavapiés, Peckham and Brooklyn return nothing as a ranking signal, so rankings fall back to the city and say so (for the Brooklyn bookshop, New York ranked some discovery picks and none of the bookable titles); they do work as a place filter, so partners can be local.
- Qloo has local data for fewer niche titles than popular ones: in the samples, Madrid ranks six of ten bookable films and London five of ten bookable jazz acts. A taste pick without local data is shown as such, not dropped.
- Qloo trend data on the event API needs a window of about six months or more and does not cover books, so bookshop programmes skip the momentum check.
- The agent's formats, pairings and dates are its own judgement, and the app labels them that way.

## Responsible use

Marquee sends Qloo only places, titles, artists, tags and broad audience descriptions such as "students" or "people 25-34". It never sends or asks for personal data, and it does not infer anything about individuals. Qloo results are cached privately on the server to save repeat calls and are never committed to this repository; the sample venues in `samples/venues.json` are inputs only.

## Licence

MIT. See [LICENSE](LICENSE).
