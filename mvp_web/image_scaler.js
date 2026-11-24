/* ADLMS — SRP Image & Canvas Downscaler (UI-02)
 * Caps uploaded/captured plate photos at <= 1024 px longest edge to prevent
 * WebView OOM on TR6948 (968 MB RAM) and always revokes temporary ObjectURLs.
 * Zero-build UMD/IIFE: attaches window.ADLMS_IMAGE_SCALER and module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ADLMS_IMAGE_SCALER = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_EDGE_PX = 1024;

  function computeScaledDimensions(width, height, maxEdge) {
    var limit = maxEdge > 0 ? maxEdge : MAX_EDGE_PX;
    var w = Math.max(1, Math.round(Number(width) || 0));
    var h = Math.max(1, Math.round(Number(height) || 0));
    var longest = Math.max(w, h);
    if (longest <= limit) {
      return { width: w, height: h, scale: 1, downscaled: false };
    }
    var scale = limit / longest;
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      scale: scale,
      downscaled: true,
    };
  }

  function downscaleImageToCanvas(img, maxEdge) {
    var origWidth = img.naturalWidth || img.width || 1;
    var origHeight = img.naturalHeight || img.height || 1;
    var target = computeScaledDimensions(origWidth, origHeight, maxEdge);
    var canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, target.width, target.height);
    return {
      canvas: canvas,
      width: target.width,
      height: target.height,
      origWidth: origWidth,
      origHeight: origHeight,
      scale: target.scale,
      downscaled: target.downscaled,
    };
  }

  function loadAndDownscaleFile(file, maxEdge) {
    return new Promise(function (resolve, reject) {
      var objectUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var result = downscaleImageToCanvas(img, maxEdge);
          result.thumbDataUrl = result.canvas.toDataURL('image/jpeg', 0.85);
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(objectUrl);
          img.src = '';
        }
      };
      img.onerror = function () {
        try {
          reject(new Error('No se pudo cargar la imagen seleccionada'));
        } finally {
          URL.revokeObjectURL(objectUrl);
          img.src = '';
        }
      };
      img.src = objectUrl;
    });
  }

  return {
    MAX_EDGE_PX: MAX_EDGE_PX,
    computeScaledDimensions: computeScaledDimensions,
    downscaleImageToCanvas: downscaleImageToCanvas,
    loadAndDownscaleFile: loadAndDownscaleFile,
  };
});
