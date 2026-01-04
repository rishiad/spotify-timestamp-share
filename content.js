(() => {
  const SELECTORS = {
    progressRange: '[data-testid="playback-progressbar"] input[type="range"]',
    contextLink: '[data-testid="context-item-link"]',
  };

  function getProgressRange() {
    return document.querySelector(SELECTORS.progressRange);
  }

  function getCurrentMs() {
    const range = getProgressRange();
    if (!range) return null;
    const value = Number(range.value);
    return Number.isFinite(value) ? value : null;
  }

  function getMaxMs() {
    const range = getProgressRange();
    if (!range) return null;
    const value = Number(range.max);
    return Number.isFinite(value) ? value : null;
  }

  function getEpisodeUrl() {
    const link = document.querySelector(SELECTORS.contextLink);
    const href = link ? link.getAttribute("href") : null;

    if (href) {
      const url = new URL(href, window.location.origin);
      if (url.pathname.startsWith("/episode/")) {
        return url;
      }
    }

    if (window.location.pathname.startsWith("/episode/")) {
      return new URL(window.location.href);
    }

    return null;
  }

  function buildTimestampUrl() {
    const url = getEpisodeUrl();
    if (!url) {
      return { ok: false, error: "not_on_episode" };
    }

    const ms = getCurrentMs();
    if (ms === null) {
      return { ok: false, error: "timestamp_unavailable" };
    }

    const seconds = Math.floor(ms / 1000);
    url.searchParams.set("t", String(seconds));

    return { ok: true, url: url.toString(), seconds };
  }

  function seekToMs(ms) {
    const range = getProgressRange();
    if (!range) {
      return { ok: false, error: "progressbar_not_found" };
    }

    const max = getMaxMs();
    const clamped = Math.min(Math.max(ms, 0), max ?? ms);

    range.value = String(clamped);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));

    return { ok: true, ms: clamped };
  }

  const MENU_ITEM_ATTR = "data-spotify-timestamp-item";
  const MENU_ACTION_ATTR = "data-spotify-timestamp-action";
  const MENU_LABEL = "Copy link to Episode at current time";

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();

    return Promise.resolve();
  }

  function getMenuLabelNode(scope) {
    if (!scope) return null;

    return (
      scope.querySelector('[data-encore-id="text"]') ||
      scope.querySelector('[data-encore-id="type"]') ||
      scope.querySelector('span[dir="auto"]') ||
      scope.querySelector("span")
    );
  }

  function getButtonLabel(button) {
    const labelNode = getMenuLabelNode(button);
    const text = labelNode ? labelNode.textContent : button.textContent;
    return (text || "").trim();
  }

  async function handleMenuClick(event) {
    const button = event.currentTarget;
    const labelNode = getMenuLabelNode(button);
    const originalLabel = labelNode?.textContent || MENU_LABEL;

    const updateLabel = (text) => {
      if (labelNode) {
        labelNode.textContent = text;
      }
    };

    const result = buildTimestampUrl();
    if (!result.ok) {
      updateLabel("Open a podcast episode");
      setTimeout(() => updateLabel(originalLabel), 1500);
      return;
    }

    try {
      await copyToClipboard(result.url);
      updateLabel("Copied timestamp link");
    } catch (error) {
      console.error(error);
      updateLabel("Copy failed");
    }

    setTimeout(() => updateLabel(originalLabel), 1500);
  }

  function findMenuItemButton(menu, matcher) {
    const buttons = Array.from(
      menu.querySelectorAll('button[role="menuitem"]'),
    );
    return buttons.find((button) => matcher(getButtonLabel(button))) || null;
  }

  function createMenuItem(templateButton) {
    const templateLi =
      templateButton.closest("li") || templateButton.parentElement;
    if (!templateLi) return null;

    const item = templateLi.cloneNode(true);
    item.setAttribute(MENU_ITEM_ATTR, "true");

    const button = item.querySelector("button");
    if (!button) return null;

    button.setAttribute(MENU_ACTION_ATTR, "copy-timestamp");
    button.removeAttribute("aria-expanded");
    button.removeAttribute("aria-haspopup");
    button.removeAttribute("aria-disabled");
    button.removeAttribute("disabled");
    const labelNode = getMenuLabelNode(button);
    if (labelNode) {
      labelNode.textContent = MENU_LABEL;
    }

    button.addEventListener("click", handleMenuClick);
    return item;
  }

  function injectIntoMenu(menu) {
    if (!menu || menu.querySelector(`[${MENU_ITEM_ATTR}="true"]`)) {
      return false;
    }

    const template = findMenuItemButton(menu, (label) =>
      label.toLowerCase().includes("copy link to episode"),
    );

    if (!template) return false;

    const item = createMenuItem(template);
    if (!item) return false;

    const templateLi = template.closest("li") || template.parentElement;
    if (templateLi && templateLi.parentNode === menu) {
      templateLi.insertAdjacentElement("afterend", item);
    } else {
      menu.appendChild(item);
    }

    return true;
  }

  function findShareMenu() {
    const buttons = Array.from(
      document.querySelectorAll('button[role="menuitem"]'),
    );
    const match = buttons.find((button) =>
      getButtonLabel(button).toLowerCase().includes("copy link to episode"),
    );
    if (!match) return null;

    return match.closest('ul[role="menu"]');
  }

  function tryInjectMenuItem() {
    const shareMenu = findShareMenu();
    if (shareMenu) {
      injectIntoMenu(shareMenu);
    }
  }

  function startMenuObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (
            node.matches('[data-testid="context-menu"], ul[role="menu"]') ||
            node.querySelector('[data-testid="context-menu"], ul[role="menu"]')
          ) {
            tryInjectMenuItem();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    tryInjectMenuItem();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMenuObserver, {
      once: true,
    });
  } else {
    startMenuObserver();
  }

  const api = typeof browser !== "undefined" ? browser : chrome;

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "GET_TIMESTAMP_LINK") {
      sendResponse(buildTimestampUrl());
      return;
    }

    if (message.type === "SEEK_TO_MS") {
      const ms = Number(message.ms);
      if (!Number.isFinite(ms)) {
        sendResponse({ ok: false, error: "invalid_ms" });
        return;
      }
      sendResponse(seekToMs(ms));
    }
  });
})();
