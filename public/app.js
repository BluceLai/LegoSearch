import { organizeResults } from "./result-organization.mjs";

const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const platformsNode = document.querySelector("#platforms");
const resultsNode = document.querySelector("#results");
const lowestResultsNode = document.querySelector("#lowest-results");
const alertsNode = document.querySelector("#alerts");
const openInstructions = document.querySelector("#open-instructions");
const summaryTitle = document.querySelector("#summary-title");
const summaryDetail = document.querySelector("#summary-detail");
const sortSelect = document.querySelector("#sort");
const showThumbnails = document.querySelector("#show-thumbnails");
const verifyIopenButton = document.querySelector("#verify-iopen");
const template = document.querySelector("#result-card-template");
const platformGroupTemplate = document.querySelector("#platform-group-template");

let results = [];
let selectedPlatformIds = [];
let expandedPlatformIds = new Set();

const money = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await search();
});

sortSelect.addEventListener("change", renderResults);
showThumbnails.addEventListener("change", renderResults);
verifyIopenButton.addEventListener("click", openIopenVerification);

await boot();

async function boot() {
  if (window.location.protocol === "file:") {
    showStartupError("\u8acb\u7528 start-legosearch.bat \u555f\u52d5\uff0c\u518d\u958b\u555f http://localhost:5178\u3002\u76f4\u63a5\u958b\u555f HTML \u6a94\u4e0d\u80fd\u641c\u5c0b\u3002");
    return;
  }

  try {
    const response = await fetch("/api/platforms");
    if (!response.ok) {
      throw new Error("\u5e73\u53f0\u8cc7\u6599\u8f09\u5165\u5931\u6557\u3002");
    }

    const { platforms } = await response.json();

    platformsNode.replaceChildren(...platforms.map((platform) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const name = document.createElement("span");
      label.className = "platform-choice";
      input.type = "checkbox";
      input.value = platform.id;
      input.checked = true;
      name.textContent = platform.name;
      label.append(input, name);
      return label;
    }));

    renderEmpty("\u53ef\u4ee5\u958b\u59cb\u641c\u5c0b\u3002");
  } catch {
    showStartupError("\u7121\u6cd5\u9023\u4e0a LegoSearch \u670d\u52d9\u3002\u8acb\u57f7\u884c start-legosearch.bat \u5f8c\u91cd\u65b0\u6574\u7406\u3002");
  }
}

async function search() {
  const platformIds = [...platformsNode.querySelectorAll("input:checked")]
    .map((input) => input.value)
    .join(",");

  if (!platformIds) {
    showStartupError("\u5e73\u53f0\u5c1a\u672a\u8f09\u5165\u3002\u8acb\u6aa2\u67e5 LegoSearch \u670d\u52d9\u662f\u5426\u5df2\u555f\u52d5\u3002");
    return;
  }

  const params = new URLSearchParams({
    q: queryInput.value,
    platforms: platformIds
  });

  summaryTitle.textContent = "\u641c\u5c0b\u4e2d";
  summaryDetail.textContent = "\u6b63\u5728\u67e5\u8a62\u5404\u5e73\u53f0\u50f9\u683c...";
  alertsNode.hidden = true;
  renderEmpty("\u641c\u5c0b\u4e2d\uff0c\u8acb\u7a0d\u5019\u3002");

  try {
    const response = await fetch(`/api/search?${params}`);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "\u641c\u5c0b\u5931\u6557\u3002");
    }

    results = body.results || [];
    selectedPlatformIds = body.platformIds || [];
    expandedPlatformIds = new Set();
    const priced = results.filter((item) => item.price !== null).length;
    summaryTitle.textContent = `${results.length} \u7b46\u7d50\u679c`;
    summaryDetail.textContent = `${priced} \u7b46\u542b\u89e3\u6790\u50f9\u683c\u3002\u5e73\u53f0\u64cb\u4e0b\u81ea\u52d5\u64f7\u53d6\u6642\u6703\u4fdd\u7559\u641c\u5c0b\u9023\u7d50\u3002`;

    if (body.errors?.length) {
      alertsNode.hidden = false;
      alertsNode.textContent = body.errors.map((error) => `${error.platformName}: ${error.message}`).join(" / ");
    }

    renderResults();
  } catch (error) {
    results = [];
    summaryTitle.textContent = "\u641c\u5c0b\u5931\u6557";
    summaryDetail.textContent = error.message;
    renderEmpty("\u6c92\u6709\u53ef\u986f\u793a\u7684\u7d50\u679c\u3002");
  }
}

async function openIopenVerification() {
  verifyIopenButton.disabled = true;

  try {
    const response = await fetch("/api/platforms/iopen/verify", { method: "POST" });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "iOPEN Mall \u9a57\u8b49\u8996\u7a97\u958b\u555f\u5931\u6557\u3002");
    }

    alertsNode.hidden = false;
    alertsNode.textContent = "iOPEN Mall \u9a57\u8b49\u8996\u7a97\u5df2\u958b\u555f\u3002\u5b8c\u6210\u5f8c\u95dc\u9589\u8996\u7a97\uff0c\u518d\u91cd\u65b0\u641c\u5c0b\u3002";
  } catch (error) {
    alertsNode.hidden = false;
    alertsNode.textContent = error.message;
  } finally {
    verifyIopenButton.disabled = false;
  }
}

function showStartupError(message) {
  results = [];
  selectedPlatformIds = [];
  summaryTitle.textContent = "\u7121\u6cd5\u958b\u59cb\u641c\u5c0b";
  summaryDetail.textContent = message;
  openInstructions.hidden = false;
  openInstructions.textContent = message;
  alertsNode.hidden = true;
  renderEmpty(message);
}

function renderResults() {
  const groups = organizeResults({
    results,
    platformIds: selectedPlatformIds,
    sort: sortSelect.value
  });
  resultsNode.classList.toggle("list-mode", !showThumbnails.checked);

  if (!groups.length) {
    renderLowestResults([]);
    renderEmpty("\u6c92\u6709\u53ef\u986f\u793a\u7684\u7d50\u679c\u3002");
    return;
  }

  renderLowestResults(groups);
  resultsNode.replaceChildren(...groups.map(renderPlatformGroup));
}

function renderLowestResults(groups) {
  lowestResultsNode.hidden = groups.length === 0;

  if (!groups.length) {
    lowestResultsNode.replaceChildren();
    return;
  }

  const title = document.createElement("h2");
  title.textContent = "\u5404\u5e73\u53f0\u6700\u4f4e\u50f9";
  const grid = document.createElement("div");
  grid.className = "lowest-grid";
  grid.replaceChildren(...groups.map(renderLowestResult));
  lowestResultsNode.replaceChildren(title, grid);
}

function renderLowestResult(group) {
  const node = document.createElement("article");
  node.className = "lowest-result";
  const platform = document.createElement("strong");
  platform.textContent = group.platformName;
  const detail = document.createElement("p");
  const price = document.createElement("strong");

  if (group.lowestResult) {
    detail.textContent = group.lowestResult.title;
    price.textContent = money.format(group.lowestResult.price);
    const link = document.createElement("a");
    link.href = group.lowestResult.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "\u67e5\u770b";
    node.append(platform, detail, price, link);
  } else {
    detail.textContent = "\u5c1a\u7121\u53ef\u6bd4\u50f9\u683c";
    node.append(platform, detail);
  }

  return node;
}

function renderPlatformGroup(group) {
  const node = platformGroupTemplate.content.cloneNode(true);
  const results = node.querySelector(".platform-results");
  const toggle = node.querySelector(".group-toggle");
  node.querySelector("h2").textContent = group.platformName;
  node.querySelector(".platform-count").textContent = `${group.results.length} \u7b46`;

  const renderGroupResults = () => {
    const expanded = expandedPlatformIds.has(group.platformId);
    results.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "\u6536\u5408\u7d50\u679c" : "\u5c55\u958b\u7d50\u679c";
    results.replaceChildren(...(expanded ? group.results.map(renderCard) : []));
  };

  toggle.addEventListener("click", () => {
    if (expandedPlatformIds.has(group.platformId)) {
      expandedPlatformIds.delete(group.platformId);
    } else {
      expandedPlatformIds.add(group.platformId);
    }
    renderGroupResults();
  });

  renderGroupResults();
  return node;
}

function renderCard(item) {
  const node = template.content.cloneNode(true);
  const image = node.querySelector("img");
  const imageFallback = node.querySelector(".media span");
  const platform = node.querySelector(".platform");
  const source = node.querySelector(".source");
  const title = node.querySelector("h3");
  const notice = node.querySelector(".notice");
  const price = node.querySelector(".price");
  const time = node.querySelector("time");
  const link = node.querySelector("a");

  if (showThumbnails.checked && item.imageUrl) {
    image.src = item.imageUrl;
    imageFallback.hidden = true;
  } else {
    image.remove();
  }

  platform.textContent = item.platformName;
  source.textContent = item.source === "search-link"
    ? "\u641c\u5c0b\u9023\u7d50"
    : item.source === "browser" ? "\u700f\u89bd\u5668\u64f7\u53d6" : "\u5df2\u89e3\u6790";
  title.textContent = item.title;
  notice.textContent = item.notice || "";
  price.textContent = item.price === null ? "\u958b\u555f\u5e73\u53f0\u78ba\u8a8d" : money.format(item.price);
  time.dateTime = item.fetchedAt;
  time.textContent = formatDate(item.fetchedAt);
  link.href = item.url;
  link.textContent = item.price === null ? "\u641c\u5c0b" : "\u67e5\u770b";

  return node;
}

function renderEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  resultsNode.replaceChildren(empty);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
