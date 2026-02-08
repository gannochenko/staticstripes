# Upload

There is a section in the project.html file about the upload channels:

```html
<uploads>
  <youtube name="yt_primary" data-output-name="youtube" id="">
    <unlisted />
    <made-for-kids />
    <tag name="travel" />
    <tag name="blog" />
    <category name="entertainment" />
    <language name="en" />
    <thumbnail data-timecode="1000ms" />
    <pre>
{title}.

Links:
- Website: https://example.com
- GitHub: https://github.com/user/repo
    </pre>
  </youtube>
</uploads>
```

There will be 4 types of uploads: youtube, instargram, tiktok, s3, but let's focus on youtube for now.

## Packages

Use the official google API.

## HTML tags

For youtube there are the following tags supported:

<youtube> - says it's a youtube upload, it has a name and a connection to the output name. When the vide is upload, the "id" attribute must contain the id of the created video.

<unlisted /> - means the vide is currently unlisted, can also be <private /> and <public />

<made-for-kids /> - indicates the video is made for kids.

<tag /> - with a certain name defines a tag of the video, can be several of them.

<category /> - defines the category, can only be one

<language /> - defines the language of the video

<pre /> - contains the description. The content should support ejs.

<thumbnail /> - defines where to take the thumbnail. If `data-timecode` attribute is specified, it should take a frame from the output file on that time moment. Can be in milliseconds or seconds.

## CLI commands

`staticstripes auth --upload-name yt_primary` should start the authentication sequence for the upload. For Youtube it should create a link, open it in the browser, and when user approves, it should store tokens in a separate file, excluded from git, and name it with the name of the upload, so later it can be assosicated with it.

`staticstripes upload --upload-name yt_primary` should upload the video on Youtube with the parameters and the associated token. If no output exists, return error.
