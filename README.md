# Marquee

**Live demo:** https://marquee-1088237017332.us-central1.run.app (it opens on a sample music venue in Chicago; each sample venue replays instantly; live plans are limited to 3 per visitor a day)

A programming assistant for independent venues. Tell it what kind of venue you run (a cinema, a bookshop, a music bar or a music venue), where, what recently filled the room and, if you like, the titles you can actually book. An agent asks Qloo what people with your regulars' taste gravitate to, checks which titles land in your city, and returns a month of dated events, a verdict on every title you could book, local places to co-promote with, and the evidence behind each choice. Then it plans the same month again without Qloo and shows where the two plans part ways, so you can see what Qloo changed.

## The problem

Independent cinemas, bookshops, music bars and music venues programme by instinct. Their owners know what worked last month but not what the people who came would like next, and a night that misses costs them a month's margin. The taste data that would help lives in tools built for chains and brands. Marquee gives a one-person venue the same read in about two minutes, and says plainly what that read can and cannot tell them.

## How Qloo is used

Marquee is an agent (Claude) that calls Qloo through the event's supported `qloo mcp` server.

| Step | Qloo tool | What it answers |
|---|---|---|
| Resolve the recent hits | `qloo_describe` | Which Qloo entity "Aftersun" is, when three films share the title. |
| Discover by taste | `qloo_recommend` with the hits as `signals` and no location | What people who liked these titles gravitate to: the core of the programme. |
| Check locally | `qloo_rank` of the taste picks with the hits as signals plus `signal_location`, no audience signal | Your regulars' taste as it plays in the venue's city. A programme with a taste pick that never went through this check is sent back. |
| Judge what the venue can book | `qloo_rank` of the venue's own shortlist, once on taste and once with the location | The decision the owner actually makes: which of the titles on offer this month suit these regulars, and which suit the city. A resolved title that is not the work the venue meant is marked "check the title", not judged. |
| Fill broader slots | `qloo_recommend` with `signal_location` and no taste signals | A family matinee or crowd night, labelled as a local crowd-pleaser rather than a pick for this audience. |
| Find co-promotion partners | `qloo_recommend` with `target_type: "place"`, the hits as signals, `filter_location` and a place-category tag | Bars and cafés in the city whose audiences share the venue's taste: film to cocktail, book to bar. |
| Check the audience | `qloo_audience_demographics` for the lead picks | Whether the picks' audiences lean towards the venue's own audience (kept out of the local ranking, so the city ranking is about taste and place, not age). |
| Size acts to the room | the popularity Qloo returns with rankings and recommendations | How widely known an act is. A title held as too big must be more widely known, in the shortlist's taste ranking, than every booked title on the list; at a music venue a support act must be no more widely known than its headliner, by the popularity in any Qloo result. Code checks both. |
| Suggest a soundtrack (cinemas and bookshops) | `qloo_recommend` with `target_type: "artist"` and the hits as signals | Musicians with high affinity for the taste, for a pre-show playlist or a themed night. A music bar's or music venue's own programme is already artists, so it makes no separate call. |
| Show the difference | none: the same model, with the same programme rules, plans twice with no Qloo tools | Where the plans differ beyond the run-to-run noise, the night each plan pushes, and Marquee's cited reason for each differing verdict. Marquee alone also gets the instructions for using Qloo's data (research order, how to read scores, ties and audience skews, the push night as a strong taste fit) and the code checks that can send its plan back up to twice, so a difference measures Qloo's data together with those. |
| Check timing and place (optional) | `qloo_trends`, `qloo_where_popular` | Available to the agent for a rising title or where in the city an audience sits; trend series whose values never move are flagged as missing data. |

Taste comes first because of what the live data showed. Asked for films like *Past Lives*, *Perfect Days* and *Aftersun* with Madrid as the location plus the venue's audience and two mood tags, Qloo led with blockbusters. With no location, it returns twenty arthouse dramas. Both lists are made of widely known titles; what separates them is the kind of film. So Marquee uses taste to find candidates and the city to test them.

## What the venue sees

The results open on **one summary card**:

- **A three-line summary for the owner**: what the month is, the one night to push hardest and why, and which bookable titles to book, hold or pass (that line is written by code from the verdicts, so it cannot contradict them).
- **The month as tiles**, in date order, each with Qloo's own image of the film, book or act, and the push night marked. A tile opens its event.
- **A "With Qloo and without" strip**: what Qloo told Marquee that a plan without it could not know, the push night when the plans without Qloo chose another, up to three verdicts both of those plans agree on and Marquee does not (each labelled with what it rests on: Qloo's data, which titles fill the slots, Marquee's judgement, or no Qloo data), and the titles only Marquee planned.
- **Exports**: an `.ics` calendar and the programme as text.

The details sit in six tabs: The month, Your shortlist, With and without Qloo, Audience and city, Limits and checks, and Research trail.

- **A verdict on every bookable title** (Your shortlist): programmed, featured (played, not booked; at a music venue, played at a club night), reserve, skip or check the title, each with a plain reason citing the Qloo calls, and under it the title's standing by taste and in the city, written by code from Qloo's results with ties marked, so the model never states a rank. The reasoning behind it is one click away.
- **A dated month of events** (The month) with start and end times (trailers and intervals included) that fit local custom and the calendar: public holidays, festivals in the venue's field, local retail peaks and, for cinemas where films are usually dubbed, the version (original with subtitles or dubbed). Each is labelled by where it came from: the venue's list, a taste pick (with a reminder to check availability), a local crowd-pleaser or a reprise, plus a confidence level and its evidence. A music venue's headline shows can name a support act from Qloo's taste discovery.
- **Taste against city, per title** (Audience and city). A dumbbell chart puts each title's position by taste (ring) and in the city (dot) on the same axis. Positions come from one ranking each, so it never compares scores across calls, and a title Qloo has no local data for says so instead of looking weak. A table carries the same numbers.
- **With and without Qloo**, in full. The same model, with the same programme rules and no Qloo tools, plans the month twice. The page first lists what Qloo told Marquee that the control could not know (how many bookable titles it ranked in the city, which audiences it profiled, the places and musicians it found), then how much the two control runs differ from each other, and only the differences both control runs agree on, each with Marquee's cited reason. It grades neither plan: ranking the control by Qloo would only measure agreement with Qloo. The two control runs often differ from each other (different push nights, different titles from outside the list): that is the noise the page shows before any difference.
- **Co-promotion partners, a soundtrack (cinemas and bookshops) and an audience check** (Audience and city): up to three local places such as bars, cafés or restaurants. Qloo's place search takes the venue's location and returns places across the area; the agent keeps those whose addresses are nearby and is told never to suggest a competitor (no bars for a bar). Each partner has a concrete offer tied to an event; five musicians with high affinity for the taste; and a table of each profiled pick's age skews with the venue's own bands marked, then, in plain words, what that changes in the plan.
- **Limits and checks**: what the plan does not establish, and what the venue should check before committing.
- **The research trail.** Every Qloo call with its parameters, a plain-language label, the scores as bars (blue for taste-only calls, amber for calls with a location, near-ties marked), and the raw result behind a toggle.

Every event cites the calls that support it (q1, q2, …), and each citation links to its step in the trail. Code then checks the programme before it is accepted: the number of events, dates inside the month on the weekday named, featured titles that Qloo actually returned, citations of calls that actually happened, and a hold reason for every held title that checks out against the rankings, audience profiles or popularity (a title no ranking scored can be held only as Marquee's labelled judgement, never because others have data) and, at a music venue, a support act no more widely known than its headliner. For a music bar or music venue, a separate short question to the model (about $0.01) names the acts that share members, and code then gives each such group one night. A programme that fails goes back to the agent up to twice with the problems listed; if it fails a third time, it is shown with those problems at the top of its limits.

## From request to result

One live run, from 16 October 2026, step by step: the Chicago music venue the demo opens on. It shows the requests and the agent's decisions. Qloo's results are cached privately on the server and shown in the app's research trail, never stored in this repository (Qloo's terms keep response data out of public repositories); the demo replays this run, results included.

**Input.** A 500-capacity music venue in Logan Square, Chicago, with ticketed shows Thursday to Saturday and one free early show a month; recent hits Wednesday, MJ Lenderman and Waxahatchee; audience "people 25-34"; six events in November 2026; and ten acts it can book: Ratboys, Hovvdy, Florist, Indigo De Souza, Squirrel Flower, Hurray for the Riff Raff, Dehd, Horsegirl, Water From Your Eyes and Big Thief.

| Call | Tool and parameters | Outcome | What the agent did with it |
|---|---|---|---|
| q1–q3 | `qloo_describe` `{entity: "Wednesday" / "MJ Lenderman" / "Waxahatchee", type: "artist"}` | ok, one result each | Kept their handles for every later call. |
| q4 | `qloo_recommend` `{target_type: "artist", signals: [3 hits], limit: 20}` | ok, 20 acts | The taste discovery list, and the source of every act in the plan from outside the venue's list. |
| q5 | `qloo_rank` of the ten bookable acts on taste, no location | ok, all ten | The shortlist's taste order. |
| q6 | the same with `signal_location: "Logan Square, Chicago"`, no audience signal | ok, nine of ten ranked | The shortlist's taste as it plays locally. Unlike Lavapiés and Peckham, the neighbourhood worked as a ranking signal. The act with no signal there was judged on taste alone. |
| q7 | `qloo_recommend` `{target_type: "place", filter_location: "Logan Square, Chicago", include_tags: ["urn:tag:category:place:cafe"], limit: 10}` | ok, 10 places | Cafés rather than bars, since a bar with live music competes with the venue. Kept three nearby, each with an offer tied to a dated event. |
| q8 | `qloo_rank` of ten acts from the discovery list that are not on the venue's list, with the same location | ok, eight of ten ranked | Took four with a local signal: three as support acts and one for a headline night. The two with no local data were not programmed. |
| q9–q12 | `qloo_audience_demographics` for four headliners, the push night's act included | three profiles; none for the push night's act | Placed each profiled act by its audience: the two that lean older than 25-34 take the month's first Friday and a Thursday rather than the push, and the one that leans younger is pitched to the younger half of the crowd. The push night's act has no profile, and the page says so. |

**Programme.** Six dated shows, five on a Friday or Saturday and one on a Thursday, across the month's four weekends. Three are headline shows with a support act from the discovery list, each support less widely known than its headliner on Qloo's popularity (code checks it); one is a headline night for a discovery act not on the list; one is the free early show, on Small Business Saturday afternoon. Thanksgiving Thursday is left dark, and the Friday after it gets a single-act night. The push night is Friday 20 November: Ratboys, a Chicago band with a strong taste fit and a strong local signal. Of the ten bookable acts, five are booked, three held in reserve because every slot went to other acts, one skipped as a weaker taste fit, and Big Thief skipped as more widely known than every booked act: too big for a 500-capacity room. The four off-list acts head the checks before committing, for availability and fee. Partners: three places near the venue, two cafés and a confectioner.

**Without Qloo.** The same model, with the same programme rules and no Qloo, planned the month twice. The two runs shared 9 of their 13 acts. Both booked Hovvdy and Florist, which Marquee holds in reserve, and both put Indigo De Souza and Hurray for the Riff Raff on a late club-night playlist as too big for the room; Marquee holds the first in reserve and skips the second on taste. Of the four verdicts both runs agree on and Marquee does not, that skip is the one that rests on Qloo's data; the other three are which acts fill the slots. Apart from support acts, neither booked anyone from outside the list, so the four discovery acts are only in Marquee's plan. Both pushed Saturday 21 November, one with Dehd and one with Ratboys; Marquee pushes Ratboys on the Friday.

**Cost.** Twelve Qloo calls, about 191,000 input tokens (88% read from the prompt cache) and 29,000 output tokens, both control runs included: $0.41 of Claude usage. A run takes about two minutes; the four samples cost $0.38–0.48 each.

## What we learned

- **Location, audience and mood-tag signals pull towards the mainstream.** With Madrid, a 25-34 audience and mood tags, Qloo leads with blockbusters; on taste alone, arthouse dramas. Marquee uses taste to find candidates and the city to test them.
- **On taste alone, a frontier model did better than Qloo for well-known titles.** We hid each hit of the cinema, bookshop and music bar samples in turn and asked both to find it from the other two: Qloo placed the hidden hit at an average of #6.2 in its top 20 (median #5), Claude alone at #4.8 (median #2), nine cases (Claude was also told the venue's city and type; Qloo got the hits only). A small test, but enough to change the design. So Marquee does not lean on Qloo for "what is similar". It leans on what a model cannot know: how titles land in a given city and age group, who their audiences are, how widely known an act is, and which local places share the taste, all as numbers the code can check and the page can cite.
- **New releases are thin.** In October 2026 Qloo resolved ten 2025 films (two after a choice between same-titled works) but ranked none of them, on taste or in Madrid. Marquee says so instead of guessing; the cinema sample uses 2023–24 titles, all of which Qloo ranks on taste.
- **Missing is not low.** Qloo ranks only the titles it has a local signal for, and niche titles often have none (in the samples, Logan Square, Chicago ranks 9 of 10 bookable indie acts, Madrid 6 of 10 bookable films, London 5 of 10 bookable jazz acts and New York none of the bookshop's 10; in earlier runs London ranked 10 of 10 discovery picks and New York 4 of 10). Marquee shows them as not ranked, never as weak, and code rejects a hold that rests on missing data. One case it allows: when two titles tie on taste, a strong city signal can break the tie for the title that has one, and the page shows both standings so the owner can see it.

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

Keys stay on the server: the Qloo key reaches only the `qloo mcp` child process, and neither key is sent to the browser, the model or a log. Daily caps bound what a public demo can spend: `MARQUEE_DAILY_RUNS` (default 25) in total and `MARQUEE_RUNS_PER_VISITOR` (default 3) per visitor, and an optional total `MARQUEE_SPEND_CAP_USD` that counts real model cost from `MARQUEE_SPEND_FROM` (a date) and survives restarts. A run stops when its visitor leaves, and its planning stops once the model cost passes $0.50 (the two control runs, about $0.10 more, follow a finished plan); and identical requests are served from a cache.

## Limits

- Qloo results describe what groups of people tend to like in aggregate. They are not predictions about any person and say nothing certain about attendance.
- Marquee has no ticket-sales, fee, rights or pricing data, and knows a room's capacity only from the owner's notes; the programme is a starting point to test, not a forecast of revenue.
- Scores from separate Qloo calls are not on a common scale. Marquee never ranks titles across calls, and its taste-versus-city chart compares positions within each ranking, not scores.
- Qloo ranked none of the ten 2025 films we tried (in October 2026), though it does score some 2025 titles, and it matched some 2025 books to the wrong work; plans for brand-new titles rest on the agent's judgement, and it says so.
- Popularity is how widely known a title is in Qloo's catalogue; it says nothing about availability or fees. Marquee uses it only to size acts to the room: a hold as too big, and a music venue's support act against its headliner.
- Lavapiés and Peckham returned nothing as a ranking signal in every run, so rankings fall back to the city and say so. Logan Square worked, ranking nine of the Chicago venue's ten acts, and Brooklyn has matched New York on the same picks; neither ranked the bookshop's 2023–24 list (New York ranked some discovery picks and none of the bookable titles). As a place filter, neighbourhoods narrow the area but still let in places a bus ride away, so the agent is told to keep only nearby addresses.
- Qloo has local data for fewer niche titles than popular ones: in the samples, Madrid ranks six of ten bookable films and London five of ten bookable jazz acts, against nine of ten indie acts in Logan Square. A taste pick without local data is shown as such, not dropped.
- Qloo trend data on the event API needs a window of about six months or more and does not cover books, so bookshop programmes skip the momentum check.
- The agent's formats, pairings and dates are its own judgement, and the app labels them that way.

## Responsible use

Marquee sends Qloo only places, titles, artists, tags and broad audience descriptions such as "students" or "people 25-34". It never sends or asks for personal data, and it does not infer anything about individuals. Qloo results are cached privately on the server to save repeat calls and are never committed to this repository; the sample venues in `samples/venues.json` are inputs only.

## Licence

MIT. See [LICENSE](LICENSE).
