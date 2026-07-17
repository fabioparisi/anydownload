// Minimal HLS player for streams a browser tab can't play natively.
const src = new URLSearchParams(location.search).get("src");
const v = document.getElementById("v");
if (src) {
  document.title = decodeURIComponent(src.split("/").pop().split("?")[0]) || "AnyDownload Player";
  if (v.canPlayType("application/vnd.apple.mpegurl")) {
    v.src = src;
  } else if (window.Hls && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(v);
  } else {
    v.src = src;
  }
}
