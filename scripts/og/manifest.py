#!/usr/bin/env python3
"""Build the OG card manifest.

Article copy is read from the RUNNING site (the homepage's article data
island), so a card can never disagree with `content.rs`. Everything else is
declared here.

Usage: manifest.py http://127.0.0.1:3177/
"""

import json
import re
import sys
import urllib.request

SITE = "ENGMANAGER.XYZ"

BYLINE = {
    "image": "avatar.png",
    "name": "Matthew Harwood",
    "role": "Engineering Manager at Uber",
}


def fetch_articles(origin: str) -> dict:
    with urllib.request.urlopen(origin, timeout=20) as response:
        html = response.read().decode("utf-8")
    match = re.search(
        r'<script type="application/json" id="articles-data">(.*?)</script>', html, re.S
    )
    if not match:
        # The island moved or was renamed — fail loudly rather than silently
        # shipping cards with no articles.
        raise SystemExit("could not find the articles-data island on the homepage")
    return json.loads(match.group(1))


def cards(origin: str) -> list:
    out = [
        {
            "name": "default",
            "kicker": "Engineering · design · shipping",
            "domain": SITE,
            "headline": "Eng Manager",
            "summary": "Essays on building software with AI, leading engineering teams, and shipping real things end to end.",
            "headlineSize": 104,
            "byline": BYLINE,
        },
        {
            "name": "coach-group",
            "kicker": "Group coaching · 35 minutes",
            "domain": "COACH." + SITE,
            "headline": "Same 35 minutes. Bring your friends.",
            "headlineSize": 66,
            "terms": "One booking · $100 total · one person pays · Fridays PT",
            "proof": {
                "faces": ["edison-lee.webp", "shreyas-s.webp"],
                "kicker": "Recommended on LinkedIn by engineers I managed",
                "names": "Edison Lee · Shreyas S",
                "schools": "Georgia Institute of Technology · Vellore Institute of Technology",
            },
        },
        {
            "name": "coach",
            "kicker": "1:1 coaching · 35 minutes",
            "domain": "COACH." + SITE,
            "headline": "Spend 35 minutes. Save a year of searching.",
            "headlineSize": 62,
            "terms": "35 min · Fridays 10am–2pm PT · $100 · Google Meet",
            "proof": {
                "faces": ["edison-lee.webp", "shreyas-s.webp"],
                "kicker": "Recommended on LinkedIn by engineers I managed",
                "names": "Edison Lee · Shreyas S",
                "schools": "Georgia Institute of Technology · Vellore Institute of Technology",
            },
        },
    ]

    articles = fetch_articles(origin)

    for slug, article in articles.items():
        if slug == "auteurs":
            # Auteurs gets its own card: the article's WebGL orb as the hero,
            # and the Discord QR as a stamp you can point a phone camera at.
            out.append(
                {
                    "name": "article-auteurs",
                    "layout": "auteurs",
                    "kicker": "Auteurs · free Discord",
                    "domain": SITE,
                    "headline": "Don’t build alone.",
                    "headlineSize": 76,
                    "summary": "A Discord for engineers, designers, and product people who actually ship. Free to join.",
                    "byline": BYLINE,
                    "shader": True,
                    "qr": {
                        "image": "discord-qr.png",
                        "caption": "Scan to join",
                        "url": "discord.gg/sTzQBrbnBM",
                    },
                }
            )
            continue

        out.append(
            {
                "name": f"article-{slug}",
                "kicker": f"{article['category']['label']} · {article['date']}",
                "domain": SITE,
                "headline": article["title"],
                "headlineSize": 58,
                "summary": article["summary"],
                "byline": BYLINE,
            }
        )

    return out


if __name__ == "__main__":
    json.dump(cards(sys.argv[1]), sys.stdout, ensure_ascii=False, indent=1)
