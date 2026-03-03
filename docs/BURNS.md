Need to implement the Ken Burns effect for static assets (images).

In css it should look like:

```
-object-fit: ken-burns;
-object-fit-ken-burns: <effect> <speed>;
```

where effect can be:

1. zoom-in
2. zoom-out
3. pan-left
4. pan-right
5. pan-top
6. pan-bottom

When the effect is any but "zoom-in", the image must be zoomed in and positioned accordingly.
When the effect is "zoom-in" or "zoom-out", there must be focal point specified, in percents:

```
-object-fit-ken-burns: zoom-in 30% 30% slow;
```

The percents are counted from the top left corner of the image.

On the ffmpeg level add all relevant filter makers.

On the stream level, add the kenBurns() helper, see how others are made, such as e.g. chromakey().

On the sequence level - only video stream must be affected.

On the CSS level - see above.
