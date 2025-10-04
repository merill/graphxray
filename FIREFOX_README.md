# GraphXray Firefox Extension

This document explains how to build and test the Firefox version of GraphXray.

## Key Differences from Chrome Version

1. **Manifest Version**: Firefox uses Manifest V2 (Chrome uses V3)
2. **Background Scripts**: Firefox uses non-persistent event-based background scripts (similar to Chrome's service workers)
3. **Browser API**: Firefox prefers `browser.*` API over `chrome.*` API (though both work)
4. **CSP Format**: Content Security Policy uses string format instead of object format

## Building for Firefox

```bash
# Install dependencies if not already done
npm install

# Build for Firefox
npm run build:firefox
```

This will create a Firefox-compatible build in the `./build` directory with:
- Firefox-specific manifest.json
- Browser API compatibility layer
- Proper background script handling

## Testing in Firefox

### Development Testing (Temporary Installation)

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to the `./build` folder and select `manifest.json`
5. The extension will be loaded temporarily (until Firefox restarts)

### Testing on Azure Portal

1. Navigate to portal.azure.com or portal.azure.us
2. Click the GraphXray icon in the Firefox toolbar
3. Browse Azure resources - the extension will capture Graph API calls
4. Open Firefox Developer Tools (F12) to see the GraphXray panel

## Firefox-Specific Files

- `public/manifest.firefox.json` - Firefox-compatible manifest (MV2)
- `public/dev.firefox.js` - Firefox devtools panel creation script
- `src/common/browserApi.js` - Cross-browser API compatibility module
- `scripts/build-firefox.js` - Firefox-specific build script

## Browser API Compatibility

The extension uses a unified API module (`browserApi.js`) that:
- Detects whether to use `chrome.*` or `browser.*` API
- Provides promise-based wrappers for Chrome callbacks
- Handles API differences transparently across all extension components

## Known Firefox Limitations

1. **DevTools Panel**: Firefox's devtools API may have slight differences in behavior
2. **Storage Sync**: Firefox has different storage quota limits
3. **Permissions**: Some permissions work differently in Firefox

## Publishing to Firefox Add-ons Store

1. Create a .zip file of the build directory:
   ```bash
   cd build && zip -r ../graphxray-firefox.zip *
   ```

2. Visit https://addons.mozilla.org/developers/
3. Submit the extension for review
4. Firefox requires all extensions to be signed, even for self-distribution

## Debugging Tips

- Use `about:debugging` for viewing console logs from background scripts
- Check browser console (Ctrl+Shift+J) for extension errors
- Firefox's extension debugging tools are in the about:debugging page

## Development Mode

For development with hot reload:
1. Run `npm start` as usual
2. Load the extension from `./build` directory (not `./dev`)
3. Manually reload the extension in `about:debugging` after changes