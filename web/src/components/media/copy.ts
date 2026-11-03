// SPEC-GAP: media copy (UI-SPEC "Copywriting Contract" → Screen copy, Viewer). The plain-English strings of the photo
// list and the photo viewer in one module, so the owner can change them in one place and no JSX carries its own wording.

/** The copy of the media components (plans 09-04 and 09-08). */
export const MEDIA_COPY = {
  /** ImageUploader add area and list (D-08, D-17, D-25). */
  uploader: {
    listName: 'Order photos',
    dropTitle: 'Drag images here or ',
    browse: 'browse',
    takePhoto: 'Take Photo',
    choosePhotos: 'Choose Photos',
    /** The type, size and count line. */
    hint: (megabytes: number, count: number, max: number): string =>
      `JPG, PNG, WEBP or HEIC · up to ${String(megabytes)} MB each · ${String(count)}/${String(max)}`,
    readonlyEmpty: 'No photos on this order.',
    /** The count line of the pick-error box, for files left out over the limit. */
    leftOut: (max: number, left: number): string =>
      left === 1
        ? `An order can have up to ${String(max)} photos. 1 of the photos you picked wasn't added.`
        : `An order can have up to ${String(max)} photos. ${String(left)} of the photos you picked weren't added.`,
  },
  /** One photo tile (D-13, D-14, D-25) and the per-photo control names. */
  tile: {
    position: (position: number, total: number): string => `Photo ${String(position)} of ${String(total)}`,
    cover: 'Cover',
    makeCover: 'Make Cover',
    tryAgain: 'Try Again',
    remove: 'Remove',
    waiting: 'Waiting to upload',
    uploading: 'Uploading',
    failed: (reason: string): string => `Didn't upload. ${reason}`,
    noPreview: 'No preview. It shows after upload.',
    open: (position: number, total: number, description: string): string =>
      `Open photo ${String(position)} of ${String(total)}: ${description}`,
    moveLeft: (position: number): string => `Move photo ${String(position)} left`,
    moveRight: (position: number): string => `Move photo ${String(position)} right`,
    editDescription: (position: number): string => `Edit description of photo ${String(position)}`,
    deletePhoto: (position: number): string => `Delete photo ${String(position)}`,
    removePhoto: (position: number): string => `Remove photo ${String(position)}`,
    makeCoverNamed: (position: number): string => `Make cover, photo ${String(position)}`,
    tryAgainNamed: (fileName: string): string => `Try again, ${fileName}`,
    removeNamed: (fileName: string): string => `Remove ${fileName}`,
  },
  /** PhotoViewer (D-16, D-04, D-27). */
  viewer: {
    counter: (position: number, total: number): string => `Photo ${String(position)} of ${String(total)}`,
    close: 'Close viewer',
    previous: 'Previous image',
    next: 'Next image',
    openFullSize: 'Open Full Size',
    opensInNewTab: '(opens in a new tab)',
    /** The polite announcement on each change. */
    announce: (position: number, total: number, description: string): string =>
      `Photo ${String(position)} of ${String(total)}: ${description}`,
  },
} as const;
