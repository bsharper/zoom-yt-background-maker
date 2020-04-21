# zoom-yt-background-maker
Converts YT video links into zoom background videos

## Installation

1. Clone repository
2. Run `yarn` 
3. Run `yarn startdev` to start with dev tools enabled, `yarn start` to start without
4. To build for Windows or macOS, run `npx electron-builder -m | -w`.

## Building

I've tested this 

## Notes

This was written in one night, so don't expect this to be a good example of a code organization. A lot of the code should be running under the main process instead of the renderer. 

Under the hood, this uses `ytdl-core` to grab the videos and `ffmpeg` (via `ffmpeg-installer` and `fluent-ffmpeg`) to convert them. 

## Logs 

(mostly from `electron-log`)

* on Linux: ~/.config/zoomtube/logs/
* on macOS: ~/Library/Logs/zoomtube/
* on Windows: %USERPROFILE%\AppData\Roaming\zoomtube\logs\

There are currently 3 files created:

1. renderer.log
2. download.log
3. convert.log

You can guess what each does.
