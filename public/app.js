import { organizeResults } from "./result-organization.mjs";

const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const recentSearchesSelect = document.querySelector("#recent-searches");
const platformsNode = document.querySelector("#platforms");
const searchView = document.querySelector("#search-view");
const historyView = document.querySelector("#history-view");
const coupangDamagedView = document.querySelector("#coupang-damaged-view");
const searchTab = document.querySelector("#search-tab");
const historyTab = document.querySelector("#history-tab");
const coupangDamagedTab = document.querySelector("#coupang-damaged-tab");
const historyResultsNode = document.querySelector("#history-results");
const coupangDamagedForm = document.querySelector("#coupang-damaged-form");
const coupangDamagedResultsNode = document.querySelector("#coupang-damaged-results");
const coupangDamagedStatus = document.querySelector("#coupang-damaged-status");
const coupangDamagedSearchButton = document.querySelector("#coupang-damaged-search-button");
const resultsNode = document.querySelector("#results");
const lowestResultsNode = document.querySelector("#lowest-results");
const officialPricesNode = document.querySelector("#official-prices");
const alertsNode = document.querySelector("#alerts");
const openInstructions = document.querySelector("#open-instructions");
const summaryTitle = document.querySelector("#summary-title");
const summaryDetail = document.querySelector("#summary-detail");
const sortSelect = document.querySelector("#sort");
const discountFloorSelect = document.querySelector("#discount-floor");
const showThumbnails = document.querySelector("#show-thumbnails");
const verifyIopenButton = document.querySelector("#verify-iopen");
const template = document.querySelector("#result-card-template");
const platformGroupTemplate = document.querySelector("#platform-group-template");

let results = [];
let selectedPlatformIds = [];
let expandedPlatformIds = new Set();
let officialPrices = [];
let officialReferenceTwd = null;
let history = [];
let coupangDamagedResults = [];

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
discountFloorSelect.addEventListener("change", renderResults);
showThumbnails.addEventListener("change", renderResults);
verifyIopenButton.addEventListener("click", openIopenVerification);
recentSearchesSelect.addEventListener("change", async () => {
  if (!recentSearchesSelect.value) return;
  queryInput.value = recentSearchesSelect.value;
  await search();
});
searchTab.addEventListener("click", () => setActiveView("search"));
historyTab.addEventListener("click", () => setActiveView("history"));
coupangDamagedTab.addEventListener("click", () => setActiveView("coupang-damaged"));
coupangDamagedForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await searchCoupangDamagedBox();
});
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
    await refreshHistory();
    await loadLatestCoupangDamagedBoxSnapshot();
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
    officialPrices = body.officialPrices || [];
    officialReferenceTwd = body.officialReferenceTwd;
    const priced = results.filter((item) => item.price !== null).length;
    summaryTitle.textContent = `${results.length} \u7b46\u7d50\u679c`;
    summaryDetail.textContent = `${priced} \u7b46\u542b\u89e3\u6790\u50f9\u683c\u3002\u5e73\u53f0\u64cb\u4e0b\u81ea\u52d5\u64f7\u53d6\u6642\u6703\u4fdd\u7559\u641c\u5c0b\u9023\u7d50\u3002`;

    if (body.errors?.length) {
      alertsNode.hidden = false;
      alertsNode.textContent = body.errors.map((error) => `${error.platformName}: ${error.message}`).join(" / ");
    }

    renderOfficialPrices();
    renderResults();
    await refreshHistory();
  } catch (error) {
    results = [];
    officialPrices = [];
    officialReferenceTwd = null;
    renderOfficialPrices();
    summaryTitle.textContent = "\u641c\u5c0b\u5931\u6557";
    summaryDetail.textContent = error.message;
    renderEmpty("\u6c92\u6709\u53ef\u986f\u793a\u7684\u7d50\u679c\u3002");
  }
}

async function refreshHistory() {
  try {
    const response = await fetch("/api/history");
    if (!response.ok) {
      throw new Error("History unavailable");
    }

    const body = await response.json();
    history = body.history || [];
  } catch {
    history = [];
  }

  renderRecentQueries();
  renderHistory();
}

function setActiveView(view) {
  searchView.hidden = view !== "search";
  historyView.hidden = view !== "history";
  coupangDamagedView.hidden = view !== "coupang-damaged";
  searchTab.setAttribute("aria-selected", String(view === "search"));
  historyTab.setAttribute("aria-selected", String(view === "history"));
  coupangDamagedTab.setAttribute("aria-selected", String(view === "coupang-damaged"));
}

async function searchCoupangDamagedBox() {
  coupangDamagedSearchButton.disabled = true;
  coupangDamagedStatus.textContent = "\u641c\u5c0b\u4e2d...";
  coupangDamagedResultsNode.replaceChildren();

  try {
    const response = await fetch("/api/coupang/damaged-box");
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "\u9177\u6f8e\u76d2\u640d\u641c\u5c0b\u5931\u6557\u3002");
    }

    coupangDamagedResults = body.results || [];
    coupangDamagedStatus.textContent = String(coupangDamagedResults.length) + " \u7b46\u76d2\u640d\u5546\u54c1";
    renderCoupangDamagedBoxResults();
  } catch (error) {
    coupangDamagedStatus.textContent = coupangDamagedResults.length
      ? `${error.message}，已保留上次搜尋結果。`
      : error.message;
    renderCoupangDamagedBoxResults();
  } finally {
    coupangDamagedSearchButton.disabled = false;
  }
}

async function loadLatestCoupangDamagedBoxSnapshot() {
  try {
    const response = await fetch("/api/coupang/damaged-box/latest");
    const body = await response.json();

    if (!response.ok || !body.snapshot) {
      return;
    }

    coupangDamagedResults = body.snapshot.results || [];
    coupangDamagedStatus.textContent = `上次搜尋：${coupangDamagedResults.length} 筆盒損商品（${formatDate(body.snapshot.searchedAt)}）`;
    renderCoupangDamagedBoxResults();
  } catch {
    // The box-damage tab remains available when no previous local snapshot exists.
  }
}

function renderCoupangDamagedBoxResults() {
  if (!coupangDamagedResults.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "\u5c1a\u7121\u53ef\u986f\u793a\u5546\u54c1\u3002";
    coupangDamagedResultsNode.replaceChildren(empty);
    return;
  }

  coupangDamagedResultsNode.replaceChildren(...coupangDamagedResults.map(renderCoupangDamagedBoxResult));
}

function renderCoupangDamagedBoxResult(item) {
  const node = document.createElement("article");
  node.className = "coupang-damaged-result";
  const details = document.createElement("div");
  details.className = "coupang-damaged-details";
  const title = document.createElement("h3");
  title.textContent = item.title;
  const priceLine = document.createElement("div");
  priceLine.className = "coupang-damaged-price-line";
  priceLine.replaceChildren(
    renderCoupangDamagedPrice("\u5b9a\u50f9", item.listPrice),
    renderCoupangDamagedPrice("\u7121\u76d2\u640d", item.normalPrice),
    renderCoupangDamagedPrice("\u76d2\u640d", item.damagedPrice, true)
  );
  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "\u67e5\u770b";
  priceLine.append(link);
  details.append(title, priceLine);

  node.append(details);
  return node;
}

function renderCoupangDamagedPrice(label, value, emphasize = false) {
  const detail = document.createElement("span");
  detail.className = "coupang-damaged-price";
  const name = document.createElement("span");
  name.textContent = label;
  const amount = document.createElement("strong");
  amount.textContent = value === null || value === undefined ? "--" : money.format(value);
  if (emphasize) {
    amount.className = "damaged-price";
  }
  detail.append(name, amount);
  return detail;
}

function renderRecentQueries() {
  const options = history.slice(0, 20).map((entry) => {
    const option = document.createElement("option");
    option.value = entry.query;
    option.textContent = entry.setNumber;
    return option;
  });
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = `\u6700\u8fd1 ${options.length || 20} \u7b46\u67e5\u8a62`;
  recentSearchesSelect.replaceChildren(placeholder, ...options);
}

function renderHistory() {
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "\u5c1a\u7121\u67e5\u8a62\u7d00\u9304\u3002";
    historyResultsNode.replaceChildren(empty);
    return;
  }

  historyResultsNode.replaceChildren(...history.map(renderHistoryGroup));
}

function renderHistoryGroup(entry) {
  const group = document.createElement("section");
  group.className = "history-group";
  const toggle = document.createElement("button");
  toggle.className = "history-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  const setNumber = document.createElement("strong");
  setNumber.textContent = entry.setNumber;
  const query = document.createElement("span");
  query.textContent = entry.query;
  const count = document.createElement("span");
  count.textContent = `${entry.dates.length} \u5929`;
  toggle.append(setNumber, query, count);

  const dates = document.createElement("div");
  dates.className = "history-dates";
  dates.hidden = true;
  dates.replaceChildren(...entry.dates.map(renderHistoryDate));
  toggle.addEventListener("click", () => {
    const expanded = dates.hidden;
    dates.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
  });
  group.append(toggle, dates);
  return group;
}

function renderHistoryDate(entry) {
  const row = document.createElement("section");
  row.className = "history-date";
  const date = document.createElement("time");
  date.dateTime = entry.searchedAt;
  date.textContent = formatHistoryDate(entry.date);
  const platforms = document.createElement("div");
  platforms.className = "history-platforms";
  const summaries = entry.platforms.map((platform) => {
    const summary = document.createElement("p");
    summary.textContent = `${platform.platformName}  ${money.format(platform.lowestPrice)} - ${money.format(platform.highestPrice)}`;
    return summary;
  });
  if (!summaries.length) {
    const empty = document.createElement("p");
    empty.textContent = "\u5c1a\u7121\u5df2\u89e3\u6790\u50f9\u683c\u3002";
    summaries.push(empty);
  }
  platforms.replaceChildren(...summaries);
  row.append(date, platforms);
  return row;
}

function formatHistoryDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(`${value}T00:00:00+08:00`));
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
  officialPrices = [];
  officialReferenceTwd = null;
  renderOfficialPrices();
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
    sort: sortSelect.value,
    officialReferenceTwd,
    minimumDiscount: Number(discountFloorSelect.value)
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

function renderOfficialPrices() {
  officialPricesNode.hidden = officialPrices.length === 0;

  if (!officialPrices.length) {
    officialPricesNode.replaceChildren();
    return;
  }

  const title = document.createElement("strong");
  title.textContent = "\u5b98\u65b9\u5b9a\u50f9";
  const values = document.createElement("div");
  values.className = "official-price-values";
  values.replaceChildren(...officialPrices.map(renderOfficialPrice));
  officialPricesNode.replaceChildren(title, values);
}

function renderOfficialPrice(price) {
  const link = document.createElement("a");
  link.href = price.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = formatOfficialPrice(price);
  return link;
}

function formatOfficialPrice(price) {
  if (price.currency === "TWD") {
    return `\u53f0\u5e63 ${money.format(price.amount)}`;
  }

  const currency = "\u7f8e\u5143";
  const symbol = "US$";
  const converted = price.convertedTwd === null ? "\u53f0\u9280\u532f\u7387\u66ab\u6642\u7121\u6cd5\u53d6\u5f97" : `\u53f0\u9280 ${price.exchangeRate}，\u7d04 ${money.format(price.convertedTwd)}`;
  const verification = price.source === "brickeconomy"
    ? "，來源 BrickEconomy Retail"
    : price.verifiedBy === "brickeconomy" ? "，BrickEconomy 已驗證" : "";
  return `${currency} ${symbol}${price.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} (${converted})${verification}`;
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
