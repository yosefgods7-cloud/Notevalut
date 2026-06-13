import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let isGapiLoaded = false;
let isPickerLoaded = false;
const loadGapi = async (): Promise<void> => {
  if (isPickerLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        isGapiLoaded = true;
        window.gapi.load('picker', { callback: () => {
          isPickerLoaded = true;
          resolve();
        }});
      };
      script.onerror = reject;
      document.body.appendChild(script);
    } else if (!isPickerLoaded) {
      window.gapi.load('picker', { callback: () => {
        isPickerLoaded = true;
        resolve();
      }});
    } else {
      resolve();
    }
  });
};

export const useGooglePicker = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadGapi()
      .then(() => setIsReady(true))
      .catch((err) => console.error("Failed to load Google Picker:", err));
  }, []);

  const openPicker = useCallback((
    accessToken: string,
    viewType: 'folders' | 'files' | 'markdown',
    onPicked: (docs: any[]) => void,
    onCancel?: () => void
  ) => {
    if (!isReady || !window.google || !window.google.picker) return;

    let view;
    if (viewType === 'folders') {
      view = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');
    } else if (viewType === 'markdown') {
      view = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes('text/markdown,text/plain');
    } else {
      view = new window.google.picker.DocsView();
    }

    const pickerOrigin =
      window.location.ancestorOrigins &&
      window.location.ancestorOrigins.length > 0
        ? window.location.ancestorOrigins[
            window.location.ancestorOrigins.length - 1
          ]
        : window.location.origin;

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          onPicked(data.docs);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          if (onCancel) onCancel();
        }
      })
      .setOrigin(pickerOrigin)
      .build();

    picker.setVisible(true);
  }, [isReady]);

  return { isReady, openPicker };
};
