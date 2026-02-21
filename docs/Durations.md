The following must be supported:

```
-duration: <D1>; // duration of the fragment
-trim-start: <D2>; // skip first D2 of the asset
-trim-end: <D3>; // cut last D3 of the asset
```

where <Dn> is in seconds or milliseconds

duration can be:

1. <D> - fixed value
2. 100% - percent of the asset duration
3. auto (default) - all asset duration minus trim start/end
