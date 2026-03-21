I want to implement the node system, and for that let's start a new application called `apps/node-renderer`.

We will borrow a lot from the previous `apps/renderer` app, but this time it should be node first.

Each node has named inputs and named outputs.
If a tag name starts with "node.", it is a node. The part after comma defines the node type.

Available types:

1. project - the main node of the project, runs ffmpeg
2. filesystem - outputs the result file to a specified path of the local filesystem
3. youtube - integration with youtube
4. s3 - integration with s3
5. instagram - integration with instagram
6. ai_music_api_ai - integration with AI Music API AI
7. elevenlabs - integration with Elevenlabs
8. openai - integration with openai

Every node implementation lives in a subfolder inside `src/nodes`.
Every node implements the following interface:

```typescript
type Input {
    name: string;
}

type Output {
    name: string;
}

type ValidationError {
    text: string;
}

type NodeParameter {
    name: string;
    required: boolean;
}

interface Node {
    getInputs(): Input[];
    getOutputs(): Output[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
```

There must be a DAG between the nodes.

Milestone 1: implement the html parser which parses the project.html file. Use the previous implementation as the source of inspiration.
Milestone 2: for every node type create a subfolder with the future implementation, implement parameters of each node, supported inputs and outputs.
Milestone 3: validate the node structure for correctness: the DAG must be valid, all node types and names - resolvable, all parameters - complete. The DAG should clearly have the leaf nodes and the clear execution pipeline.
Milestone 4: implement the DAG runner. It should traverse the DAG and execute nodes in the right order, passing outputs to inputs, till the end. If an error is encountered in one of the nodes, the execution stops. Also take caching into account. A node can cache its results, but the cache key would be - all parameters. Implement the propagation of cache miss: if a node has the chache miss, then all downstream nodes have their caches invalidated. For this step let's mock the implementation of each node.
Milestone 5: Implement the project node and the filesystem node. Take everything from the previous implementation. The project node must support:

1. Selecting the output and settings such as fps, dimensions
2. Selecting ffmpeg options
3. Rendering Sequences and Fragments using ffmpeg: ffmpeg helper, stream, sequences.
4. Use CSS/style attribute to control the behaviour. Object-fit: pillarbox/ambient/ken burns. Duration, offsets, trims, pad, etc. Referencing timings of other nodes via expressions. What did I miss?
5. Running applications (static and animated). Applications must be resolved relative to the project folder.
6. The container support can be removed, no needed with the applications
7. Asset management
8. The cache must be per output, and saved locally into the `.cache/<node-name>` folder
9. The filesystem node reads the output and stores where needed

Milestone 6: Implement support for applications. There is the application node now. The node has standard attributes: name q and src (points to the javascript file). The rest of the attributes should go to the application as parameters. Attributes support referencing outputs of other nodes. A fragment can reference an asset via the "asset" attribute, and that asset can
have an input referencing the output of an application. An application can be static (one frame) and dynamic (several frames). Copy the previous implementation and put everything to the node.app node folder. An application emits events when
it renders a frame and expects the ack signal back. An app requires the fps and resolution parameters, as usual, plus user defined properties.

Milestone 7: Implement support for youtube, s3 and instagram nodes. Borrow everything from the previous implementation, including the authentication pipelines (for this I think we need a separate cli command, such as `auth node=<node_name>` or something like that, and based on the node type the command chooses an appropriate auth way (the auth implementation should belong to the node implementation))

Example of `project.html`:

```html
<node.project>
  <title>Christmas Morning in Liberec</title>
  <tag>Winter</tag>
  <tag>Christmas</tag>
  <tag>Czech Republic</tag>

  <sequences>
    <sequence>
      <fragment class="intro_image intro_duration" />
      <fragment class="clip_1 ambient" timecode="Clip 1" />
      <fragment class="analog_static_03" />
      <fragment class="clip_2 ambient" timecode="Clip 2" />
      <fragment
        class="outro_image outro_duration"
        id="ending_screen"
        timecode="Conclusion"
      />
    </sequence>
    <sequence>
      <fragment class="intro_sound intro_duration" />
    </sequence>
    <sequence>
      <fragment class="intro_image_message intro_duration" asset="intro_text" />
    </sequence>
    <sequence>
      <fragment class="outro_sound outro_duration" id="outro_sound" />
    </sequence>
    <sequence>
      <fragment
        class="outro_message outro_duration"
        id="outro_message"
        asset="outro_text"
      />
    </sequence>
    <sequence>
      <fragment asset="joke_karaoke_text" />
    </sequence>
  </sequences>

  <style>
    .disabled {
      display: none;
    }
    .ambient {
      -object-fit: contain ambient 25 -0.1 0.7;
    }
    .outro_duration {
      -duration: 5000ms;
    }

    .intro_duration {
      -duration: 8000ms;
    }

    .intro_image {
      -asset: intro_image;
      -transition-end: fade-out 500ms;
      filter: instagram-lark;
    }
    .intro_image_message {
      -transition-end: fade-out 500ms;
    }
    .intro_sound {
      -asset: guitar_music;
      -transition-end: fade-out 500ms;
    }

    .clip_1 {
      -asset: clip_01;
      -trim-start: 3000ms;
      -transition-start: fade-in 1000ms;
    }
    .clip_2 {
      -asset: clip_02;
      -duration: 3000ms;
      -transition-end: fade-out 1000ms;
    }

    .outro_image {
      -asset: intro_image;
      -transition-start: fade-in 1000ms;
      -transition-end: fade-out 500ms;
    }
    .outro_sound {
      -asset: guitar_music;
      -offset-start: calc(url(#ending_screen.time.start));
      -transition-end: fade-out 500ms;
    }
    .outro_message {
      -offset-start: calc(url(#ending_screen.time.start));
      -transition-start: fade-in 1000ms;
      -transition-end: fade-out 500ms;
    }

    .glitch {
      -asset: glitch;
      -duration: 500ms;
      -offset-start: -250ms;
      -overlay-start-z-index: 1;
      -offset-end: -250ms;
      -overlay-end-z-index: 1;
      -chromakey: smooth strict #000000;
    }

    .analog_static_03 {
      -asset: analog_static_03;
      -duration: 500ms;
    }
  </style>

  <assets>
    <asset
      name="clip_01"
      path="./input/20251224_110901.mp4"
      author="John Doe"
    />
    <asset
      name="clip_02"
      path="./input/20251224_111721.mp4"
      author="Jane Doe"
    />
    <asset
      name="intro_image"
      path="./images/20251224_110757.jpg"
      author="FooBar"
    />
    <asset name="glitch" path="./effects/digital_glitch_01.mp4" />
    <asset name="analog_static_03" path="./effects/analog_static_03.mp4" />
    <asset
      name="guitar_music"
      path="./audio/instrumental-acoustic-guitar-music-401434.mp3"
      author="Baz"
    />
    <asset name="mysterious_music" input="$intro_song.output.audio" />
    <asset name="audio_joke" input="$joker_talks.output.audio" />
    <asset name="joke_karaoke_text" input="$joke_karakoke.output.text" />
  </assets>

  <outputs>
    <output name="youtube" resolution="1920x1080" fps="30" />
    <output name="youtube_shorts" resolution="1080x1920" fps="30" />
    <output name="instagram_shorts" resolution="1080x1920" fps="30" />
  </outputs>

  <ffmpeg>
    <option name="preview">
      -c:v h264_nvenc -preset fast -c:a aac -b:a 192k
    </option>
    <option name="meh">
      -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 192k
    </option>
  </ffmpeg>
</node.project>

<node.filesystem name="preview_youtube" path="$project.output.youtube">
  <path> output/preview_youtube.mp4 </path>
</node.filesystem>

<node.youtube name="yt_primary" path="$project.output.youtube">
  <unlisted />
  <made-for-kids />
  <category name="entertainment" />
  <language name="en" />
  <thumbnail timecode="1000ms" />
  <pre>
Timecodes:

${timecodes}

Thanks for watching!
  </pre>
</node.youtube>

<node.s3 name="s3_primary" path="$project.output.youtube">
  <endpoint name="digitaloceanspaces.com" />
  <region name="ams3" />
  <bucket name="photoframe-photos-content-ams3-production" />
  <path name="file"> videos/${slug}/${output}.mp4 </path>
  <path name="metadata"> videos/${slug}/metadata.json </path>
  <path name="thumbnail"> videos/${slug}/thumbnail.jpeg </path>
  <acl name="public-read" />
  <thumbnail timecode="1000ms" />
</node.s3>

<node.s3 name="s3_instagram" path="$project.output.youtube">
  <endpoint name="digitaloceanspaces.com" />
  <region name="ams3" />
  <bucket name="photoframe-photos-content-ams3-production" />
  <path name="file"> videos/instagram/${slug}/${output}.mp4 </path>
  <acl name="public-read" />
</node.s3>

<node.instagram name="ig_primary" url="$s3_instagram.output.url">
  <thumbnail timecode="1000ms" />
  <pre>
${project.title} ❄️🏔️

${project.tags}
  </pre>
</node.instagram>

<node.ai_music_api_ai name="intro_song">
  <prompt>
    10-second instrumental acoustic guitar piece, calm and relaxing mood, soft
    fingerpicking, warm analog tone, subtle ambient background texture, slow
    tempo (65-75 BPM), light room reverb, smooth fade-out, minimalistic, no
    vocals, no percussion.
  </prompt>
  <model name="sonic-v4-5" />
</node.ai_music_api_ai>

<node.elevenlabs name="joker_talks" text="$joker.output.text" />

<node.openai name="joker">
  <prompt> make a dad joke! </prompt>
</node.openai>

<node.app
  name="joke_karakoke"
  src="./karaoke_text/dst/index.js"
  text="$joker_talks.output.text"
/>

<node.app
  name="intro_text"
  src="./central_text/dst/index.js"
  text="Dad jokes 300"
  extra="❄️🏔️🌨️"
/>

<node.app
  name="outro_text"
  src="./central_text/dst/index.js"
  text="Dad jokes 300"
/>
```
