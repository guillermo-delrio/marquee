# Marquee

A programming assistant for independent venues. Tell it what kind of venue you run, where, what recently filled the room and, if you like, the titles you can actually book. An agent asks Qloo what people with your regulars' taste gravitate to, checks which titles land in your city, and returns a month of dated events, a verdict on every title you could book, and the evidence behind each choice.

## The problem

Independent cinemas, bookshops and music bars programme by instinct. Their owners know what worked last month but not what the people who came would like next, and a night that misses costs them a month's margin. The taste data that would help lives in tools built for chains and brands. Marquee gives a one-person venue the same read in about a minute, and says plainly what that read can and cannot tell them.

## How Qloo is used

Marquee is an agent (Claude) that calls Qloo through the event's supported `qloo mcp` server.

| Step | Qloo tool | What it answers |
|---|---|---|
| Resolve the recent hits | `qloo_describe` | Which Qloo entity "Aftersun" is, when three films share the title. |
| Name the shared taste | `qloo_entity_tags` | The genres, moods and themes the hits share, which become programme themes. Tags meant for places (amenities, payment cards, hotel ratings) are dropped before the agent sees them. |
| Discover by taste | `qloo_recommend` with the hits as `signals` and no location | What people who liked these titles gravitate to: the core of the programme. |
| Check locally | `qloo_rank` of that shortlist with `signal_location` and an optional broad `demographic` | Which of the taste picks also score in the venue's city. |
| Judge what the venue can book | `qloo_rank` of the venue's own shortlist, once on taste and once with the location | The decision the owner actually makes: which of the titles on offer this month suit these regulars, and which suit the city. |
| Fill broader slots | `qloo_recommend` with `signal_location` and tag filters only | A family matinee or crowd night, labelled as a local crowd-pleaser rather than a pick for this audience. |
| Check timing and place | `qloo_trends`, `qloo_where_popular` | Whether a lead pick is rising, and where in the city its audience is. |

Taste comes first because of what the live data showed. Asked for films like *Past Lives*, *Perfect Days* and *Aftersun* with Madrid as the location (plus the venue's audience and two mood tags), Qloo returned the city's most popular titles: the list opened with two summer blockbusters, all twenty scored within 0.03 of each other, and every one had a popularity above 0.97. Asked without a location, it returns twenty arthouse dramas. A location signal swamps taste, so Marquee uses it to test the taste shortlist instead of to find it.

## What the venue sees

- **A dated month of events**, each labelled by where it came from: the venue's list, a taste pick (with a reminder to check availability), a local crowd-pleaser or a reprise, plus a confidence level and its evidence.
- **A verdict on every bookable title**: programmed, reserve, skip or not found, with one sentence of reasons citing the Qloo calls.
- **Taste against city, per title.** A dumbbell chart puts each title's position by taste (ring) and in the city (dot) on the same axis. Positions come from one ranking each, so it never compares scores across calls, and a title Qloo has no local data for says so instead of looking weak. A table carries the same numbers.
- **The research trail.** Every Qloo call with its parameters, a plain-language label, the scores as bars (blue for taste-only calls, amber for calls with a location, near-ties marked), and the raw result behind a toggle.
- **Exports**: an `.ics` calendar and the programme as text.

Every event cites the calls that support it (q1, q2, …), and each citation links to its step in the trail. Code then checks the programme before it is accepted: the number of events, dates inside the month on the weekday named, featured titles that Qloo actually returned, and citations of calls that actually happened. A programme that fails goes back to the agent once with the problems listed; if it fails again, it is shown with those problems at the top of its limits.

## From request to result

One live run, from 15 October 2026, step by step. It shows the requests and the agent's decisions; Qloo's results stay on the server (its terms keep response data out of public repositories). The demo runs each sample venue live once and then replays it, results included, under "Sample venues", so what you see there comes from a later run of the same steps.

**Input.** A cinema in Lavapiés, Madrid; recent hits *Past Lives*, *Perfect Days* and *Aftersun*; audience "people 25-34"; eight events in November 2026, Thursday to Sunday evenings, one family matinee; and ten films it can book: *Anora*, *The Brutalist*, *Conclave*, *The Substance*, *Robot Dreams*, *Flow*, *Society of the Snow*, *Wicked*, *Inside Out 2* and *Challengers*.

| Call | Tool and parameters | Outcome | What the agent did with it |
|---|---|---|---|
| q1, q2 | `qloo_describe` `{entity: "Past Lives" / "Perfect Days", type: "movie"}` | ok, one exact match each | Kept the two entity ids for every later call. |
| q3 | `qloo_describe` `{entity: "Aftersun", type: "movie"}` | needs_input: three films share the title | Chose the 2022 Charlotte Wells film as the arthouse title that fits the venue, and said so. |
| q4 | `qloo_entity_tags` on the three ids | ok, two taste tags once place tags are dropped | Judged two broad tags too thin to define the taste, and read it from the discovery list instead. |
| q5 | `qloo_recommend` `{target_type: "movie", signals: [3 ids], limit: 20}` | ok, 20 films | Took the ten strongest to the local check. |
| q6, q7 | `qloo_rank` of the ten bookable films by name, on taste and with the location | needs_input: *Anora* and *Wicked* each match several films | Picked the recent releases by id and asked again. |
| q8 | `qloo_rank` of the bookable films with the hits as signals, no location | ok, all ten ranked | The shortlist's taste order. |
| q9, q10 | `qloo_rank` of the bookable films and of the ten discovery picks with `signal_location: "Lavapiés, Madrid"` | ok, **no results** | Followed the result's note: Qloo does not resolve this neighbourhood, so it retried at city level. |
| q11 | `qloo_rank` of the bookable films with `signal_location: "Madrid"`, `demographic: "people 25-34"` | ok, six of ten scored | The shortlist's local order; the other four have no Madrid data. |
| q12 | `qloo_rank` of the ten discovery picks, same location and audience | ok, two of ten scored | The discovery picks' local check. |

**Programme.** Eight dated events, five from the venue's list and three taste picks marked "check availability". The two taste picks that also score in Madrid carry high confidence; the rest are medium. A wordless-animation double bill pairs the shortlist's two best taste fits, which have no Madrid data; the family matinee uses the shortlisted animation that has Madrid data; and the shortlisted horror film that leads in Madrid but sits low on taste gets one late-night slot. Every one of the ten bookable films gets a verdict: six programmed, three held in reserve (including the musical, which scores locally but is the weakest taste fit) and one skipped.

**Cost.** Twelve Qloo calls, about 89,000 input tokens (65% read from the prompt cache) and 9,000 output tokens: $0.18 of Claude usage. Runs without a shortlist cost $0.06–0.13.

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
- Location signals work at the granularity Qloo resolves. Lavapiés and Peckham return nothing, so Marquee retries at city level and says the evidence is for the city; Brooklyn resolves.
- Qloo has local data for fewer niche titles than popular ones: in Madrid it scored two of ten arthouse films, in London eight of ten jazz artists. A taste pick without local data is shown as such, not dropped.
- Qloo trend data on the event API needs a window of about six months or more and does not cover books, so bookshop programmes skip the momentum check.
- The agent's formats, pairings and dates are its own judgement, and the app labels them that way.

## Responsible use

Marquee sends Qloo only places, titles, artists, tags and broad audience descriptions such as "students" or "people 25-34". It never sends or asks for personal data, and it does not infer anything about individuals. Qloo results are cached privately on the server to save repeat calls and are never committed to this repository; the sample venues in `samples/venues.json` are inputs only.

## Licence

MIT. See [LICENSE](LICENSE).
