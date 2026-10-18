# README showcase media

These are the existing, approved Product Hunt launch assets, kept in the repository rather than an external media service. Adding them does not publish or schedule the launch.

- `docsy-showcase.mp4`: unchanged final v2 film, 73 seconds, 1920 × 1080 at 60 fps, with the approved Lily narration and original audio mix.
- `video-poster.jpg`: existing inspected film frame at 8.40 seconds, used as a clickable cover.
- `01-…png` through `04-…png`: unchanged 1270 × 760 Product Hunt gallery exports, in launch order.
- `product-hunt-slideshow.gif`: the four gallery exports, five seconds per frame, looping. No new fonts or artwork were introduced. The root README uses the first PNG as its reduced-motion alternative and offers all four stills.

The video is linked through its poster and a text link; no unsupported inline player markup or external upload is required. Paths are relative so the files follow the selected repository branch and access permissions.

Rebuild the slideshow from the committed stills with FFmpeg:

```bash
ffmpeg -framerate 1/5 -pattern_type glob \
  -i 'docs/assets/launch/[0-9][0-9]-*.png' \
  -filter_complex '[0:v]split[slides][colors];[colors]palettegen=stats_mode=full[palette];[slides][palette]paletteuse=dither=sierra2_4a' \
  -loop 0 docs/assets/launch/product-hunt-slideshow.gif
```

Run from the repository root. FFmpeg asks before replacing an existing output. Native SDK scenes show teaching fixtures, not blanket production compatibility. Maintenance requires configuration and credentials, and produces a draft for human review; it does not automatically approve or merge changes.
