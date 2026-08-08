export function initPaperStack() {
  const stack = document.querySelector(".paper-stack");
  if (!stack) return;

  const cards = Array.from(stack.querySelectorAll(".paper-card"));
  if (cards.length === 0) return;

  let currentIndex = 0;
  let isAnimating = false;
  let timer = null;

  function updatePositions() {
    cards.forEach((card, index) => {
      const pos = (index - currentIndex + cards.length) % cards.length;
      card.setAttribute("data-stack-pos", String(pos));
    });
  }

  updatePositions();

  function advanceStack() {
    if (isAnimating) return;
    isAnimating = true;

    const topCard = cards.find((card) => card.getAttribute("data-stack-pos") === "0") || cards[currentIndex];
    topCard.classList.add("paper-card--exit");

    setTimeout(() => {
      currentIndex = (currentIndex + 1) % cards.length;
      updatePositions();
      topCard.classList.remove("paper-card--exit");
      isAnimating = false;
    }, 550);
  }

  function startTimer() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stopTimer();
    timer = setInterval(advanceStack, 3500);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  stack.addEventListener("click", () => {
    advanceStack();
    startTimer();
  });

  stack.addEventListener("mouseenter", stopTimer);
  stack.addEventListener("mouseleave", startTimer);
  stack.addEventListener("focusin", stopTimer);
  stack.addEventListener("focusout", startTimer);

  startTimer();
}
