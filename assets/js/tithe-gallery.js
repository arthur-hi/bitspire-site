export function initTitheGallery() {
  const container = document.getElementById("tithe-gallery");
  if (!container) return;

  const mainImg = document.getElementById("tithe-gallery-active-img");
  const prevBtn = container.querySelector("[data-gallery-prev]");
  const nextBtn = container.querySelector("[data-gallery-next]");
  const counter = container.querySelector("[data-gallery-counter]");
  const fullscreenBtn = container.querySelector("[data-gallery-fullscreen]");
  const stage = container.querySelector(".tithe-gallery-stage");
  const thumbsStrip = container.querySelector("[data-gallery-strip]");
  const thumbs = Array.from(container.querySelectorAll("[data-gallery-thumb]"));

  const stripLeftBtn = container.querySelector("[data-strip-left]");
  const stripRightBtn = container.querySelector("[data-strip-right]");
  const stripTrack = container.querySelector("[data-strip-track]");
  const stripHandle = container.querySelector("[data-strip-handle]");

  if (!mainImg || thumbs.length === 0) return;

  let currentIndex = 0;
  const total = thumbs.length;

  const items = thumbs.map((thumb) => {
    const img = thumb.querySelector("img");
    return {
      src: img ? img.getAttribute("src") : "",
      alt: img ? img.getAttribute("alt") || "Tithe screenshot" : "Tithe screenshot"
    };
  });

  function updateGallery(index, smoothScrollThumb = true) {
    currentIndex = (index + total) % total;

    const currentItem = items[currentIndex];
    if (currentItem && currentItem.src) {
      mainImg.classList.add("is-switching");
      const tempImg = new Image();
      tempImg.onload = () => {
        mainImg.src = currentItem.src;
        mainImg.alt = currentItem.alt;
        mainImg.classList.remove("is-switching");
      };
      tempImg.onerror = () => {
        mainImg.src = currentItem.src;
        mainImg.classList.remove("is-switching");
      };
      tempImg.src = currentItem.src;
    }

    if (counter) {
      counter.textContent = `${currentIndex + 1} / ${total}`;
    }

    thumbs.forEach((thumb, idx) => {
      const isActive = idx === currentIndex;
      thumb.classList.toggle("is-active", isActive);
      thumb.setAttribute("aria-selected", String(isActive));
    });

    if (smoothScrollThumb && thumbsStrip) {
      const activeThumb = thumbs[currentIndex];
      if (activeThumb) {
        const stripRect = thumbsStrip.getBoundingClientRect();
        const thumbRect = activeThumb.getBoundingClientRect();

        if (thumbRect.left < stripRect.left || thumbRect.right > stripRect.right) {
          const scrollTarget =
            activeThumb.offsetLeft -
            thumbsStrip.offsetWidth / 2 +
            activeThumb.offsetWidth / 2;
          thumbsStrip.scrollTo({
            left: scrollTarget,
            behavior: "smooth"
          });
        }
      }
    }
  }

  // Thumb click events
  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const idx = parseInt(thumb.getAttribute("data-gallery-thumb"), 10);
      if (!isNaN(idx)) {
        updateGallery(idx);
      }
    });
  });

  // Prev / Next stage arrows
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      updateGallery(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      updateGallery(currentIndex + 1);
    });
  }

  // Keyboard navigation
  container.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateGallery(currentIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateGallery(currentIndex + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      updateGallery(0);
    } else if (e.key === "End") {
      e.preventDefault();
      updateGallery(total - 1);
    }
  });

  // Touch swipe support on stage
  let touchStartX = 0;
  let touchStartY = 0;
  if (stage) {
    stage.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    stage.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches.length === 1) {
          const diffX = e.changedTouches[0].clientX - touchStartX;
          const diffY = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
              updateGallery(currentIndex + 1);
            } else {
              updateGallery(currentIndex - 1);
            }
          }
        }
      },
      { passive: true }
    );
  }

  // Fullscreen support
  if (fullscreenBtn && stage) {
    fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        if (stage.requestFullscreen) {
          stage.requestFullscreen();
        } else if (stage.webkitRequestFullscreen) {
          stage.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });

    document.addEventListener("fullscreenchange", () => {
      stage.classList.toggle("is-fullscreen", !!document.fullscreenElement);
    });
  }

  // Slider Bar functionality
  function updateSliderHandle() {
    if (!thumbsStrip || !stripTrack || !stripHandle) return;

    const maxScroll = thumbsStrip.scrollWidth - thumbsStrip.clientWidth;
    const trackWidth = stripTrack.clientWidth;

    if (maxScroll <= 0) {
      stripHandle.style.width = "100%";
      stripHandle.style.transform = "translateX(0px)";
      return;
    }

    const visibleRatio = thumbsStrip.clientWidth / thumbsStrip.scrollWidth;
    const handleWidth = Math.max(36, Math.floor(trackWidth * visibleRatio));
    const maxHandleTranslate = trackWidth - handleWidth;

    const scrollRatio = Math.max(0, Math.min(1, thumbsStrip.scrollLeft / maxScroll));
    const handleTranslate = scrollRatio * maxHandleTranslate;

    stripHandle.style.width = `${handleWidth}px`;
    stripHandle.style.transform = `translateX(${handleTranslate}px)`;
  }

  if (thumbsStrip) {
    thumbsStrip.addEventListener("scroll", updateSliderHandle, { passive: true });
    window.addEventListener("resize", updateSliderHandle, { passive: true });
  }

  // Slider left / right arrow buttons
  if (stripLeftBtn && thumbsStrip) {
    stripLeftBtn.addEventListener("click", () => {
      thumbsStrip.scrollBy({ left: -240, behavior: "smooth" });
    });
  }

  if (stripRightBtn && thumbsStrip) {
    stripRightBtn.addEventListener("click", () => {
      thumbsStrip.scrollBy({ left: 240, behavior: "smooth" });
    });
  }

  // Slider track click & drag
  if (stripTrack && stripHandle && thumbsStrip) {
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startScrollLeft = thumbsStrip.scrollLeft;
      document.body.classList.add("is-gallery-dragging");

      if (e.target === stripTrack) {
        const trackRect = stripTrack.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - trackRect.left) / trackRect.width));
        const maxScroll = thumbsStrip.scrollWidth - thumbsStrip.clientWidth;
        thumbsStrip.scrollTo({
          left: clickRatio * maxScroll,
          behavior: "smooth"
        });
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const trackWidth = stripTrack.clientWidth;
      const handleWidth = stripHandle.offsetWidth;
      const maxHandleTranslate = trackWidth - handleWidth;
      const maxScroll = thumbsStrip.scrollWidth - thumbsStrip.clientWidth;

      if (maxHandleTranslate <= 0 || maxScroll <= 0) return;

      const deltaX = e.clientX - startX;
      const deltaScroll = (deltaX / maxHandleTranslate) * maxScroll;
      thumbsStrip.scrollLeft = startScrollLeft + deltaScroll;
    };

    const onPointerUp = () => {
      isDragging = false;
      document.body.classList.remove("is-gallery-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    stripTrack.addEventListener("pointerdown", onPointerDown);
  }

  // Initial display setup
  updateGallery(0, false);
  setTimeout(updateSliderHandle, 150);
}
