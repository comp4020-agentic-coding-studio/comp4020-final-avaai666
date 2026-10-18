// The site's top bar and the room's share bar. Everything works without it
// (the language switch and the join form are plain forms); this only adds the
// copy button and closes the phone menu after a tap. It decides nothing.
document.addEventListener("click", (e) => {
  const copy = e.target.closest("#copy");
  if (copy) {
    const url = document.getElementById("shareurl")?.textContent ?? location.href;
    const done = () => { const was = copy.textContent; copy.textContent = copy.dataset.copied; setTimeout(() => { copy.textContent = was; }, 1200); };
    navigator.clipboard?.writeText(url).then(done, done);
  }
  if (e.target.closest(".links a")) document.querySelector(".menu")?.removeAttribute("open");
});
