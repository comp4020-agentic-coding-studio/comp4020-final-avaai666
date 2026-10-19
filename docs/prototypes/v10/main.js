/* ================================================================ start */
document.documentElement.lang = LANG;
setSeason(0, true); seedLake(G.lake.adults, G.lake.fry); onResize();
window.__v10 = { W, dbg: { legal, holdHover, highlight, renderHand, showTip }, cer: () => CER, renderer, G, R, P, H, Y, startMode, toVillage, setLang, counts, fish: () => fish, MODES, setSeason };
const startAt = Q.get("mode");
if (startAt && MODES[startAt]) startMode(startAt); else renderVillage();
requestAnimationFrame(frame);
</script>
</body>
</html>
