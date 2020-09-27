# zoom-yt-background-maker
Converts YT video links into zoom background videos

<img src="https://github.com/bsharper/zoom-yt-background-maker/blob/master/build/screenshot_mac.png?raw=true" alt="screenshot on macOS" width="400"/><img src="https://github.com/bsharper/zoom-yt-background-maker/blob/master/build/screenshot_win.png?raw=true" alt="screenshot on Windows" width="400"/>

## Quick start

Grab a release from [here](https://github.com/bsharper/zoom-yt-background-maker/releases/latest) and run it.

## Requirements

A recent version of a node.js with [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

## Installation 

1. Clone the repository
2. Run `yarn` 
3. Run `yarn startdev` to start with dev tools enabled, `yarn start` to start without (dev tools can be opened if you know the keyboard shortcut).
4. To build for Windows or macOS, run `npx electron-builder -m | -w`.

## Notes

This was written as a side project, so don't expect this to be a good example of a code organization. A lot of the code should be running under the main process instead of the renderer. 

You can also drag and drop files onto the window to convert local files. Dragging and dropping a file will start the conversion process after prompting you for a location for the converted video.

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
