Fragment typescript struction is defined as such:

```
export type Fragment = {
  id: string;
  enabled: boolean;
  assetName: string;
  duration: number; // calculated, in seconds (can come from CSS or from the asset's duration)
  trimLeft: number; // in seconds
  overlayLeft: number | CompiledExpression; // amount of seconds to overlay with the previous fragment (normalized from margin-left + prev margin-right)
  overlayZIndexLeft: number;
  transitionIn: string; // how to transition into the fragment
  transitionInDuration: number; // how long the transition in lasts
  transitionOut: string; // how to transition out of the fragment
  transitionOutDuration: number; // how long the transition out lasts
  objectFit: 'cover' | 'contain';
  objectFitContain: 'ambient' | 'pillarbox';
  objectFitContainAmbientBlurStrength: number;
  objectFitContainAmbientBrightness: number;
  objectFitContainAmbientSaturation: number;
  objectFitContainPillarboxColor: string;
  chromakey: boolean;
  chromakeyBlend: number;
  chromakeySimilarity: number;
  chromakeyColor: string;
};
```

There is already an HTML/CSS parser in src/html-parser.ts

A <fragment> tag may have several classes, each class may have css properties. They all must be merged how a browser normally does it. Here is a list of possible properties:

```css
.someClass {
  display: none;
  -asset: intro_image;
  -duration: 4000ms;
  -transition-start: fade-out 500ms;
  -transition-end: fade-out 500ms;
  -offset-start: 3000ms -1;
  -offset-end: 3000ms 1;
  -object-fit: contain ambient 25 -0.1 0.7;
  -object-fit: cover pillarbox #000000;
  -chromakey: 0.1 0.1 #000000;
  -offset-start: calc(url(#main.time.end) + 5s);
}
```

Let me explain what each rule means:

1. `-asset` is mapped to `assetName` and represents the name of the asset used for this fragment.
   1.1 The asset can also be defined through an attribute of the fragment tag.
2. `display` controls the `enabled` property. `display: none` sets the property to `false`, while anything else or abscense of such leads to `true`.
3. `-duration` controls the `duration` property. It can be:
   3.1 `auto` (by default, or if not set) - in this case the duration takes all duration of the asset minus possible `-trim-start`
   3.2 `percentage` (e.g. `100%`, `50%`, etc.) take the corresponding percentage of the asset's duration, and don't take trim into account.
   3.3 `numerical value` (e.g. `5000ms`, `50s`, etc.) sets the duration to that value (with everything coverted to milliseconds)
4. `-offset-start` defines the `overlayLeft`, it can be
   4.1 `numerical value`, just like duration (must be normalized to milliseconds), or
   4.2 `expression`, such as `calc(url(#ending_screen.time.start) + 5s)` (in this case it is compiled and then evaluated at build time)
5. `-offset-end` defined the `overlayLeft` of the _next fragment_ (in this case it sums up with the `-offset-start` of that following fragment)
6. `-transition-start` sets the `transitionIn` and `transitionInDuration` properties. The value consists of the name of the effect (currently can be `fade-in` or `fade-out`) and duration with units. Example: `-transition-start: fade-in 5s`. Duration must be normalized to milliseconds.
7. `-transition-end` is similar to `-transition-start`, but defines `transitionOut` and `transitionOutDuration`
8. `-object-fit` defines the following properties: `objectFit`, `objectFitContain`, `objectFitContainAmbientBlurStrength`, `objectFitContainAmbientBrightness`, `objectFitContainAmbientSaturation`, `objectFitContainPillarboxColor`, and has the following format: `-object-fit: <type> <settings>` Possible combinations:
   8.1 `-object-fit: contain ambient <objectFitContainAmbientBlurStrength> <objectFitContainAmbientBrightness> <objectFitContainAmbientSaturation>`, where
   8.1.1: `objectFitContainAmbientBlurStrength` is an integer number
   8.1.2: `objectFitContainAmbientBrightness` is a float
   8.1.2: `objectFitContainAmbientSaturation` is a float
   8.2 `-object-fit: contain pillarbox <objectFitContainPillarboxColor>`, where
   8.2.1: `objectFitContainPillarboxColor` is a color constant with transparency, e.g. `#123abc45`
   8.2 `-object-fit: cover` sets the value to `cover`
   8.3 if no `-object-fit` is set, the `objectFit` property should be `cover`
9. `-chromakey` defines `chromakey`, `chromakeyBlend`, `chromakeySimilarity`, `chromakeyColor`, and has the following format: `-chromakey: <chromakeyBlend> <chromakeySimilarity> <chromakeyColor>`
   9.1: `chromakey` is a boolean property set to `true` if `-chromakey` was defined.
   9.2: `chromakeyBlend` is a float value, but a canned constant can be used: `hard` = 0.0, `smooth` = 0.1, `soft` = 0.2
   9.3: `chromakeySimilarity` is a float value, but a canned constant can be used: `strict` = 0.1, `good` = 0.3, `forgiving` = 0.5, `loose` = 0.7
   9.4: `chromakeyColor` is a color constant with transparency
10. `-overlay-start-z-index` defines `overlayZIndexLeft` and can be an integer.
11. `-overlay-end-z-index` defines `overlayZIndexLeft` of the fragment next to the current one and can be an integer, and is negated, e.g. `100` becomes `-100`. If the fragment has its own definion of `-overlay-start-z-index`, it is ignored.
12. `-trim-start` defines `trimLeft` and is an integer with time units attached. Cannot be negative.

The `id` field is defined from an attribute of the fragment tag. If there is no attribute, a random value is used.
