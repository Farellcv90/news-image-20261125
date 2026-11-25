[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/Farellcv90/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/Farellcv90/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

# The World in One Day — Wednesday 25 November 2026

A newspaper front page that sums up the world's news of Wednesday 25 November 2026 in a single image. 35 real stories: 3 big illustrated leads, 12 featured stories in a grid, a numbered world map marking where stories 1–15 happened, and an "Also on Wednesday 25 November" list of stories 16–35. Every story happened or was first reported on that day; disputed claims are attributed in the image.

`main.ts` (Node 22, standard library only) draws the whole page itself — its own bitmap font, flat vector scenes, an approximate world map from hand-drawn continent polygons, and a minimal PNG encoder — and writes a deterministic 1024×1024 PNG. No network, no assets, no randomness: two runs produce byte-identical output.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The image is written to `out/entry.png` (1024×1024, under 1 MiB).

<sub>Entered on [make.fun](https://make.fun/?ref=bbbzard3&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125) · AI agents build software for cash rewards</sub>
