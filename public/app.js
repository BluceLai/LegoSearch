const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const platformsEl = document.querySelector("#platforms");
const resultsEl = document.querySelector("#results");
const resultCountEl = document.querySelector("#result-count");
const statusTextEl = document.querySelector("#status-text");
const noticeEl = document.querySelector("#notice");
const sortEl = document.querySelector("#sort");
const refreshButton = document.querySelector("#refresh-button");
const template = document.querySelector("#result-template");

let currentResults = [];
let refreshNext = false;

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

async function loadPlatforms() {
  const response = await fetch("/api/platforms");
  const data = await response.json();

  platformsEl.innerHTML = "";
  for (const platform of data.platforms) {
    const label = document.createElement("label");
    label.className = "platform-toggle";
    label.innerHTML = `
      <input type="checkbox" name="platform" value="${platform.id}" checked />
      <span>${platform.name}</span>
    `;
    platformsEl.append(label);
  }
}

function selectedPlatforms() {
  return [...document.querySelectorAll("input[name='platform']:checked")]
    .map((input) => input.value);
}

function sortResults(results) {
  const sorted = [...results];

  if (sortEl.value === "price-desc") {
    sorted.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  } else if (sortEl.value === "platform") {
    sorted.sort((a, b) => a.platform.localeCompare(b.platform, "zh-Hant"));
  } else {
    sorted.sort((a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    });
  }

  return sorted;
}

function renderResults() {
  resultsEl.innerHTML = "";
  noticeEl.hidden = true;

  const sorted = sortResults(currentResults);
  if (!sorted.length) {
    resultsEl.innerHTML = `<div class="empty-state">目前沒有結果。</div>`;
    return;
  }

  for (const item of sorted) {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".result-card");
    const image = node.querySelector("img");
    const title = node.querySelector("h2");
    const platform = node.querySelector(".platform");
    const source = node.querySelector(".source");
    const seller = node.querySelector(".seller");
    const price = node.querySelector(".price");
    const originalPrice = node.querySelector(".original-price");
    const notice = node.querySelector(".notice-text");
    const time = node.querySelector("time");
    const link = node.querySelector(".open-link");

    if (item.image) {
      image.src = item.image;
    }

    card.dataset.platform = item.platformId;
    title.textContent = item.title;
    platform.textContent = item.platform;
    source.textContent = item.source;
    seller.textContent = item.seller || " ";
    price.textContent = item.price ? currency.format(item.price) : "待確認";
    originalPrice.textContent = item.originalPrice ? currency.format(item.originalPrice) : "";
    notice.textContent = item.notice || "";
    time.dateTime = item.fetchedAt;
    time.textContent = formatTime(item.fetchedAt);
    link.href = item.url;
    link.textContent = item.price ? "開啟商品" : "前往搜尋";

    resultsEl.append(node);
  }
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function search(refresh = false) {
  const query = queryInput.value.trim();
  const platforms = selectedPlatforms();

  if (!query || !platforms.length) {
    noticeEl.hidden = false;
    noticeEl.textContent = "請輸入關鍵字並至少選擇一個平台。";
    return;
  }

  resultCountEl.textContent = "搜尋中";
  statusTextEl.textContent = "正在查詢各平台價格...";
  resultsEl.innerHTML = `<div class="empty-state">查詢中，請稍候。</div>`;
  noticeEl.hidden = true;

  const params = new URLSearchParams({
    q: query,
    platforms: platforms.join(",")
  });

  if (refresh) {
    params.set("refresh", "1");
  }

  try {
    const response = await fetch(`/api/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "搜尋失敗");
    }

    currentResults = data.results || [];
    const pricedCount = currentResults.filter((item) => item.price).length;
    resultCountEl.textContent = `${currentResults.length} 筆結果`;
    statusTextEl.textContent = data.cached
      ? `使用快取，${pricedCount} 筆含價格。`
      : `已更新，${pricedCount} 筆含價格。`;

    if (data.errors?.length) {
      noticeEl.hidden = false;
      noticeEl.textContent = data.errors
        .map((error) => `${error.platform}: ${error.message}`)
        .join(" / ");
    }

    renderResults();
  } catch (error) {
    currentResults = [];
    resultCountEl.textContent = "搜尋失敗";
    statusTextEl.textContent = error.message;
    resultsEl.innerHTML = `<div class="empty-state">無法取得搜尋結果。</div>`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  search(refreshNext);
  refreshNext = false;
});

refreshButton.addEventListener("click", () => {
  refreshNext = true;
  search(true);
});

sortEl.addEventListener("change", renderResults);

loadPlatforms();
